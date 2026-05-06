'use client'
import { useEffect, useRef, useState } from 'react'
import { db, CanvasItem } from '@/db/schema'
import { nanoid } from 'nanoid'
import { safeDbWrite } from '@/lib/dbError'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { canvasSuggestion } from './canvas-slash-menu'

type BgPattern = 'grid' | 'dots'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_INITIAL_IMAGE_WIDTH = 400
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

// Slash command extension scoped to the canvas text box (reduced command set).
const CanvasSlashCommand = Extension.create({
  name: 'canvasSlashCommand',
  addOptions() {
    return { suggestion: canvasSuggestion }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})

// Parse an item.content string to a TipTap document.
// Legacy plain-text content gets wrapped in a single paragraph.
// New content is stored as stringified TipTap JSON.
function parseContent(raw: string): Record<string, unknown> {
  if (!raw) return { type: 'doc', content: [{ type: 'paragraph' }] }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
      return parsed
    }
  } catch {
    // not JSON — treat as plain text
  }
  return {
    type: 'doc',
    content: raw.split('\n').map(line => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  }
}

// Rich text box with slash commands. Uses TipTap with a minimal extension
// set (StarterKit + lists + slash menu). Content persists as stringified
// TipTap JSON. Saves on blur via onSave.
function CanvasRichTextBox({
  initialContent,
  onSave,
}: {
  initialContent: string
  onSave: (content: string) => void
}) {
  const savedRef = useRef<string>(initialContent)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        horizontalRule: false,
        dropcursor: false,
      }),
      HorizontalRule,
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({ placeholder: "Type '/' for commands..." }),
      CanvasSlashCommand,
    ],
    content: parseContent(initialContent),
    onBlur: ({ editor: ed }) => {
      const json = JSON.stringify(ed.getJSON())
      if (json !== savedRef.current) {
        savedRef.current = json
        onSave(json)
      }
    },
    editorProps: {
      attributes: {
        class: 'canvas-textbox-content',
      },
    },
  })

  // Clean up the editor on unmount
  useEffect(() => {
    return () => {
      editor?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        flex: 1,
        // Reserve 28px at the top so the floating drag/delete toolbar
        // (positioned absolute at top:4 on hover/select) never overlaps
        // the first line of text. Standard pattern in Figma/Whimsical.
        padding: '28px 8px 8px',
        fontSize: '13px',
        color: 'var(--text-primary)',
        overflow: 'auto',
        cursor: 'text',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.06)',
        borderRadius: '6px',
      }}
    >
      <EditorContent editor={editor} />
    </div>
  )
}

// Read a Blob's natural image dimensions by loading it into an Image element.
function readImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to read image dimensions'))
    }
    img.src = url
  })
}

export default function CanvasView({ pageUid }: { pageUid: string }) {
  const [items, setItems] = useState<CanvasItem[]>([])
  const [bgPattern, setBgPattern] = useState<BgPattern>('grid')
  const [hoveredUid, setHoveredUid] = useState<string | null>(null)
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  // Map from item.uid → object URL (regenerated on each mount, not persisted)
  const [urlMap, setUrlMap] = useState<Map<string, string>>(new Map())
  const canvasScrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rafRef = useRef<number | null>(null)
  // Mirror of urlMap for the unmount cleanup effect (avoids stale closure)
  const urlMapRef = useRef<Map<string, string>>(new Map())
  useEffect(() => { urlMapRef.current = urlMap }, [urlMap])

  // Load items for this page
  useEffect(() => {
    async function load() {
      const rows = await db.canvasItems.where('pageUid').equals(pageUid).toArray()
      setItems(rows)
    }
    load()
  }, [pageUid])

  // Object URL lifecycle — regenerate URLs for image items, revoke when
  // items are removed or component unmounts.
  useEffect(() => {
    setUrlMap(prev => {
      const next = new Map(prev)
      const currentUids = new Set(items.map(i => i.uid))
      // Revoke URLs for items that no longer exist
      for (const [uid, url] of prev.entries()) {
        if (!currentUids.has(uid)) {
          URL.revokeObjectURL(url)
          next.delete(uid)
        }
      }
      // Create URLs for new image items
      for (const item of items) {
        if (item.type === 'image' && item.imageBlob && !next.has(item.uid)) {
          next.set(item.uid, URL.createObjectURL(item.imageBlob))
        }
      }
      return next
    })
  }, [items])

  // Revoke all URLs on unmount (reads from ref to get the latest map)
  useEffect(() => {
    return () => {
      urlMapRef.current.forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  async function addTextBox() {
    const scroll = canvasScrollRef.current
    const sx = scroll?.scrollLeft ?? 0
    const sy = scroll?.scrollTop ?? 0
    const now = new Date().toISOString()
    const newItem: CanvasItem = {
      uid: nanoid(),
      pageUid,
      type: 'text',
      x: sx + 80,
      y: sy + 80,
      width: 220,
      height: 140,
      content: '',
      createdAt: now,
      updatedAt: now,
    }
    const id = await safeDbWrite(
      () => db.canvasItems.add(newItem),
      'Failed to save canvas item. Please try again.'
    )
    if (id == null) return
    setItems(prev => [...prev, { ...newItem, id: id as number }])
  }

  // Add one or more image files to the canvas. `position` is optional —
  // if omitted, images are placed near the current scroll offset with a
  // small stagger so they don't stack exactly.
  async function addImageFiles(
    files: File[],
    position?: { x: number; y: number }
  ) {
    const scroll = canvasScrollRef.current
    const baseX = position?.x ?? (scroll?.scrollLeft ?? 0) + 80
    const baseY = position?.y ?? (scroll?.scrollTop ?? 0) + 80
    // Lenient filter: accept anything with an image/* mime type OR an image extension
    const imageFiles = files.filter(f =>
      (f.type && f.type.startsWith('image/')) ||
      /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.name)
    )
    if (imageFiles.length === 0) {
      console.warn('[Canvas] No image files detected in drop/paste/picker', files.map(f => ({ name: f.name, type: f.type })))
      return
    }

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      if (file.size > MAX_IMAGE_BYTES) {
        console.warn(`[Canvas] Skipping ${file.name}: ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds 10 MB limit`)
        continue
      }
      try {
        const { width: natW, height: natH } = await readImageDimensions(file)
        // Scale to max initial width while preserving aspect ratio
        const scale = Math.min(1, MAX_INITIAL_IMAGE_WIDTH / natW)
        const displayWidth = Math.round(natW * scale)
        // Add 24px for the drag handle bar above the image
        const displayHeight = Math.round(natH * scale) + 24
        const now = new Date().toISOString()
        const uid = nanoid()
        // Pre-register the object URL synchronously so the image shows
        // on the very first render (no "Loading..." flash).
        const objectUrl = URL.createObjectURL(file)
        setUrlMap(prev => {
          const next = new Map(prev)
          next.set(uid, objectUrl)
          return next
        })
        const newItem: CanvasItem = {
          uid,
          pageUid,
          type: 'image',
          x: baseX + i * 30,
          y: baseY + i * 30,
          width: displayWidth,
          height: displayHeight,
          content: file.name,
          imageBlob: file,
          mimeType: file.type || 'image/png',
          naturalWidth: natW,
          naturalHeight: natH,
          createdAt: now,
          updatedAt: now,
        }
        const id = await safeDbWrite(
          () => db.canvasItems.add(newItem),
          'Failed to save canvas item. Please try again.'
        )
        if (id == null) continue
        setItems(prev => [...prev, { ...newItem, id: id as number }])
      } catch (err) {
        console.error('[Canvas] Failed to add image', file.name, err)
      }
    }
  }

  function triggerFilePicker() {
    fileInputRef.current?.click()
  }

  async function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) await addImageFiles(files)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  async function deleteItem(item: CanvasItem) {
    if (item.id == null) return
    await safeDbWrite(
      () => db.canvasItems.delete(item.id!),
      'Failed to delete canvas item. Please try again.'
    )
    setItems(prev => prev.filter(i => i.uid !== item.uid))
  }

  async function saveContent(item: CanvasItem, content: string) {
    if (item.id == null) return
    const updatedAt = new Date().toISOString()
    await safeDbWrite(
      () => db.canvasItems.update(item.id!, { content, updatedAt }),
      'Failed to update canvas item. Please try again.'
    )
    setItems(prev => prev.map(i => i.uid === item.uid ? { ...i, content, updatedAt } : i))
  }

  function startDrag(e: React.MouseEvent, item: CanvasItem) {
    e.preventDefault()
    e.stopPropagation()
    const handleEl = e.currentTarget as HTMLElement
    const rect = handleEl.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    const scroll = canvasScrollRef.current
    if (!scroll) return
    const wrapperRect = scroll.getBoundingClientRect()

    let latestX = item.x
    let latestY = item.y

    const onMove = (ev: MouseEvent) => {
      // Mouse position relative to the inner canvas surface (accounting for scroll)
      const relX = ev.clientX - wrapperRect.left + scroll.scrollLeft
      const relY = ev.clientY - wrapperRect.top + scroll.scrollTop
      latestX = Math.max(0, relX - offsetX)
      latestY = Math.max(0, relY - offsetY)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        setItems(prev => prev.map(i => i.uid === item.uid ? { ...i, x: latestX, y: latestY } : i))
      })
    }

    const onUp = async () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (item.id != null) {
        const updatedAt = new Date().toISOString()
        await safeDbWrite(
          () => db.canvasItems.update(item.id!, { x: latestX, y: latestY, updatedAt }),
          'Failed to update canvas item. Please try again.'
        )
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startResize(e: React.MouseEvent, item: CanvasItem) {
    e.preventDefault()
    e.stopPropagation()
    const initialMouseX = e.clientX
    const initialMouseY = e.clientY
    const initialWidth = item.width
    const initialHeight = item.height
    // For image items, preserve aspect ratio (of the image itself, excluding
    // the 24px drag handle). Hold Shift to unlock and stretch freely.
    const isImage = item.type === 'image' && item.naturalWidth && item.naturalHeight
    const imageAspectRatio = isImage ? (item.naturalWidth! / item.naturalHeight!) : 0
    const lockAspect = isImage && !e.shiftKey

    let latestW = initialWidth
    let latestH = initialHeight

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - initialMouseX
      const dy = ev.clientY - initialMouseY
      if (lockAspect) {
        // Use whichever axis moved more; derive the other from aspect ratio
        if (Math.abs(dx) >= Math.abs(dy)) {
          latestW = Math.max(120, initialWidth + dx)
          const imgH = (latestW / imageAspectRatio)
          latestH = Math.max(80, imgH + 24)
        } else {
          const newH = Math.max(80, initialHeight + dy)
          const imgH = newH - 24
          latestW = Math.max(120, imgH * imageAspectRatio)
          latestH = Math.max(80, latestW / imageAspectRatio + 24)
        }
      } else {
        latestW = Math.max(120, initialWidth + dx)
        latestH = Math.max(80, initialHeight + dy)
      }
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        setItems(prev => prev.map(i => i.uid === item.uid ? { ...i, width: latestW, height: latestH } : i))
      })
    }

    const onUp = async () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (item.id != null) {
        const updatedAt = new Date().toISOString()
        await safeDbWrite(
          () => db.canvasItems.update(item.id!, { width: latestW, height: latestH, updatedAt }),
          'Failed to update canvas item. Please try again.'
        )
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Drag-and-drop files from the desktop
  function onCanvasDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }
  async function onCanvasDrop(e: React.DragEvent) {
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const scroll = canvasScrollRef.current
    if (!scroll) return
    const wrapperRect = scroll.getBoundingClientRect()
    const relX = e.clientX - wrapperRect.left + scroll.scrollLeft
    const relY = e.clientY - wrapperRect.top + scroll.scrollTop
    await addImageFiles(files, { x: Math.max(0, relX - 100), y: Math.max(0, relY - 12) })
  }

  // Clipboard paste — handle images pasted from web pages or screenshots
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      // Ignore paste if user is editing a text box
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return
      }
      const dt = e.clipboardData
      if (!dt) return
      const files: File[] = []
      for (let i = 0; i < dt.items.length; i++) {
        const it = dt.items[i]
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const file = it.getAsFile()
          if (file) files.push(file)
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        // Place near the current scroll position
        const scroll = canvasScrollRef.current
        if (scroll) {
          const wrapperRect = scroll.getBoundingClientRect()
          const centerX = scroll.scrollLeft + wrapperRect.width / 2 - 200
          const centerY = scroll.scrollTop + wrapperRect.height / 2 - 150
          await addImageFiles(files, { x: Math.max(0, centerX), y: Math.max(0, centerY) })
        } else {
          await addImageFiles(files)
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageUid])

  const gridBg = {
    backgroundImage: `
      linear-gradient(to right, var(--border) 1px, transparent 1px),
      linear-gradient(to bottom, var(--border) 1px, transparent 1px)
    `,
    backgroundSize: '24px 24px',
  }
  const dotsBg = {
    backgroundImage: 'radial-gradient(circle, var(--border) 1.5px, transparent 1.5px)',
    backgroundSize: '24px 24px',
  }

  return (
    <div
      ref={canvasScrollRef}
      style={{
        height: 'calc(100vh - 200px)',
        overflow: 'auto',
        background: 'var(--bg-secondary)',
        position: 'relative',
      }}
    >
      {/* Hidden file input for the + Image button */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        multiple
        onChange={onFileInputChange}
        style={{ display: 'none' }}
      />

      {/* Sticky toolbar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          zIndex: 10,
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          padding: '10px 16px',
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={addTextBox}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Text box
        </button>
        <button
          onClick={triggerFilePicker}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Image
        </button>
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
        <button
          onClick={() => setBgPattern('grid')}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            border: bgPattern === 'grid' ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Grid
        </button>
        <button
          onClick={() => setBgPattern('dots')}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            border: bgPattern === 'dots' ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Dots
        </button>
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          Drop or paste images
        </div>
      </div>

      {/* Canvas surface */}
      <div
        onDragOver={onCanvasDragOver}
        onDrop={onCanvasDrop}
        onClick={() => setSelectedUid(null)}
        style={{
          position: 'relative',
          minHeight: '200vh',
          minWidth: '200vw',
          ...(bgPattern === 'grid' ? gridBg : dotsBg),
        }}
      >
        {items.map(item => {
          const isImage = item.type === 'image'
          const imgUrl = isImage ? urlMap.get(item.uid) : undefined
          const isHovered = hoveredUid === item.uid
          const isSelected = selectedUid === item.uid
          return (
            <div
              key={item.uid}
              onMouseEnter={() => setHoveredUid(item.uid)}
              onMouseLeave={() => setHoveredUid(null)}
              onClick={(e) => { e.stopPropagation(); setSelectedUid(item.uid) }}
              style={{
                position: 'absolute',
                left: `${item.x}px`,
                top: `${item.y}px`,
                width: `${item.width}px`,
                height: `${item.height}px`,
                background: 'var(--bg-primary)',
                border: isSelected
                  ? '1px solid var(--accent)'
                  : '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: isSelected
                  ? '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12)'
                  : '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Floating toolbar — drag handle + delete. Hidden until hover or
                  selection so the box looks clean (just the picture/text). */}
              <div
                onMouseDown={e => startDrag(e, item)}
                style={{
                  position: 'absolute',
                  top: '4px',
                  left: '4px',
                  right: '4px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 6px',
                  borderRadius: '6px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                  cursor: 'grab',
                  userSelect: 'none',
                  opacity: isHovered || isSelected ? 1 : 0,
                  pointerEvents: isHovered || isSelected ? 'auto' : 'none',
                  transition: 'opacity 0.15s',
                  zIndex: 2,
                }}
              >
                <div style={{
                  width: '20px',
                  height: '3px',
                  borderRadius: '2px',
                  background: 'var(--border)',
                  pointerEvents: 'none',
                }} />
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => deleteItem(item)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    fontSize: '14px',
                    lineHeight: 1,
                    padding: '0 2px',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#EF4444' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)' }}
                  aria-label="Delete"
                >
                  ×
                </button>
              </div>

              {/* Content: text or image */}
              {isImage ? (
                imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={item.content || 'canvas image'}
                    draggable={false}
                    style={{
                      flex: 1,
                      width: '100%',
                      height: '100%',
                      minHeight: 0,
                      objectFit: 'contain',
                      pointerEvents: 'none',
                      userSelect: 'none',
                      display: 'block',
                      background: 'var(--bg-secondary)',
                    }}
                  />
                ) : (
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-tertiary)', fontSize: '12px',
                  }}>Loading…</div>
                )
              ) : (
                <CanvasRichTextBox
                  initialContent={item.content}
                  onSave={content => saveContent(item, content)}
                />
              )}

              {/* Resize handle (bottom-right, invisible zone) */}
              <div
                onMouseDown={e => startResize(e, item)}
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '12px',
                  height: '12px',
                  cursor: 'nwse-resize',
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

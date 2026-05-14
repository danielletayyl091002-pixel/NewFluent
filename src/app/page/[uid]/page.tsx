'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { db, Page, Block } from '@/db/schema'
import { nanoid } from 'nanoid'
import BoardView from '@/components/views/BoardView'
import CalendarView from '@/components/views/CalendarView'
import CanvasView from '@/components/views/CanvasView'
import FluentEditor from '@/components/editor/FluentEditor'
import { exportPageToMarkdown } from '@/lib/exportMarkdown'
import { fileToDataUrl } from '@/lib/imageUtils'

function legacyToTipTap(blocks: Block[]): Record<string, unknown> {
  return {
    type: 'doc',
    content: blocks
      .filter(b => b.type !== 'document')
      .map(block => {
        const text = block.content || ''
        const textNode = text ? [{ type: 'text', text }] : []
        switch (block.type) {
          case 'heading1': return { type: 'heading', attrs: { level: 1 }, content: textNode }
          case 'heading2': return { type: 'heading', attrs: { level: 2 }, content: textNode }
          case 'heading3': return { type: 'heading', attrs: { level: 3 }, content: textNode }
          case 'bullet': return { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: textNode }] }] }
          case 'numbered': return { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: textNode }] }] }
          case 'todo': return { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: block.checked || false }, content: [{ type: 'paragraph', content: textNode }] }] }
          case 'quote': return { type: 'blockquote', content: [{ type: 'paragraph', content: textNode }] }
          case 'code': return { type: 'codeBlock', attrs: { language: null }, content: text ? [{ type: 'text', text }] : [] }
          case 'divider': return { type: 'horizontalRule' }
          case 'table': return { type: 'paragraph', content: [{ type: 'text', text: '[Table]' }] }
          case 'callout': return { type: 'blockquote', content: [{ type: 'paragraph', content: textNode }] }
          default: return { type: 'paragraph', content: textNode }
        }
      })
  }
}

export default function PageCanvas() {
  const { uid } = useParams<{ uid: string }>()
  const [page, setPage] = useState<Page | null>(null)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'page' | 'board' | 'calendar' | 'canvas'>('page')
  // Focus mode: collapses the title bar + view tabs so just the document
  // content remains. Persists per-page so the user keeps their writing
  // state when navigating away and back. Toggle via the chevron button
  // top-right of the page or by pressing F.
  const focusKey = `page.focus.${uid}`
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(focusKey) === '1'
  })
  function toggleFocus() {
    const next = !focusMode
    setFocusMode(next)
    if (typeof localStorage !== 'undefined') localStorage.setItem(focusKey, next ? '1' : '0')
  }
  // Keyboard shortcut: F (no modifiers) toggles focus mode while NOT
  // typing in an input / contenteditable.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'f' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      toggleFocus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMode])
  const [editorContent, setEditorContent] = useState<Record<string, unknown> | null>(null)
  const loadedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!uid) return
    if (loadedRef.current === uid) return
    loadedRef.current = uid
    async function load() {
      const p = await db.pages.where('uid').equals(uid).first()
      setPage(p || null)
      if (p?.title) document.title = p.title

      const allBlocks = await db.blocks
        .where('pageUid').equals(uid)
        .sortBy('order')

      // Check for existing TipTap document
      const docBlock = allBlocks.find(b => b.type === 'document')
      if (docBlock) {
        try {
          setEditorContent(JSON.parse(docBlock.content))
        } catch {
          setEditorContent({ type: 'doc', content: [{ type: 'paragraph' }] })
        }
      } else if (allBlocks.length > 0) {
        // Migrate legacy blocks to TipTap format
        const tiptapJson = legacyToTipTap(allBlocks)
        setEditorContent(tiptapJson)

        // Save migrated content and clean up old blocks
        const docUid = uid + '_doc'
        await db.blocks.add({
          uid: docUid,
          pageUid: uid,
          type: 'document' as Block['type'],
          content: JSON.stringify(tiptapJson),
          checked: false,
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        // Delete legacy blocks
        for (const block of allBlocks) {
          if (block.id && block.type !== 'document') {
            await db.blocks.delete(block.id)
          }
        }
      } else {
        setEditorContent({ type: 'doc', content: [{ type: 'paragraph' }] })
      }

      setLoading(false)
    }
    load()
  }, [uid])

  async function updateTitle(title: string) {
    if (!page?.id) return
    await db.pages.update(page.id, { title, updatedAt: new Date().toISOString() })
    setPage(prev => prev ? { ...prev, title } : null)
    document.title = title
    window.dispatchEvent(new CustomEvent('page-title-updated'))
  }

  // ── Cover image (Notion-style banner) ─────────────────────────────
  // File picker → resize → DataURL → save to Page row. Stored inline so
  // there's no separate Blob table to manage.
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [coverHovered, setCoverHovered] = useState(false)
  // Reposition state — when true, the cover enters drag-to-adjust mode
  // (Notion-style). dragPosition holds the in-flight position; saved to
  // page.coverPosition when the user clicks "Save position".
  const [repositioning, setRepositioning] = useState(false)
  const [dragPosition, setDragPosition] = useState<number | null>(null)
  const dragStartRef = useRef<{ y: number; startPos: number } | null>(null)
  const COVER_HEIGHT = 200

  async function uploadCover(file: File) {
    if (!page?.id) return
    try {
      // GIFs pass through fileToDataUrl untouched so animations survive;
      // static images are resized to 1600×600 to keep page rows lean.
      const dataUrl = await fileToDataUrl(file, { maxWidth: 1600, maxHeight: 600, quality: 0.82 })
      await db.pages.update(page.id, { coverImage: dataUrl, updatedAt: new Date().toISOString() })
      setPage(prev => prev ? { ...prev, coverImage: dataUrl } : null)
      // Notify sidebar so the thumbnail refreshes immediately.
      window.dispatchEvent(new CustomEvent('page-title-updated'))
    } catch (err) {
      console.error('uploadCover failed', err)
      alert(err instanceof Error ? err.message : 'Could not upload cover image.')
    }
  }

  async function removeCover() {
    if (!page?.id) return
    await db.pages.update(page.id, { coverImage: null, coverPosition: null, updatedAt: new Date().toISOString() })
    setPage(prev => prev ? { ...prev, coverImage: null, coverPosition: null } : null)
    window.dispatchEvent(new CustomEvent('page-title-updated'))
  }

  function startReposition() {
    setRepositioning(true)
    setDragPosition(page?.coverPosition ?? 50)
  }
  function cancelReposition() {
    setRepositioning(false)
    setDragPosition(null)
    dragStartRef.current = null
  }
  async function saveReposition() {
    if (!page?.id || dragPosition == null) return
    await db.pages.update(page.id, {
      coverPosition: dragPosition,
      updatedAt: new Date().toISOString(),
    })
    setPage(prev => prev ? { ...prev, coverPosition: dragPosition } : null)
    setRepositioning(false)
    setDragPosition(null)
    dragStartRef.current = null
    // Sidebar thumbnail uses coverPosition for crop — refresh it.
    window.dispatchEvent(new CustomEvent('page-title-updated'))
  }
  function onCoverMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!repositioning) return
    e.preventDefault()
    dragStartRef.current = { y: e.clientY, startPos: dragPosition ?? 50 }
    function onMove(ev: MouseEvent) {
      if (!dragStartRef.current) return
      const dy = ev.clientY - dragStartRef.current.y
      // Map pixel delta to percent: each cover-height drag = 100% travel.
      // Drag DOWN (positive dy) → focus shifts UP in image (lower position).
      const next = Math.max(0, Math.min(100,
        dragStartRef.current.startPos - (dy / COVER_HEIGHT) * 100
      ))
      setDragPosition(next)
    }
    function onUp() {
      dragStartRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  // Effective position = live drag preview when repositioning, else saved.
  const effectiveCoverPos = repositioning && dragPosition != null
    ? dragPosition
    : (page?.coverPosition ?? 50)

  // Esc cancels cover reposition mode. Separate effect (not folded into
  // the F-key handler above) because that one runs before `repositioning`
  // is declared — folding causes a TDZ error.
  useEffect(() => {
    if (!repositioning) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelReposition()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositioning])

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-tertiary)' }}>Loading...</div>
  if (!page) return <div style={{ padding: '40px', color: 'var(--text-tertiary)' }}>Page not found</div>

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg-primary)', position: 'relative' }}>
      {/* Focus-mode toggle — floats inside the page content (top-right of
          the editor's max-width column, not the viewport edge) so it never
          collides with the right rail's edge tab. Press F to toggle. */}
      <button
        onClick={toggleFocus}
        data-no-sculpt
        title={focusMode ? 'Exit focus mode (F)' : 'Focus mode — hide header (F)'}
        aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
        style={{
          position: 'absolute',
          top: '16px', right: '16px',
          zIndex: 5,
          padding: '4px 10px', height: '28px',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          background: focusMode ? 'var(--accent)' : 'var(--bg-primary)',
          color: focusMode ? '#fff' : 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
          fontSize: '11px', fontWeight: 600,
        }}
      >
        <span aria-hidden style={{ fontSize: '13px' }}>{focusMode ? '✕' : '⛶'}</span>
        <span>{focusMode ? 'Exit focus' : 'Focus'}</span>
      </button>

      {/* Cover image banner — Notion-style. Sits OUTSIDE the page-shell so
          it stretches to fill the main content area, not the 720px column.
          Hidden in focus mode and when no cover is set. In reposition mode
          the cover acts as a draggable surface that updates the focal point
          in real time. */}
      {!focusMode && page.coverImage && (
        <div
          onMouseEnter={() => setCoverHovered(true)}
          onMouseLeave={() => setCoverHovered(false)}
          onMouseDown={onCoverMouseDown}
          style={{
            position: 'relative',
            width: '100%', height: `${COVER_HEIGHT}px`,
            backgroundImage: `url('${page.coverImage}')`,
            backgroundSize: 'cover',
            backgroundPosition: `center ${effectiveCoverPos}%`,
            backgroundRepeat: 'no-repeat',
            marginBottom: '24px',
            cursor: repositioning ? (dragStartRef.current ? 'grabbing' : 'grab') : 'default',
            userSelect: repositioning ? 'none' : 'auto',
          }}
          data-no-sculpt
        >
          {/* Bottom-centre hint while repositioning */}
          {repositioning && (
            <div style={{
              position: 'absolute', bottom: '12px', left: '50%',
              transform: 'translateX(-50%)',
              padding: '4px 12px', borderRadius: '9999px',
              background: 'rgba(0,0,0,0.6)', color: '#fff',
              fontSize: '11px', fontWeight: 600,
              pointerEvents: 'none',
            }}>
              Drag image to reposition · {Math.round(effectiveCoverPos)}%
            </div>
          )}
          {/* Action tray — switches modes between idle and repositioning.
              Always visible while repositioning so the user can confirm
              or cancel; hover-revealed otherwise. Right offset leaves
              clearance for the Focus button which lives in the outer
              scroll container at right:16px. */}
          <div
            style={{
              position: 'absolute', top: '12px', right: '110px',
              display: 'flex', gap: '6px',
              opacity: (coverHovered || repositioning) ? 1 : 0,
              transition: 'opacity 150ms ease',
              pointerEvents: (coverHovered || repositioning) ? 'auto' : 'none',
            }}
          >
            {repositioning ? (
              <>
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={saveReposition}
                  style={{
                    padding: '4px 10px', borderRadius: '6px',
                    background: 'var(--accent)', color: '#fff',
                    border: 'none', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >Save position</button>
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={cancelReposition}
                  style={{
                    padding: '4px 10px', borderRadius: '6px',
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                    border: 'none', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >Cancel</button>
              </>
            ) : (
              <>
                <button
                  onClick={() => coverInputRef.current?.click()}
                  style={{
                    padding: '4px 10px', borderRadius: '6px',
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                    border: 'none', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >Change cover</button>
                <button
                  onClick={startReposition}
                  style={{
                    padding: '4px 10px', borderRadius: '6px',
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                    border: 'none', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >Reposition</button>
                <button
                  onClick={removeCover}
                  style={{
                    padding: '4px 10px', borderRadius: '6px',
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                    border: 'none', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >Remove</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input shared by the cover banner + "Add cover" button */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) uploadCover(f)
          e.target.value = ''
        }}
      />

      <div className="page-shell" style={{
        maxWidth: focusMode ? '760px' : '720px',
        margin: '0 auto',
        paddingTop: focusMode ? '40px' : undefined,
      }}>
        {!focusMode && (
        <>
        {/* "+ Add cover" affordance — only shown when there's no cover yet.
            Sits subtly above the title row; one click opens the file picker. */}
        {!page.coverImage && (
          <button
            onClick={() => coverInputRef.current?.click()}
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--text-tertiary)', fontSize: '12px',
              cursor: 'pointer', padding: '4px 0', marginBottom: '8px',
            }}
            onMouseEnter={e => { (e.currentTarget).style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-tertiary)' }}
          >
            + Add cover
          </button>
        )}
        <div data-flat style={{ marginBottom: '16px', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '12px',
            padding: '12px 16px',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: '14px',
            width: '100%', boxSizing: 'border-box',
          }}>
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              style={{
                fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px', lineHeight: 1, flexShrink: 0, borderRadius: '8px',
              }}
              onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}
            >{page.icon || '📄'}</button>
            <input
              defaultValue={page.title}
              onChange={e => updateTitle(e.target.value)}
              placeholder="Untitled"
              style={{
                fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.3,
                border: 'none', outline: 'none', background: 'transparent',
                boxShadow: 'none', padding: 0, flex: 1,
                color: 'var(--text-primary)', fontFamily: 'inherit', margin: 0,
              }}
            />
          </div>
          {showIconPicker && (
            <>
              <div onClick={() => setShowIconPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
              <div style={{
                position: 'absolute', marginTop: '8px', zIndex: 1000,
                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-base, 10px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                padding: '16px', minWidth: '280px', overflow: 'hidden',
              }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Choose icon</div>
                <div data-flat style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 44px)', gap: '8px', justifyContent: 'center' }}>
                  {['📄','📝','📋','📌','📎','📊','🏠','🎯','🚀','💡','🔥','⭐','💪','🎉','📅','💰','🔔','💬','📖','🧠','❤️','✅','🎨','🔍','⚡','🌈','🎵','☕','🌿','🗂️'].map(emoji => (
                    <button key={emoji} onClick={async () => {
                      if (page?.id) { await db.pages.update(page.id, { icon: emoji }); setPage(prev => prev ? { ...prev, icon: emoji } : null); window.dispatchEvent(new CustomEvent('page-title-updated')) }
                      setShowIconPicker(false)
                    }} style={{
                      width: '36px', height: '36px', fontSize: '18px', border: 'none', flexShrink: 0,
                      background: page.icon === emoji ? 'var(--accent-light)' : 'transparent',
                      cursor: 'pointer', borderRadius: '8px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                    onMouseEnter={e => { if (page.icon !== emoji) (e.currentTarget).style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (page.icon !== emoji) (e.currentTarget).style.background = 'transparent' }}
                    >{emoji}</button>
                  ))}
                </div>
                <button onClick={async () => {
                  if (page?.id) { await db.pages.update(page.id, { icon: null }); setPage(prev => prev ? { ...prev, icon: null } : null); window.dispatchEvent(new CustomEvent('page-title-updated')) }
                  setShowIconPicker(false)
                }} style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>Remove icon</button>
              </div>
            </>
          )}
        </div>
        <div data-flat style={{ display: 'flex', gap: '6px', marginBottom: '16px', alignItems: 'center' }}>
          {/* Per-page view tabs reduced to Page + Canvas. Kanban and
              Calendar showed GLOBAL data while keeping the page's title in
              the header — misleading mental model. Use /board and
              /calendar routes for the global views instead. */}
          {(['page', 'canvas'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{
                padding: '5px 14px', borderRadius: '9999px',
                border: view === v ? 'none' : '1px solid var(--border)',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                background: view === v ? 'var(--accent)' : 'transparent',
                color: view === v ? 'white' : 'var(--text-tertiary)',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { if (view !== v) (e.currentTarget).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (view !== v) (e.currentTarget).style.background = 'transparent' }}
            >
              {v === 'page' ? 'Page' : 'Canvas'}
            </button>
          ))}
          <button
            onClick={() => exportPageToMarkdown(uid, page?.title ?? '')}
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            Export .md
          </button>
        </div>
        </>
        )}
      </div>
      {view === 'board' ? (
        <BoardView pageUid={uid} />
      ) : view === 'calendar' ? (
        <CalendarView pageUid={uid} />
      ) : view === 'canvas' ? (
        <CanvasView pageUid={uid} />
      ) : (
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 80px 120px' }}>
          {editorContent && (
            <FluentEditor pageUid={uid} initialContent={editorContent} />
          )}
        </div>
      )}
    </div>
  )
}

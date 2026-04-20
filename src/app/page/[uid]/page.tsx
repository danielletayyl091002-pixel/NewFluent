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

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-tertiary)' }}>Loading...</div>
  if (!page) return <div style={{ padding: '40px', color: 'var(--text-tertiary)' }}>Page not found</div>

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div className="page-shell" style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Page title — emoji + title in one bubble */}
        <div data-flat style={{ marginBottom: '16px', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '14px',
            padding: '10px 24px 10px 16px',
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
                boxShadow: 'none', padding: '4px 16px 4px 24px', flex: 1,
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
          {(['page', 'board', 'calendar', 'canvas'] as const).map(v => (
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
              {v === 'page' ? 'Page' : v === 'board' ? 'Kanban' : v === 'calendar' ? 'Calendar' : 'Canvas'}
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

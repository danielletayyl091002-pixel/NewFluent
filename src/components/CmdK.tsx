'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { db, Page, Block } from '@/db/schema'
import { nanoid } from 'nanoid'
import { TEMPLATES } from '@/lib/templates'
import { usePagesStore } from '@/stores/pages'

// Cross-app search result. Each row has a type, label, optional secondary
// caption, and a route to push when activated. Type drives the icon/label
// in the results list (per Adobe/Stripe command-palette pattern: source
// labeling makes results scannable).
type SearchResult =
  | { kind: 'page'; uid: string; title: string; icon: string | null }
  | { kind: 'task'; uid: string; pageUid: string; title: string }
  | { kind: 'tracker'; uid: string; name: string }
  | { kind: 'finance'; id: number; note: string; amount: number; type: 'income' | 'expense' }

interface CmdKProps {
  onPageCreated?: () => void
}

export default function CmdK({ onPageCreated }: CmdKProps = {}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')
  const inputRef = useRef<HTMLInputElement>(null)
  const creatingRef = useRef(false)
  const createPageInStore = usePagesStore(s => s.createPage)
  const refreshPagesStore = usePagesStore(s => s.refresh)

  const quickActions = [
    { label: 'New Page', action: 'new-page', group: 'Actions' },
    { label: theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode', action: 'toggle-theme', group: 'Actions' },
    { label: timeFormat === '12h' ? 'Switch to 24-hour Time' : 'Switch to 12-hour Time', action: 'toggle-time-format', group: 'Actions' },
    { label: 'Go to Finance', action: 'finance', group: 'Navigate' },
    { label: 'Go to Kanban', action: 'board', group: 'Navigate' },
    ...TEMPLATES.map(t => ({ label: t.name, action: `template:${t.name}`, group: 'Templates' })),
  ]

  const totalItems = query.trim() === '' ? quickActions.length : results.length

  // Activate a result row (Enter or click). Routing is type-aware.
  // Declared early so the keyboard effect closure can capture it.
  const activateResult = useCallback((r: SearchResult) => {
    if (r.kind === 'page') router.push(`/page/${r.uid}`)
    else if (r.kind === 'task') router.push(r.pageUid ? `/page/${r.pageUid}` : '/board')
    else if (r.kind === 'tracker') router.push(`/trackers/${r.uid}`)
    else if (r.kind === 'finance') router.push('/finance')
  }, [router])

  function close() {
    setOpen(false)
    setQuery('')
    setResults([])
    setSelectedIndex(0)
  }

  const handleQuickAction = useCallback(async (action: string) => {
    if (action === 'new-page') {
      if (creatingRef.current) return
      creatingRef.current = true
      try {
        const page = await createPageInStore()
        onPageCreated?.()
        router.push(`/page/${page.uid}`)
      } finally {
        creatingRef.current = false
      }
    } else if (action === 'toggle-theme') {
      const prev = theme
      const next = theme === 'light' ? 'dark' : 'light'
      setTheme(next)
      localStorage.setItem('theme', next)
      document.documentElement.setAttribute('data-theme', next)
      window.dispatchEvent(new CustomEvent('theme-changed', { detail: next }))
      window.dispatchEvent(new CustomEvent('fluent-theme-changed', { detail: { theme: next } }))
      try {
        await db.settings.where('key').equals('theme').modify({ value: next })
      } catch (err) {
        console.error('CmdK: failed to persist theme, reverting', err)
        setTheme(prev)
        localStorage.setItem('theme', prev)
        document.documentElement.setAttribute('data-theme', prev)
        window.dispatchEvent(new CustomEvent('theme-changed', { detail: prev }))
      }
    } else if (action === 'toggle-time-format') {
      const next = timeFormat === '12h' ? '24h' : '12h'
      setTimeFormat(next)
      localStorage.setItem('time_format', next)
      // Notify other tabs / live components.
      window.dispatchEvent(new CustomEvent('time-format-changed', { detail: next }))
    } else if (action === 'finance') {
      router.push('/finance')
    } else if (action === 'board') {
      router.push('/board')
    } else if (action.startsWith('template:')) {
      const templateName = action.slice('template:'.length)
      const template = TEMPLATES.find(t => t.name === templateName)
      if (!template) return
      const uid = nanoid()
      try {
        await db.transaction('rw', db.pages, db.blocks, async () => {
          const blocksToAdd: Block[] = template.blocks.map((b, i) => ({
            uid: nanoid(), pageUid: uid, type: b.type as Block['type'],
            content: b.content, checked: false, order: i,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          }))
          await db.blocks.bulkAdd(blocksToAdd)
        })
        // createPageInStore handles the page row + store update
        await createPageInStore({ uid, title: template.name })
      } catch (err) {
        console.error('CmdK: failed to create from template', err)
        alert('Could not create page from template. Please try again.')
        await refreshPagesStore()
        return
      }
      onPageCreated?.()
      router.push(`/page/${uid}`)
    }
  }, [theme, router, onPageCreated])

  // Mount: read theme, register keydown
  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light'
    setTheme(saved as 'light' | 'dark')
    const savedTimeFormat = localStorage.getItem('time_format') || '12h'
    setTimeFormat(savedTimeFormat as '12h' | '24h')

    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)

    // Cross-tab theme sync via native StorageEvent + same-tab via custom event.
    function onStorage(e: StorageEvent) {
      if (e.key === 'theme' && e.newValue) setTheme(e.newValue as 'light' | 'dark')
      if (e.key === 'time_format' && e.newValue) setTimeFormat(e.newValue as '12h' | '24h')
    }
    function onThemeChange() {
      const t = (localStorage.getItem('theme') || 'light') as 'light' | 'dark'
      setTheme(t)
    }
    function onTimeFormatChange() {
      const t = (localStorage.getItem('time_format') || '12h') as '12h' | '24h'
      setTimeFormat(t)
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('theme-changed', onThemeChange)
    window.addEventListener('time-format-changed', onTimeFormatChange)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('theme-changed', onThemeChange)
      window.removeEventListener('time-format-changed', onTimeFormatChange)
    }
  }, [])

  // Navigation keys when open
  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Escape') {
        close()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (query.trim() === '') {
          const action = quickActions[selectedIndex]
          if (action) {
            handleQuickAction(action.action)
            close()
          }
        } else {
          const r = results[selectedIndex]
          if (r) {
            activateResult(r)
            close()
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, totalItems, selectedIndex, query, quickActions, results, handleQuickAction, router, activateResult])

  // Focus input when opened, and re-sync theme label from localStorage
  // (theme may have been toggled by the sidebar since last read).
  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem('theme') || 'light'
      setTheme(saved as 'light' | 'dark')
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  // Search with debounce — cross-app: pages, tasks, trackers, finance.
  // Each source returns its own SearchResult shape so the renderer can
  // tag and route each row distinctly (Adobe/Stripe-style cross-product
  // search with source labeling).
  useEffect(() => {
    if (!open) return
    const timeout = setTimeout(async () => {
      const q = query.trim().toLowerCase()
      if (q === '') {
        setResults([])
        setSelectedIndex(0)
        return
      }
      const [pages, tasks, trackers, finance] = await Promise.all([
        db.pages.filter(p => !p.inTrash && (p.title || '').toLowerCase().includes(q)).limit(6).toArray(),
        db.tasks.filter(t => (t.title || '').toLowerCase().includes(q)).limit(6).toArray(),
        db.trackerDefinitions.filter(t => (t.name || '').toLowerCase().includes(q)).limit(4).toArray(),
        db.financeEntries.filter(e => (e.note || '').toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q)).limit(4).toArray(),
      ])
      const merged: SearchResult[] = [
        ...pages.map(p => ({ kind: 'page' as const, uid: p.uid, title: p.title || 'Untitled', icon: p.icon })),
        ...tasks.map(t => ({ kind: 'task' as const, uid: t.uid, pageUid: t.pageUid, title: t.title || 'Untitled task' })),
        ...trackers.map(t => ({ kind: 'tracker' as const, uid: t.uid, name: t.name })),
        ...finance.filter(e => e.id != null).map(e => ({ kind: 'finance' as const, id: e.id!, note: e.note || e.category, amount: e.amount, type: e.type })),
      ]
      setResults(merged)
      setSelectedIndex(0)
    }, 150)
    return () => clearTimeout(timeout)
  }, [query, open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '20%', left: '50%',
        transform: 'translateX(-50%)',
        width: '560px',
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        zIndex: 1001,
        overflow: 'hidden'
      }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search pages or type a command..."
          style={{
            width: '100%',
            padding: '16px 20px',
            fontSize: '15px',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-primary)',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />

        {/* Results / Actions */}
        <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
          {query.trim() === '' ? (
            (() => {
              const groups = Array.from(new Set(quickActions.map(a => a.group)))
              let globalIdx = 0
              return groups.map(group => (
                <div key={group}>
                  <div style={{
                    fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--text-tertiary)',
                    padding: '8px 20px 4px'
                  }}>{group}</div>
                  {quickActions.filter(a => a.group === group).map(a => {
                    const idx = globalIdx++
                    return (
                      <div
                        key={a.action}
                        onClick={() => { handleQuickAction(a.action); close() }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        style={{
                          padding: '8px 20px',
                          fontSize: '14px',
                          cursor: 'pointer',
                          color: 'var(--text-secondary)',
                          background: selectedIndex === idx ? 'var(--bg-hover)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span>{a.label}</span>
                      </div>
                    )
                  })}
                </div>
              ))
            })()
          ) : results.length > 0 ? (
            (() => {
              // Group results by kind so the user scans by type
              const groups: { kind: SearchResult['kind']; label: string; items: SearchResult[] }[] = [
                { kind: 'page',    label: 'Pages',    items: results.filter(r => r.kind === 'page') },
                { kind: 'task',    label: 'Tasks',    items: results.filter(r => r.kind === 'task') },
                { kind: 'tracker', label: 'Trackers', items: results.filter(r => r.kind === 'tracker') },
                { kind: 'finance', label: 'Finance',  items: results.filter(r => r.kind === 'finance') },
              ].filter(g => g.items.length > 0)
              let idx = 0
              return groups.map(g => (
                <div key={g.kind}>
                  <div style={{
                    fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--text-tertiary)',
                    padding: '8px 20px 4px',
                  }}>{g.label}</div>
                  {g.items.map(r => {
                    const i = idx++
                    const key = r.kind + ':' + ('uid' in r ? r.uid : r.id)
                    return (
                      <div
                        key={key}
                        onClick={() => { activateResult(r); close() }}
                        onMouseEnter={() => setSelectedIndex(i)}
                        style={{
                          padding: '10px 20px', fontSize: '14px', cursor: 'pointer',
                          color: 'var(--text-primary)',
                          background: selectedIndex === i ? 'var(--bg-hover)' : 'transparent',
                          display: 'flex', alignItems: 'center', gap: '10px',
                        }}
                      >
                        <ResultIcon kind={r.kind} icon={r.kind === 'page' ? r.icon : null} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.kind === 'page' && r.title}
                          {r.kind === 'task' && r.title}
                          {r.kind === 'tracker' && r.name}
                          {r.kind === 'finance' && (r.note || '(no note)')}
                        </span>
                        {r.kind === 'finance' && (
                          <span style={{
                            fontSize: '12px', fontVariantNumeric: 'tabular-nums',
                            color: r.type === 'income' ? '#10B981' : '#EF4444',
                          }}>
                            {r.type === 'income' ? '+' : '−'}{r.amount.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            })()
          ) : (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: '14px'
            }}>
              No matches across pages, tasks, trackers, or finance
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 20px',
          borderTop: '1px solid var(--border)',
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          display: 'flex',
          gap: '16px'
        }}>
          <span>Enter to select</span>
          <span>Esc to close</span>
          <span>Up/Down to navigate</span>
        </div>
      </div>
    </>
  )
}

function ResultIcon({ kind, icon }: { kind: 'page' | 'task' | 'tracker' | 'finance'; icon?: string | null }) {
  if (kind === 'page') {
    return <span style={{ width: '18px', textAlign: 'center', opacity: 0.85 }}>{icon || '📄'}</span>
  }
  const map: Record<typeof kind, { glyph: string; color: string }> = {
    page:    { glyph: '📄', color: 'var(--text-tertiary)' },
    task:    { glyph: '☐',  color: 'var(--text-tertiary)' },
    tracker: { glyph: '◯',  color: 'var(--text-tertiary)' },
    finance: { glyph: '$',  color: 'var(--text-tertiary)' },
  }
  const { glyph, color } = map[kind]
  return (
    <span style={{
      width: '18px', height: '18px', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', color, borderRadius: '4px',
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    }}>{glyph}</span>
  )
}

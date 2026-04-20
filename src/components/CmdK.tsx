'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { db, Page, Block } from '@/db/schema'
import { nanoid } from 'nanoid'
import { TEMPLATES } from '@/lib/templates'
import { usePagesStore } from '@/stores/pages'

interface CmdKProps {
  onPageCreated?: () => void
}

export default function CmdK({ onPageCreated }: CmdKProps = {}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Page[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const inputRef = useRef<HTMLInputElement>(null)
  const creatingRef = useRef(false)
  const createPageInStore = usePagesStore(s => s.createPage)
  const refreshPagesStore = usePagesStore(s => s.refresh)

  const quickActions = [
    { label: 'New Page', action: 'new-page', group: 'Actions' },
    { label: theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode', action: 'toggle-theme', group: 'Actions' },
    { label: 'Go to Finance', action: 'finance', group: 'Navigate' },
    { label: 'Go to Kanban', action: 'board', group: 'Navigate' },
    ...TEMPLATES.map(t => ({ label: t.name, action: `template:${t.name}`, group: 'Templates' })),
  ]

  const totalItems = query.trim() === '' ? quickActions.length : results.length

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
      try {
        await db.settings.where('key').equals('theme').modify({ value: next })
      } catch (err) {
        console.error('CmdK: failed to persist theme, reverting', err)
        setTheme(prev)
        localStorage.setItem('theme', prev)
        document.documentElement.setAttribute('data-theme', prev)
      }
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

    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)

    // Cross-tab theme sync via native StorageEvent.
    function onStorage(e: StorageEvent) {
      if (e.key === 'theme' && e.newValue) {
        setTheme(e.newValue as 'light' | 'dark')
      }
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('storage', onStorage)
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
          const page = results[selectedIndex]
          if (page) {
            router.push(`/page/${page.uid}`)
            close()
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, totalItems, selectedIndex, query, quickActions, results, handleQuickAction, router])

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

  // Search with debounce
  useEffect(() => {
    if (!open) return
    const timeout = setTimeout(async () => {
      if (query.trim() === '') {
        setResults([])
      } else {
        const pages = await db.pages
          .filter(p => !p.inTrash && p.title.toLowerCase().includes(query.trim().toLowerCase()))
          .limit(8)
          .toArray()
        setResults(pages)
      }
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
            results.map((p, i) => (
              <div
                key={p.uid}
                onClick={() => { router.push(`/page/${p.uid}`); close() }}
                onMouseEnter={() => setSelectedIndex(i)}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  background: selectedIndex === i ? 'var(--bg-hover)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {p.icon && <span>{p.icon}</span>}
                <span>{p.title || 'Untitled'}</span>
              </div>
            ))
          ) : (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: '14px'
            }}>
              No pages found
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

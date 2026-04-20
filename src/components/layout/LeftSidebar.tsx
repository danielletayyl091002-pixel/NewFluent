'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { db, Page, seedIfEmpty } from '@/db/schema'
import { safeDbWrite } from '@/lib/dbError'
import { usePagesStore } from '@/stores/pages'

interface LeftSidebarProps {
  collapsed: boolean
  toggleLeft: () => void
  refreshKey?: number
  onNavigate?: () => void
}

export default function LeftSidebar({ collapsed, toggleLeft, refreshKey = 0, onNavigate }: LeftSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  // User-triggered navigation — also closes the mobile overlay if the
  // parent passed onNavigate. The init-time home redirect uses
  // router.replace directly and is intentionally excluded.
  const navigateTo = (path: string) => {
    router.push(path)
    onNavigate?.()
  }
  const pages = usePagesStore(s => s.pages)
  const loadPagesStore = usePagesStore(s => s.load)
  const refreshPages = usePagesStore(s => s.refresh)
  const createPageInStore = usePagesStore(s => s.createPage)
  const deletePageInStore = usePagesStore(s => s.deletePage)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  // Mount-only: seed and load pages into the store. The store is the
  // single source of truth — mutations from CmdK / QuickCapture / etc.
  // update it directly so the sidebar re-renders without re-fetching.
  useEffect(() => {
    async function init() {
      await seedIfEmpty()
      await loadPagesStore()
      setLoading(false)
    }
    init()
  }, [loadPagesStore])

  // Home redirect: when the user lands on or navigates to '/', send them
  // to their configured home page.
  useEffect(() => {
    if (pathname !== '/') return
    db.settings.where('key').equals('homePageUid').first().then(s => {
      if (s?.value) router.replace(`/page/${s.value}`)
    })
  }, [pathname, router])

  // Prop-driven refresh kept for legacy callers that may bump refreshKey.
  useEffect(() => {
    if (refreshKey === 0) return
    refreshPages()
  }, [refreshKey, refreshPages])

  // Page edits in the editor still dispatch these events; relay to the store.
  useEffect(() => {
    window.addEventListener('page-title-updated', refreshPages)
    window.addEventListener('page-created', refreshPages)
    return () => {
      window.removeEventListener('page-title-updated', refreshPages)
      window.removeEventListener('page-created', refreshPages)
    }
  }, [refreshPages])

  let creating = false
  async function createPage(parentUid: string | null = null) {
    if (creating) return
    creating = true
    try {
      const page = await createPageInStore({ parentUid })
      if (parentUid) {
        setExpanded(prev => new Set([...prev, parentUid]))
      }
      navigateTo(`/page/${page.uid}`)
    } finally {
      creating = false
    }
  }

  function toggleExpanded(uid: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  // Build tree
  const rootPages = pages.filter(p => !p.parentUid)
  const favorites = rootPages.filter(p => p.isFavorite)
  const regular = rootPages.filter(p => !p.isFavorite)

  function getChildren(parentUid: string): Page[] {
    return pages.filter(p => p.parentUid === parentUid)
  }

  function renderPageTree(page: Page, depth: number = 0): React.ReactNode {
    const children = getChildren(page.uid)
    const hasChildren = children.length > 0
    const isExpanded = expanded.has(page.uid)
    const isActive = pathname === `/page/${page.uid}`

    return (
      <div key={page.uid}>
        <PageItem
          page={page}
          active={isActive}
          depth={depth}
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          onToggle={() => toggleExpanded(page.uid)}
          onClick={() => navigateTo(`/page/${page.uid}`)}
          onAddChild={() => createPage(page.uid)}
          onDelete={async () => {
            await safeDbWrite(
              () => deletePageInStore(page.uid),
              'Failed to delete page. Please try again.'
            )
          }}
        />
        {hasChildren && isExpanded && (
          <div>
            {children.map(child => renderPageTree(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside style={{
      width: collapsed ? '64px' : '220px',
      minWidth: collapsed ? '64px' : '220px',
      height: '100vh',
      borderRight: '1px solid var(--border)',
      background: 'var(--bg-sidebar)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width 200ms ease-in-out, min-width 200ms ease-in-out',
    }}>
      <div style={{
        height: '48px',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '0' : '0 16px',
        borderBottom: '1px solid var(--border)',
        fontWeight: 700, fontSize: '15px',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}>
        <span style={{
          opacity: collapsed ? 0 : 1,
          width: collapsed ? 0 : 'auto',
          overflow: 'hidden',
          pointerEvents: collapsed ? 'none' : 'auto',
          whiteSpace: 'nowrap',
          transition: 'opacity 150ms ease-in-out, width 200ms ease-in-out',
        }}>
          Fluent
        </span>
        {toggleLeft && (
          <button
            onClick={toggleLeft}
            aria-label={collapsed ? 'Expand left sidebar' : 'Hide left sidebar'}
            style={{
              marginLeft: collapsed ? 0 : 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      <div style={{
        padding: '8px',
        opacity: collapsed ? 0 : 1,
        maxHeight: collapsed ? 0 : '200px',
        overflow: 'hidden',
        pointerEvents: collapsed ? 'none' : 'auto',
        transition: 'opacity 150ms ease-in-out, max-height 200ms ease-in-out, padding 200ms ease-in-out',
        paddingTop: collapsed ? 0 : '8px',
        paddingBottom: collapsed ? 0 : '8px',
      }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search pages..."
          style={{
            width: '100%', padding: '5px 10px', marginBottom: '4px',
            borderRadius: 'var(--radius-base, 6px)', border: '1px solid var(--border)',
            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            fontSize: '12px', outline: 'none', boxSizing: 'border-box',
            display: searchQuery || pages.length > 5 ? 'block' : 'none',
          }}
        />
        <button
          onClick={() => createPage(null)}
          style={{
            width: '100%', padding: '6px 12px',
            borderRadius: 'var(--radius-base, 8px)', border: 'none',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            fontSize: '13px', cursor: 'pointer',
            textAlign: 'left',
            display: 'flex', alignItems: 'center', gap: '6px',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          + New page
        </button>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 8px',
        opacity: collapsed ? 0 : 1,
        pointerEvents: collapsed ? 'none' : 'auto',
        transition: 'opacity 150ms ease-in-out',
      }}>
        {!loading && favorites.length > 0 && (
          <>
            <SectionLabel onClick={() => setCollapsedSections(prev => { const n = new Set(prev); n.has('fav') ? n.delete('fav') : n.add('fav'); return n })} collapsed={collapsedSections.has('fav')}>Favorites</SectionLabel>
            {!collapsedSections.has('fav') && favorites.filter(p => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase())).map(p => renderPageTree(p, 0))}
          </>
        )}
        {!loading && regular.length > 0 && (
          <>
            <SectionLabel onClick={() => setCollapsedSections(prev => { const n = new Set(prev); n.has('priv') ? n.delete('priv') : n.add('priv'); return n })} collapsed={collapsedSections.has('priv')}>Private</SectionLabel>
            {!collapsedSections.has('priv') && regular.filter(p => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase())).map(p => renderPageTree(p, 0))}
          </>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '8px' }}>
        <NavLink itemId="trackers" collapsed={collapsed} hoveredItem={hoveredItem} setHoveredItem={setHoveredItem} onClick={() => navigateTo('/trackers')} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}>Trackers</NavLink>
        <NavLink itemId="finance" collapsed={collapsed} hoveredItem={hoveredItem} setHoveredItem={setHoveredItem} onClick={() => navigateTo('/finance')} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}>Finance</NavLink>
        <NavLink itemId="kanban" collapsed={collapsed} hoveredItem={hoveredItem} setHoveredItem={setHoveredItem} onClick={() => navigateTo('/board')} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}>Kanban</NavLink>
        <NavLink itemId="settings" collapsed={collapsed} hoveredItem={hoveredItem} setHoveredItem={setHoveredItem} onClick={() => navigateTo('/settings')} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>}>Settings</NavLink>
        <ThemeToggle collapsed={collapsed} hoveredItem={hoveredItem} setHoveredItem={setHoveredItem} />
      </div>
      <style>{`
        .page-item-actions { display: none; }
        .page-item:hover .page-item-actions { display: flex; }
        .page-item:hover { background: var(--bg-hover); }
        .page-item.active { background: var(--accent-light) !important; color: var(--accent) !important; }
      `}</style>
    </aside>
  )
}

function SectionLabel({ children, onClick, collapsed }: { children: React.ReactNode; onClick?: () => void; collapsed?: boolean }) {
  return (
    <div onClick={onClick} style={{
      fontSize: '11px', fontWeight: 600,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--text-secondary)',
      padding: '8px 8px 4px',
      cursor: onClick ? 'pointer' : 'default',
      display: 'flex', alignItems: 'center', gap: '4px',
      userSelect: 'none',
    }}>
      {onClick && <span style={{ fontSize: '8px', transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }}>{'\u25B6'}</span>}
      {children}
    </div>
  )
}

function PageItem({ page, active, depth, hasChildren, isExpanded, onToggle, onClick, onAddChild, onDelete }: {
  page: Page
  active: boolean
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  onToggle: () => void
  onClick: () => void
  onAddChild: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={'page-item' + (active ? ' active' : '')}
      style={{
        display: 'flex', alignItems: 'center',
        position: 'relative',
        borderRadius: 'var(--radius-sm, 6px)', marginBottom: '1px',
        paddingLeft: depth > 0 ? '8px' : '12px',
        borderLeft: depth > 0 ? '1px solid var(--border)' : 'none',
        marginLeft: depth > 0 ? '20px' : '0'
      }}
    >
      {/* Expand/collapse arrow */}
      <button
        onClick={e => { e.stopPropagation(); onToggle() }}
        style={{
          background: 'none', border: 'none',
          padding: '2px', cursor: 'pointer',
          color: 'var(--text-tertiary)',
          flexShrink: 0, width: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hasChildren ? 1 : 0,
          pointerEvents: hasChildren ? 'auto' : 'none',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s'
        }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
          <path d="M2 1l4 3-4 3V1z"/>
        </svg>
      </button>

      {/* Page title */}
      <div
        onClick={onClick}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 4px', borderRadius: 'var(--radius-sm, 6px)',
          cursor: 'pointer', fontSize: '13px',
          color: active ? 'var(--accent)' : 'var(--text-primary)'
        }}
      >
        {page.icon ? (
          <span style={{ fontSize: '14px', flexShrink: 0, lineHeight: 1 }}>{page.icon}</span>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: 'var(--text-tertiary)' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
        )}
        <span style={{
          flex: 1, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {page.title || 'Untitled'}
        </span>
      </div>

      {/* Hover actions */}
        <div className="page-item-actions" style={{
          position: 'absolute', right: '4px',
          gap: '2px', alignItems: 'center'
        }}>
          <button
            onClick={e => { e.stopPropagation(); onAddChild() }}
            title="Add subpage"
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer', fontSize: '14px',
              padding: '2px 4px', borderRadius: 'var(--radius-xs, 4px)',
              lineHeight: 1
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
          >+</button>
          {!page.isFavorite && (
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              style={{
                background: 'none', border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer', fontSize: '14px',
                padding: '2px 4px', borderRadius: 'var(--radius-xs, 4px)',
                lineHeight: 1
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
            >x</button>
          )}
        </div>
    </div>
  )
}

function NavLink({ children, onClick, icon, itemId, collapsed, hoveredItem, setHoveredItem }: {
  children: React.ReactNode
  onClick: () => void
  icon: React.ReactNode
  itemId: string
  collapsed: boolean
  hoveredItem: string | null
  setHoveredItem: (id: string | null) => void
}) {
  const showTooltip = collapsed && hoveredItem === itemId
  return (
    <div
      onClick={onClick}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'
        setHoveredItem(itemId)
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent'
        setHoveredItem(null)
      }}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : '10px',
        padding: collapsed ? '10px 0' : '10px 16px',
        borderRadius: 'var(--radius-sm, 6px)',
        cursor: 'pointer', fontSize: '13px',
        color: 'var(--text-secondary)', marginBottom: '1px',
        transition: 'padding 200ms ease-in-out, gap 200ms ease-in-out',
      }}
    >
      <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, display: 'flex' }}>
        {icon}
      </span>
      <span style={{
        opacity: collapsed ? 0 : 1,
        width: collapsed ? 0 : 'auto',
        overflow: 'hidden',
        pointerEvents: collapsed ? 'none' : 'auto',
        whiteSpace: 'nowrap',
        transition: 'opacity 150ms ease-in-out, width 200ms ease-in-out',
      }}>
        {children}
      </span>
      <span style={{
        position: 'absolute',
        left: '72px',
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '4px 10px',
        fontSize: '12px',
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
        zIndex: 1000,
        opacity: showTooltip ? 1 : 0,
        pointerEvents: 'none',
        transition: 'opacity 0.15s',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}>
        {children}
      </span>
    </div>
  )
}

function ThemeToggle({ collapsed = false, hoveredItem, setHoveredItem }: {
  collapsed?: boolean
  hoveredItem?: string | null
  setHoveredItem?: (id: string | null) => void
}) {
  const [theme, setTheme] = useState<'light'|'dark'>('light')

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light'
    setTheme(saved as 'light'|'dark')
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  async function toggle() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
    window.dispatchEvent(new CustomEvent('fluent-theme-changed', { detail: { theme: next } }))
    db.settings.where('key').equals('theme').modify({ value: next })

    if (next === 'dark') {
      // Remove any palette bg overrides so [data-theme="dark"] CSS vars win
      document.documentElement.style.removeProperty('--bg-primary')
      document.documentElement.style.removeProperty('--bg-secondary')
      document.documentElement.style.removeProperty('--bg-sidebar')
    } else {
      // Remove dark overrides first, then apply saved tints if any
      document.documentElement.style.removeProperty('--bg-primary')
      document.documentElement.style.removeProperty('--bg-secondary')
      document.documentElement.style.removeProperty('--bg-sidebar')
      const bgPrimary = await db.settings.where('key').equals('palette_bg_primary').first()
      const bgSecondary = await db.settings.where('key').equals('palette_bg_secondary').first()
      const bgSidebar = await db.settings.where('key').equals('palette_bg_sidebar').first()
      if (bgPrimary?.value) document.documentElement.style.setProperty('--bg-primary', bgPrimary.value)
      if (bgSecondary?.value) document.documentElement.style.setProperty('--bg-secondary', bgSecondary.value)
      if (bgSidebar?.value) document.documentElement.style.setProperty('--bg-sidebar', bgSidebar.value)
    }
  }

  const label = theme === 'light' ? 'Dark mode' : 'Light mode'
  const icon = theme === 'light'
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
  const showTooltip = collapsed && hoveredItem === 'theme'
  return (
    <div
      onClick={toggle}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'
        setHoveredItem?.('theme')
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent'
        setHoveredItem?.(null)
      }}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : '10px',
        padding: collapsed ? '10px 0' : '10px 16px',
        borderRadius: 'var(--radius-sm, 6px)',
        cursor: 'pointer', fontSize: '13px',
        color: 'var(--text-secondary)', marginTop: '4px',
        transition: 'padding 200ms ease-in-out, gap 200ms ease-in-out',
      }}
    >
      <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, display: 'flex' }}>
        {icon}
      </span>
      <span style={{
        opacity: collapsed ? 0 : 1,
        width: collapsed ? 0 : 'auto',
        overflow: 'hidden',
        pointerEvents: collapsed ? 'none' : 'auto',
        whiteSpace: 'nowrap',
        transition: 'opacity 150ms ease-in-out, width 200ms ease-in-out',
      }}>
        {label}
      </span>
      <span style={{
        position: 'absolute',
        left: '72px',
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '4px 10px',
        fontSize: '12px',
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
        zIndex: 1000,
        opacity: showTooltip ? 1 : 0,
        pointerEvents: 'none',
        transition: 'opacity 0.15s',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}>
        {label}
      </span>
    </div>
  )
}

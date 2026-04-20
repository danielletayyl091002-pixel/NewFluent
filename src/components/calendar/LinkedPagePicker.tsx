'use client'
import { useEffect, useState } from 'react'
import { db, Page } from '@/db/schema'
import { safeDbWrite } from '@/lib/dbError'
import { usePagesStore } from '@/stores/pages'

export default function LinkedPagePicker({
  onSelect,
  onClose,
}: {
  onSelect: (uid: string) => void
  onClose: () => void
}) {
  const [allPages, setAllPages] = useState<Page[]>([])
  const [search, setSearch] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  const createPage = usePagesStore(s => s.createPage)

  useEffect(() => {
    db.pages.filter(p => !p.inTrash).toArray().then(setAllPages)
  }, [])

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 6000,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          width: '360px',
          maxHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
        }}
      >
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pages..."
          style={{
            padding: '12px 16px',
            fontSize: '14px',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {allPages
            .filter(p =>
              (p.title || '').toLowerCase().includes(search.toLowerCase())
            )
            .slice(0, 20)
            .map(p => (
              <div
                key={p.uid}
                onClick={() => { onSelect(p.uid); onClose() }}
                onMouseEnter={() => setHovered(p.uid)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: hovered === p.uid ? 'var(--bg-secondary)' : 'transparent',
                }}
              >
                {p.icon && <span>{p.icon}</span>}
                <span>{p.title || 'Untitled'}</span>
              </div>
            ))
          }
          <div
            onClick={async () => {
              try {
                const page = await safeDbWrite(
                  () => createPage(),
                  'Failed to save page. Please try again.'
                )
                if (page) {
                  onSelect(page.uid)
                  onClose()
                }
              } catch {
                // safeDbWrite already surfaces the error
              }
            }}
            onMouseEnter={() => setHovered('__create__')}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--accent)',
              borderTop: '0.5px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: hovered === '__create__' ? 'var(--bg-secondary)' : 'transparent',
            }}
          >
            + Create new page
          </div>
        </div>
      </div>
    </div>
  )
}

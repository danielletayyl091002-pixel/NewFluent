'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { db, Page } from '@/db/schema'

export default function LinkedPageChip({
  uid,
  onRemove,
}: {
  uid: string
  onRemove: () => void
}) {
  const [page, setPage] = useState<Page | null>(null)
  const router = useRouter()

  useEffect(() => {
    db.pages.where('uid').equals(uid).first().then(p => setPage(p ?? null))
  }, [uid])

  if (!page) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      fontSize: '12px',
      color: 'var(--text-primary)',
    }}>
      <span
        onClick={() => router.push(`/page/${uid}`)}
        style={{ cursor: 'pointer', flex: 1 }}
      >
        {page.icon ? `${page.icon} ` : ''}{page.title || 'Untitled'}
      </span>
      <button
        onClick={onRemove}
        aria-label="Remove linked page"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-tertiary)',
          fontSize: '14px',
          lineHeight: 1,
          padding: 0,
        }}
      >
        {'\u00d7'}
      </button>
    </div>
  )
}

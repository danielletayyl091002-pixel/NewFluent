'use client'
import BoardView from '@/components/views/BoardView'

export default function BoardPage() {
  return (
    <div style={{
      height: '100vh', overflowY: 'auto',
      background: 'var(--bg-secondary)'
    }}>
      <div style={{ padding: '32px 40px 0' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700,
          color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Board
        </h1>
        <p style={{ fontSize: '13px',
          color: 'var(--text-tertiary)', margin: '0 0 16px' }}>
          All tasks across all pages
        </p>
      </div>
      <BoardView pageUid="global" />
    </div>
  )
}

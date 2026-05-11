'use client'
import CalendarView from '@/components/views/CalendarView'

// Global calendar route — shows ALL events across the workspace, no
// page context. Replaces the per-page Calendar tab which inherited the
// page's title and was misleading.
export default function CalendarPage() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      height: '100vh', minHeight: 0,
      padding: '32px 32px 16px',
    }}>
      <header style={{ marginBottom: '16px' }}>
        <h1 style={{
          margin: 0, fontSize: '1.5rem', fontWeight: 700,
          color: 'var(--text-primary)',
        }}>Calendar</h1>
        <p style={{
          margin: '4px 0 0', fontSize: '13px', color: 'var(--text-tertiary)',
        }}>All events across your workspace.</p>
      </header>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <CalendarView pageUid="global" />
      </div>
    </div>
  )
}

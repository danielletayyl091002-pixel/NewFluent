'use client'
import { useEffect, useState } from 'react'
import { useUiPref } from '@/hooks/useUiPref'

// Live clock — re-renders every second on the minute boundary so seconds
// don't tick (subtle, calm). Honours the global 12h / 24h setting.
export default function ClockWidget() {
  const tf = useUiPref('time_format', '12h')
  const use24 = tf === '24h'
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    // Align first tick to the next minute boundary so the clock flips
    // cleanly on :00 rather than drifting.
    const msToNextMinute = 60_000 - (Date.now() % 60_000)
    let interval: ReturnType<typeof setInterval> | null = null
    const timeout = setTimeout(() => {
      setNow(new Date())
      interval = setInterval(() => setNow(new Date()), 60_000)
    }, msToNextMinute)
    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [])

  const hours = now.getHours()
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const display = use24
    ? `${String(hours).padStart(2, '0')}:${minutes}`
    : `${((hours % 12) || 12)}:${minutes}`
  const ampm = use24 ? '' : (hours >= 12 ? 'PM' : 'AM')
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  return (
    <WidgetShell label="TIME">
      <div style={{
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        fontSize: '32px', fontWeight: 600, lineHeight: 1,
        color: 'var(--text-primary)',
      }}>
        {display}
        {ampm && <span style={{ fontSize: '14px', marginLeft: '6px', color: 'var(--text-tertiary)' }}>{ampm}</span>}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
        {dateLabel}
      </div>
    </WidgetShell>
  )
}

// Shared widget chrome — used by all dashboard widgets so they look
// consistent. Same dimensions, same padding, same label style.
export function WidgetShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div data-card style={{
      flex: '0 0 auto', minWidth: '180px',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: '110px',
    }}>
      <div style={{
        fontSize: '10px', fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--text-tertiary)',
        marginBottom: '6px',
      }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

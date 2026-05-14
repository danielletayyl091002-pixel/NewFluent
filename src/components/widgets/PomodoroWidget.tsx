'use client'
import { useEffect, useRef, useState } from 'react'
import { WidgetShell } from './ClockWidget'
import { updateWidgetConfig, useWidgets } from '@/hooks/useWidgets'

interface Props {
  config: {
    /** Wall-clock millis when the timer will hit 0 (running). null when not running. */
    endsAt?: number | null
    /** Remaining ms captured when the user paused. null when not paused. */
    pausedRemaining?: number | null
    /** Default session length in minutes (25 = classic Pomodoro). */
    durationMin?: number
  }
}

// Pomodoro timer. State (endsAt + pausedRemaining) lives in the widget
// config so the timer survives navigation and reloads. Display ticks
// every second while running; idle/paused renders don't tick.
export default function PomodoroWidget({ config }: Props) {
  const { widgets } = useWidgets()
  const durationMin = config.durationMin ?? 25
  const durationMs = durationMin * 60 * 1000

  const isRunning = config.endsAt != null && config.pausedRemaining == null
  const isPaused = config.pausedRemaining != null

  // Tick state — only used to force re-renders while running.
  const [, setTickKey] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!isRunning) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
      return
    }
    tickRef.current = setInterval(() => setTickKey(k => k + 1), 1000)
    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    }
  }, [isRunning])

  // Compute remaining ms for the display
  let remaining: number
  if (isRunning && config.endsAt != null) {
    remaining = Math.max(0, config.endsAt - Date.now())
  } else if (isPaused) {
    remaining = config.pausedRemaining ?? durationMs
  } else {
    remaining = durationMs
  }

  // Notify on completion (once per session) — best-effort, requires user
  // permission. We use a ref so we only fire once when remaining transitions
  // from >0 to 0 within the running render path.
  const notifiedRef = useRef(false)
  useEffect(() => {
    if (isRunning && remaining === 0 && !notifiedRef.current) {
      notifiedRef.current = true
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Pomodoro complete', { body: 'Time to take a short break.' })
        }
      } catch { /* notifications unavailable */ }
    }
    if (!isRunning) notifiedRef.current = false
  }, [isRunning, remaining])

  const mm = Math.floor(remaining / 60000)
  const ss = Math.floor((remaining % 60000) / 1000)
  const display = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  const pct = 1 - (remaining / durationMs)

  async function start() {
    // If permission hasn't been asked yet, ask now (user gesture).
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } catch { /* ignore */ }
    const remainingFromState = isPaused
      ? (config.pausedRemaining ?? durationMs)
      : durationMs
    await updateWidgetConfig('pomodoro', {
      endsAt: Date.now() + remainingFromState,
      pausedRemaining: null,
    }, widgets)
  }
  async function pause() {
    if (config.endsAt == null) return
    const r = Math.max(0, config.endsAt - Date.now())
    await updateWidgetConfig('pomodoro', {
      endsAt: null,
      pausedRemaining: r,
    }, widgets)
  }
  async function reset() {
    await updateWidgetConfig('pomodoro', {
      endsAt: null,
      pausedRemaining: null,
    }, widgets)
  }

  const btnBase: React.CSSProperties = {
    padding: '4px 10px', borderRadius: '6px',
    border: '1px solid var(--border)', background: 'var(--bg-primary)',
    color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600,
    cursor: 'pointer',
  }
  const btnPrimary: React.CSSProperties = {
    ...btnBase, background: 'var(--accent)', color: '#fff', border: 'none',
  }

  return (
    <WidgetShell label="POMODORO">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <div style={{
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: '32px', fontWeight: 600, lineHeight: 1,
          color: remaining === 0 ? 'var(--accent)' : 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}>{display}</div>
      </div>
      {/* Thin progress bar that fills as time elapses */}
      <div style={{
        height: '3px', background: 'var(--bg-primary)',
        borderRadius: '999px', marginTop: '8px', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${Math.min(100, Math.max(0, pct * 100))}%`,
          background: 'var(--accent)',
          transition: 'width 1s linear',
        }} />
      </div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
        {isRunning ? (
          <button type="button" onClick={pause} style={btnPrimary}>Pause</button>
        ) : (
          <button type="button" onClick={start} style={btnPrimary}>
            {isPaused ? 'Resume' : 'Start'}
          </button>
        )}
        <button type="button" onClick={reset} style={btnBase}>Reset</button>
      </div>
    </WidgetShell>
  )
}

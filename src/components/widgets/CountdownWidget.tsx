'use client'
import { useMemo } from 'react'
import { WidgetShell } from './ClockWidget'

interface Props {
  config: { date?: string; label?: string }
}

// Days until a user-set date. The config (date + label) is edited from
// /settings → Widgets, so this component is read-only.
export default function CountdownWidget({ config }: Props) {
  const { days, dateLabel } = useMemo(() => {
    if (!config.date) return { days: null, dateLabel: '' }
    const target = new Date(config.date + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const ms = target.getTime() - today.getTime()
    const d = Math.round(ms / (1000 * 60 * 60 * 24))
    const dateLabel = target.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
    return { days: d, dateLabel }
  }, [config.date])

  const label = config.label || 'Countdown'

  if (days == null) {
    return (
      <WidgetShell label="COUNTDOWN">
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
          Set a date in <span style={{ color: 'var(--accent)' }}>Settings → Widgets</span>.
        </div>
      </WidgetShell>
    )
  }

  // Past dates: show "X days ago" so the widget still feels live.
  const isPast = days < 0
  const abs = Math.abs(days)
  const numberColor = isPast
    ? 'var(--text-tertiary)'
    : days <= 7 ? 'var(--accent)' : 'var(--text-primary)'

  return (
    <WidgetShell label="COUNTDOWN">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <div style={{
          fontSize: '32px', fontWeight: 700, lineHeight: 1,
          color: numberColor,
        }}>{abs}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {abs === 1 ? 'day' : 'days'} {isPast ? 'ago' : 'until'}
        </div>
      </div>
      <div style={{ marginTop: '4px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{dateLabel}</div>
      </div>
    </WidgetShell>
  )
}

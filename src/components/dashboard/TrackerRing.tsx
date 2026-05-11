'use client'
// Today-dashboard tracker tile. Single component, single visual language —
// applies the design rules + 60-30-10 colour theory:
//
//   60% neutral   — tile bg, section bg (uses --bg-primary / --bg-secondary)
//   30% structural — icon, name, ring track, mini-heatmap empty dots
//   10% accent    — tracker color shown ONLY on the filled ring arc,
//                   streak badge, and pinned-tile stroke
//
// Tap = 1-tap log appropriate to type. Click the name area to drill in.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { TrackerDefinition, TrackerLog } from '@/db/schema'

interface Props {
  tracker: TrackerDefinition
  todayValue: number
  weekData: number[]            // last 7 days (oldest → newest)
  logs: TrackerLog[]            // for streak calculation
  pinned: boolean
  onTap: () => void             // 1-tap log
  onDetail: () => void          // open log modal / detail
}

const SIZE = 56                 // ring diameter
const STROKE = 5
const RADIUS = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * RADIUS

export default function TrackerRing({
  tracker, todayValue, weekData, logs, pinned, onTap, onDetail,
}: Props) {
  const router = useRouter()

  // For select trackers, "progress" is current value / max option count.
  // For habit, 0 or 1. For counter/value, value/target capped at 1.
  const progress = useMemo(() => {
    if (tracker.type === 'select' && tracker.options) {
      const opts: string[] = (() => { try { return JSON.parse(tracker.options!) } catch { return [] } })()
      return opts.length > 0 ? Math.min(todayValue / opts.length, 1) : 0
    }
    if (tracker.type === 'habit') return todayValue > 0 ? 1 : 0
    if (tracker.target > 0) return Math.min(todayValue / tracker.target, 1)
    return todayValue > 0 ? 0.5 : 0
  }, [tracker, todayValue])

  // Streak: consecutive days from today backwards with a log > 0.
  const streak = useMemo(() => {
    let s = 0
    const today = new Date()
    for (let i = 0; i < 60; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const has = logs.some(l => l.trackerUid === tracker.uid && l.date === ds && l.value > 0)
      if (has) s++
      else if (i > 0) break
      // Allow today=0 without breaking the streak — only break if a past day is missing.
      else continue
    }
    return s
  }, [logs, tracker.uid])

  // Center label inside the ring.
  // - habit: ✓ when done, blank otherwise
  // - select: current emoji or —
  // - counter/value: current value (compact)
  const centerLabel = (() => {
    if (tracker.type === 'habit') return todayValue > 0 ? '✓' : ''
    if (tracker.type === 'select' && tracker.options) {
      const opts: string[] = (() => { try { return JSON.parse(tracker.options!) } catch { return [] } })()
      return todayValue > 0 ? (opts[todayValue - 1] || '') : ''
    }
    return todayValue > 0 ? String(todayValue) : ''
  })()

  const dashOffset = CIRC * (1 - progress)

  return (
    <div
      onClick={onTap}
      title={`${tracker.name} — tap to log${streak >= 3 ? ` · ${streak}d streak` : ''}`}
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '6px',
        // Rule-of-thirds tile: square outer footprint with negative space.
        padding: '8px 4px',
        borderRadius: '10px',
        cursor: 'pointer',
        // 10% accent: pinned tiles get a soft tracker-tinted ring around the cell
        background: pinned ? `${tracker.color}0E` : 'transparent',
        border: pinned ? `1px solid ${tracker.color}40` : '1px solid transparent',
        transition: 'transform 0.1s, background 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
    >
      {/* Ring + center content */}
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track — 30% structural */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none"
            stroke="var(--bg-hover)"
            strokeWidth={STROKE}
          />
          {/* Filled arc — 10% accent (tracker color) */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none"
            stroke={tracker.color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.4s' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: tracker.type === 'select' ? '20px' : tracker.type === 'habit' ? '18px' : '13px',
          fontWeight: 700,
          color: progress >= 1 ? tracker.color : 'var(--text-secondary)',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {centerLabel}
        </div>
        {streak >= 3 && (
          <span aria-label={`${streak} day streak`} style={{
            position: 'absolute',
            top: -4, right: -6,
            background: tracker.color,
            color: '#fff',
            fontSize: '9px', fontWeight: 700,
            padding: '1px 5px', borderRadius: '9999px',
            lineHeight: 1.2, minWidth: '14px', textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }}>{streak}</span>
        )}
      </div>

      {/* Name — 30% structural, click to drill into detail page */}
      <button
        onClick={e => { e.stopPropagation(); onDetail(); router.push(`/trackers/${tracker.uid}`) }}
        data-no-sculpt
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: '11px', color: 'var(--text-secondary)',
          maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', fontWeight: 500,
        }}
      >{tracker.name}</button>

      {/* 7-day mini heatmap — Notion GitHub-style at-a-glance consistency */}
      <div style={{ display: 'flex', gap: '2px' }}>
        {weekData.map((v, i) => (
          <span key={i} aria-hidden style={{
            width: '4px', height: '4px', borderRadius: '50%',
            background: v > 0 ? tracker.color : 'var(--bg-hover)',
            opacity: v > 0 ? 0.4 + Math.min(v / Math.max(tracker.target, 1), 1) * 0.6 : 0.5,
          }} />
        ))}
      </div>
    </div>
  )
}

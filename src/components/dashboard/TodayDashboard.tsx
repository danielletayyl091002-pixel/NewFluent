'use client'
// Today dashboard. Replaces the placeholder home route.
//
// Design principles applied (researched May 2026):
//  - F-pattern: greeting + today's headline metric in top-left
//  - 5-second rule: user knows what matters in <5s
//  - Group by section, progressive disclosure (no kitchen sink)
//  - KPI strip across the top, primary list below
//  - Empty states are branded (one CTA each), not generic "no data"
//
// All data is derived from the existing Dexie tables and stores —
// no new schema. This is purely an aggregation view.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { db, Task } from '@/db/schema'
import { usePagesStore } from '@/stores/pages'
import { useTrackerStore } from '@/stores/trackers'
import { expandRecurring } from '@/lib/expandRecurring'
import { formatTimeString } from '@/lib/timeFormat'

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function greet(now: Date): string {
  const h = now.getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Good night'
}

export default function TodayDashboard() {
  const router = useRouter()
  const today = todayStr()
  const now = new Date()
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const pages = usePagesStore(s => s.pages)
  const loadPages = usePagesStore(s => s.load)
  const { definitions: trackers, logs: trackerLogs, load: loadTrackers, getTodayValue } = useTrackerStore()

  const [tasks, setTasks] = useState<Task[]>([])
  const [ringedUids, setRingedUids] = useState<string[]>([])

  useEffect(() => { loadPages(); loadTrackers() }, [loadPages, loadTrackers])

  useEffect(() => {
    db.tasks.toArray().then(all => setTasks(all.filter(t => t.scheduledDate || t.dueDate)))
  }, [])

  useEffect(() => {
    db.settings.where('key').equals('daily_progress_trackers').first().then(s => {
      if (!s?.value) return
      try { setRingedUids(JSON.parse(s.value)) } catch { /* noop */ }
    })
  }, [])

  // Today's events + tasks (with recurring expansion). Events have a startTime;
  // tasks don't. Sort events by startTime, tasks by status.
  const todaysItems = useMemo(() => {
    const expanded = expandRecurring(tasks, new Date(today + 'T00:00:00'), new Date(today + 'T23:59:59'))
    return expanded.filter(t =>
      (t.scheduledDate === today) || (t.dueDate === today)
    )
  }, [tasks, today])

  const todaysEvents = useMemo(
    () => todaysItems
      .filter(t => t.itemType === 'event' && t.startTime)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [todaysItems]
  )
  const todaysTasks = useMemo(
    () => todaysItems
      .filter(t => t.itemType !== 'event')
      .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done')),
    [todaysItems]
  )

  const recentPages = useMemo(
    () => [...pages].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 5),
    [pages]
  )

  const ringedTrackers = useMemo(
    () => ringedUids
      .map(uid => trackers.find(t => t.uid === uid))
      .filter((t): t is NonNullable<typeof t> => Boolean(t)),
    [ringedUids, trackers]
  )

  // KPI counts for the headline strip
  const eventCount = todaysEvents.length
  const taskOpenCount = todaysTasks.filter(t => t.status !== 'done').length
  const taskDoneCount = todaysTasks.filter(t => t.status === 'done').length

  return (
    <div style={{
      flex: 1, height: '100vh', overflowY: 'auto',
      background: 'var(--bg-primary)',
    }}>
      <div className="page-shell" style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Greeting + date — F-pattern top-left anchor */}
        <header style={{ marginBottom: '24px' }}>
          <div style={{
            fontSize: '12px', fontWeight: 600,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: '4px',
          }}>
            {dateLabel}
          </div>
          <h1 style={{
            margin: 0,
            fontSize: '28px', fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.2,
          }}>
            {greet(now)}.
          </h1>
        </header>

        {/* KPI strip */}
        <section
          aria-label="Today at a glance"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px', marginBottom: '32px',
          }}
        >
          <KPI label="Events" value={String(eventCount)} hint="today" />
          <KPI label="Tasks open" value={String(taskOpenCount)} hint={taskDoneCount > 0 ? `${taskDoneCount} done` : undefined} />
          <KPI label="Pages" value={String(pages.length)} hint="in workspace" />
          <KPI label="Trackers" value={String(trackers.length)} hint="active" />
        </section>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: '24px',
        }}>
          {/* Primary column: today's schedule */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Section title="Today's schedule" actionHref="/page/calendar" actionLabel="Open calendar">
              {todaysEvents.length === 0 ? (
                <Empty
                  message="Nothing scheduled today."
                  cta="Press n in the calendar to add an event"
                />
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {todaysEvents.map(e => (
                    <li key={e.uid} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-base, 8px)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                    }}>
                      <span style={{
                        width: '4px', alignSelf: 'stretch', borderRadius: '2px',
                        background: e.color || 'var(--accent)',
                      }} />
                      <span style={{
                        fontSize: '12px', fontVariantNumeric: 'tabular-nums',
                        color: 'var(--text-tertiary)', minWidth: '90px',
                      }}>
                        {formatTimeString(e.startTime!)}
                        {e.endTime ? ` – ${formatTimeString(e.endTime)}` : ''}
                      </span>
                      <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {e.title || 'Untitled event'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Tasks" actionHref="/board" actionLabel="Open board">
              {todaysTasks.length === 0 ? (
                <Empty
                  message="No tasks for today."
                  cta="Create a task on the board, or use ⌘⇧N for a quick capture"
                />
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {todaysTasks.map(t => (
                    <li key={t.uid} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-base, 8px)',
                    }}>
                      <span aria-hidden style={{
                        width: '14px', height: '14px',
                        borderRadius: '50%', flexShrink: 0,
                        border: `1.5px solid ${t.color || 'var(--accent)'}`,
                        background: t.status === 'done' ? (t.color || 'var(--accent)') : 'transparent',
                      }} />
                      <span style={{
                        fontSize: '13px',
                        color: t.status === 'done' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        textDecoration: t.status === 'done' ? 'line-through' : 'none',
                      }}>
                        {t.title || 'Untitled task'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {/* Side column: trackers + recent pages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Section title="Today's trackers" actionHref="/trackers" actionLabel="All trackers">
              {ringedTrackers.length === 0 ? (
                <Empty
                  message="No trackers pinned."
                  cta="Pin up to 3 from the Trackers page to see daily progress here"
                />
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ringedTrackers.map(t => {
                    const v = getTodayValue(t.uid)
                    const pct = t.target > 0 ? Math.min(v / t.target, 1) : 0
                    return (
                      <li key={t.uid}
                        onClick={() => router.push(`/trackers/${t.uid}`)}
                        style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 'var(--radius-base, 8px)' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                          <span style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                            {t.type === 'select' ? '' : t.target > 0 ? `${v}/${t.target}` : String(v)}
                          </span>
                        </div>
                        <div style={{ height: '4px', borderRadius: '2px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${pct * 100}%`,
                            background: t.color,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>

            <Section title="Recent pages" actionHref={undefined}>
              {recentPages.length === 0 ? (
                <Empty
                  message="No pages yet."
                  cta="Press ⌘K and choose 'New Page' to get started"
                />
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {recentPages.map(p => (
                    <li key={p.uid}>
                      <Link href={`/page/${p.uid}`} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 8px', borderRadius: 'var(--radius-base, 6px)',
                        textDecoration: 'none', color: 'var(--text-primary)',
                        fontSize: '13px',
                      }}>
                        <span style={{ width: '16px', textAlign: 'center', opacity: 0.8 }}>
                          {p.icon || '📄'}
                        </span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.title || 'Untitled'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Quick add" actionHref={undefined}>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Press <kbd style={kbdStyle}>⌘</kbd>+<kbd style={kbdStyle}>K</kbd> for the command palette
                or <kbd style={kbdStyle}>⌘</kbd>+<kbd style={kbdStyle}>⇧</kbd>+<kbd style={kbdStyle}>N</kbd> for quick capture.
              </p>
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}

function KPI({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 'var(--radius-card, 12px)',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: '11px', fontWeight: 600,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: '4px',
      }}>{label}</div>
      <div style={{
        fontSize: '24px', fontWeight: 700, lineHeight: 1.1,
        color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      {hint && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{hint}</div>}
    </div>
  )
}

function Section({
  title, actionHref, actionLabel, children,
}: {
  title: string
  actionHref?: string
  actionLabel?: string
  children: React.ReactNode
}) {
  return (
    <section style={{
      borderRadius: 'var(--radius-card, 12px)',
      background: 'var(--bg-primary)',
      border: '1px solid var(--border)',
      padding: '16px',
    }}>
      <header style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <h2 style={{
          margin: 0, fontSize: '13px', fontWeight: 700,
          color: 'var(--text-primary)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>{title}</h2>
        {actionHref && actionLabel && (
          <Link href={actionHref} style={{
            fontSize: '12px', color: 'var(--accent)',
            textDecoration: 'none',
          }}>{actionLabel} →</Link>
        )}
      </header>
      {children}
    </section>
  )
}

function Empty({ message, cta }: { message: string; cta: string }) {
  return (
    <div style={{
      padding: '24px 12px',
      textAlign: 'center',
      color: 'var(--text-tertiary)',
      fontSize: '13px',
    }}>
      <div style={{ fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
        {message}
      </div>
      <div style={{ fontSize: '12px' }}>{cta}</div>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  borderRadius: '4px',
  fontSize: '11px',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  fontWeight: 600,
}

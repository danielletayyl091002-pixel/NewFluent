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
  const { definitions: trackers, logs: trackerLogs, load: loadTrackers, getTodayValue, addLog, setTodayValue } = useTrackerStore()

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

  // Unscheduled tasks (no scheduledDate set OR set to a date before today
  // and still open). The "Plan today" CTA pulls these into a quick list
  // so users can drag them into today in one place — Sunsama ritual.
  const unscheduledTasks = useMemo(
    () => tasks.filter(t =>
      t.status !== 'done' &&
      t.itemType !== 'event' &&
      (!t.scheduledDate || t.scheduledDate < today)
    ).slice(0, 12),
    [tasks, today]
  )
  const [planOpen, setPlanOpen] = useState(false)
  async function moveToToday(uid: string) {
    const t = tasks.find(x => x.uid === uid)
    if (!t?.id) return
    await db.tasks.update(t.id, { scheduledDate: today, dueDate: today })
    setTasks(prev => prev.map(x => x.uid === uid ? { ...x, scheduledDate: today, dueDate: today } : x))
  }

  // Show ALL trackers, pinned ones first. Research-backed approach
  // (Habitify / HabitNow): the dashboard should expose every tracker
  // for one-tap logging, not hide them. James Clear's "focus on 3"
  // principle is honored visually — pinned trackers get the accent
  // border treatment, but unpinned ones still appear so the section
  // never feels arbitrary or wasteful.
  const dashboardTrackers = useMemo(() => {
    const pinnedSet = new Set(ringedUids)
    const pinned = ringedUids
      .map(uid => trackers.find(t => t.uid === uid))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
    const rest = trackers.filter(t => !pinnedSet.has(t.uid))
    return { all: [...pinned, ...rest], pinnedSet }
  }, [ringedUids, trackers])

  // KPI counts for the headline strip
  const eventCount = todaysEvents.length
  const taskOpenCount = todaysTasks.filter(t => t.status !== 'done').length
  const taskDoneCount = todaysTasks.filter(t => t.status === 'done').length

  // Weekly recap — only show on weekends (review window). Counts events
  // closed, tasks done, and average mood (if a select tracker exists).
  const showWeeklyRecap = now.getDay() === 0 || now.getDay() === 6
  const weeklyStats = useMemo(() => {
    if (!showWeeklyRecap) return null
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString().split('T')[0]
    const inWeek = (d?: string | null) => Boolean(d && d >= weekAgoStr && d <= today)
    const tasksThisWeek = tasks.filter(t => inWeek(t.scheduledDate) || inWeek(t.dueDate))
    const tasksDone = tasksThisWeek.filter(t => t.status === 'done').length
    const events = tasksThisWeek.filter(t => t.itemType === 'event').length
    // Mood
    const moodTracker = trackers.find(t => t.type === 'select')
    let moodAvg: number | null = null
    let moodLabel: string | null = null
    if (moodTracker) {
      const moodLogs = trackerLogs.filter(l => l.trackerUid === moodTracker.uid && l.date >= weekAgoStr && l.value > 0)
      if (moodLogs.length > 0) {
        moodAvg = moodLogs.reduce((s, l) => s + l.value, 0) / moodLogs.length
        const opts: string[] = (() => { try { return JSON.parse(moodTracker.options || '[]') } catch { return [] } })()
        moodLabel = opts[Math.round(moodAvg) - 1] || moodAvg.toFixed(1)
      }
    }
    return { tasksDone, events, moodLabel, moodLogged: moodTracker ? trackerLogs.filter(l => l.trackerUid === moodTracker.uid && l.date >= weekAgoStr && l.value > 0).length : 0 }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWeeklyRecap, tasks, trackers, trackerLogs, today])

  return (
    <div className="dashboard-root" style={{
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
          <h1 className="dashboard-greeting" style={{
            margin: 0, fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.2,
          }}>
            {greet(now)}.
          </h1>
        </header>

        {/* KPI strip — only the two action-relevant counts on the
            dashboard. Pages/Trackers totals were noise (visible from the
            sidebar). On mobile this collapses to two larger tiles. */}
        <section
          aria-label="Today at a glance"
          className="dashboard-kpi"
          style={{ marginBottom: '24px' }}
        >
          <KPI label="Events" value={String(eventCount)} hint={eventCount === 1 ? 'scheduled today' : 'scheduled today'} />
          <KPI label="Tasks open" value={String(taskOpenCount)} hint={taskDoneCount > 0 ? `${taskDoneCount} done today` : 'nothing due'} />
        </section>

        {/* Weekly recap — only on weekends so users get a built-in review
            moment without it cluttering weekday dashboards. */}
        {weeklyStats && (
          <section style={{
            marginBottom: '24px',
            padding: '16px 20px',
            borderRadius: 'var(--radius-card, 12px)',
            background: 'var(--accent-light)',
            border: '1px solid var(--accent)',
            color: 'var(--text-primary)',
          }}>
            <div style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--accent)',
              marginBottom: '6px',
            }}>This week</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', fontSize: '13px' }}>
              <span><strong>{weeklyStats.tasksDone}</strong> tasks done</span>
              <span><strong>{weeklyStats.events}</strong> events</span>
              {weeklyStats.moodLabel && (
                <span>Avg mood: <strong>{weeklyStats.moodLabel}</strong> ({weeklyStats.moodLogged} logs)</span>
              )}
            </div>
          </section>
        )}

        <div className="dashboard-grid">
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
              {/* Sunsama-style "plan today" — pull from backlog without
                  leaving the dashboard. Only renders when there's a backlog. */}
              {unscheduledTasks.length > 0 && (
                <button
                  onClick={() => setPlanOpen(true)}
                  data-no-sculpt
                  style={{
                    width: '100%', padding: '8px 12px',
                    marginBottom: '10px', borderRadius: 'var(--radius-base, 8px)',
                    border: '1px dashed var(--accent)',
                    background: 'transparent', color: 'var(--accent)',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >Plan today — {unscheduledTasks.length} {unscheduledTasks.length === 1 ? 'task' : 'tasks'} need a date</button>
              )}
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
              {dashboardTrackers.all.length === 0 ? (
                <Empty
                  message="No trackers yet."
                  cta="Add a tracker to log mood, habits, or daily counts here"
                />
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {dashboardTrackers.all.map(t => {
                    const isPinned = dashboardTrackers.pinnedSet.has(t.uid)
                    void isPinned // pinned styling applied via the wrapper below
                    const v = getTodayValue(t.uid)
                    const pct = t.target > 0 ? Math.min(v / t.target, 1) : 0
                    const opts: string[] = t.type === 'select' && t.options
                      ? (() => { try { return JSON.parse(t.options!) } catch { return [] } })()
                      : []
                    return (
                      <li key={t.uid} style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        // Pinned trackers: subtle accent left-bar so they
                        // visually anchor the eye without crowding the list.
                        borderLeft: isPinned ? `3px solid ${t.color}` : '3px solid transparent',
                        background: isPinned ? `${t.color}08` : 'transparent',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '6px' }}>
                          <span
                            onClick={() => router.push(`/trackers/${t.uid}`)}
                            style={{ color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}
                          >{t.name}</span>
                          <span style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                            {t.type === 'select' ? (opts[v - 1] || '—') : t.target > 0 ? `${v}/${t.target}` : String(v)}
                          </span>
                        </div>
                        {/* Inline log controls — log without leaving the dashboard.
                            Daylio's "2-tap" principle. */}
                        {t.type === 'select' && opts.length > 0 ? (
                          <div data-flat style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {opts.map((opt, i) => {
                              const optVal = i + 1
                              const selected = v === optVal
                              return (
                                <button
                                  key={i}
                                  onClick={() => setTodayValue(t.uid, selected ? 0 : optVal)}
                                  title={opt}
                                  style={{
                                    width: '26px', height: '26px',
                                    borderRadius: '6px',
                                    border: selected ? `2px solid ${t.color}` : '1px solid var(--border)',
                                    background: selected ? `${t.color}18` : 'var(--bg-secondary)',
                                    cursor: 'pointer', fontSize: '14px', padding: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >{opt}</button>
                              )
                            })}
                          </div>
                        ) : t.type === 'habit' ? (
                          <button
                            onClick={() => {
                              if (v > 0) addLog(t.uid, -v)
                              else addLog(t.uid, 1)
                            }}
                            data-no-sculpt
                            style={{
                              padding: '4px 12px', borderRadius: '9999px',
                              border: `1px solid ${t.color}`,
                              background: v > 0 ? t.color : 'transparent',
                              color: v > 0 ? '#fff' : t.color,
                              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                            }}
                          >{v > 0 ? '✓ Done' : 'Mark done'}</button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => { if (v > 0) addLog(t.uid, -1) }}
                              data-no-sculpt
                              style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                border: '1px solid var(--border)', background: 'none',
                                cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: 0,
                              }}
                            >−</button>
                            <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: `${pct * 100}%`,
                                background: t.color, transition: 'width 0.3s',
                              }} />
                            </div>
                            <button
                              onClick={() => addLog(t.uid, 1)}
                              data-no-sculpt
                              style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                border: 'none', background: t.color,
                                cursor: 'pointer', fontSize: '14px', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: 0,
                              }}
                            >+</button>
                          </div>
                        )}
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

          </div>
        </div>

        {/* Footer hint — small, single-line, hidden on mobile to avoid clutter */}
        <p className="dashboard-footer-hint" style={{
          margin: '24px 0 0', fontSize: '11px',
          color: 'var(--text-tertiary)', textAlign: 'center',
        }}>
          <kbd style={kbdStyle}>⌘</kbd>+<kbd style={kbdStyle}>K</kbd> to search ·
          {' '}<kbd style={kbdStyle}>⌘</kbd>+<kbd style={kbdStyle}>⇧</kbd>+<kbd style={kbdStyle}>N</kbd> for quick capture
        </p>
      </div>

      {planOpen && (
        <div onClick={() => setPlanOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 4000,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: '10vh',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: '14px', width: '480px', maxWidth: '90vw',
            maxHeight: '70vh', overflowY: 'auto',
            boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Plan today</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                Click to schedule for today
              </span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}>
              {unscheduledTasks.length === 0 ? (
                <li style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                  Inbox zero. Nothing to plan.
                </li>
              ) : unscheduledTasks.map(t => (
                <li key={t.uid}
                  onClick={() => moveToToday(t.uid)}
                  style={{
                    padding: '10px 20px', cursor: 'pointer',
                    fontSize: '13px', color: 'var(--text-primary)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{
                    width: '12px', height: '12px', borderRadius: '50%',
                    border: `1.5px solid ${t.color || 'var(--accent)'}`, flexShrink: 0,
                  }} />
                  <span style={{ flex: 1 }}>{t.title || 'Untitled'}</span>
                  {t.scheduledDate && (
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      was {t.scheduledDate}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setPlanOpen(false)} style={{
                padding: '6px 14px', borderRadius: '6px',
                border: '1px solid var(--border)', background: 'none',
                color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer',
              }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KPI({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div data-card style={{
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
    <section data-card style={{
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

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
import TrackerRing from './TrackerRing'
import { generateReview, ReviewOutput } from '@/lib/aiReview'

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
  const { definitions: trackers, logs: trackerLogs, load: loadTrackers, getTodayValue, addLog, setTodayValue, getWeekData } = useTrackerStore()

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

  // Toggle pin from the dashboard (star button on each ring tile).
  // Persists to the same daily_progress_trackers setting that the
  // /trackers chip row writes.
  async function togglePin(uid: string) {
    const next = ringedUids.includes(uid)
      ? ringedUids.filter(u => u !== uid)
      : [...ringedUids, uid]
    setRingedUids(next)
    const val = JSON.stringify(next)
    const exist = await db.settings.where('key').equals('daily_progress_trackers').first()
    if (exist?.id) await db.settings.update(exist.id, { value: val })
    else await db.settings.add({ key: 'daily_progress_trackers', value: val })
  }

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
  // AI weekly review — bring-your-own-key. Stored in localStorage so it
  // never leaves the device unless the user explicitly triggers a request.
  const [aiReview, setAiReview] = useState<ReviewOutput | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  async function runAiReview() {
    const apiKey = typeof localStorage !== 'undefined' ? localStorage.getItem('anthropic_api_key') : null
    if (!apiKey) {
      const k = window.prompt('Paste your Anthropic API key (kept locally, never sent to a server):')
      if (!k) return
      localStorage.setItem('anthropic_api_key', k)
    }
    const key = localStorage.getItem('anthropic_api_key')!
    setAiLoading(true); setAiError(null); setAiReview(null)
    try {
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7)
      const ws = weekStart.toISOString().split('T')[0]
      const inWeek = (d?: string | null) => Boolean(d && d >= ws && d <= today)
      const tasksWeek = tasks.filter(t => inWeek(t.scheduledDate) || inWeek(t.dueDate))
      const logsWeek = trackerLogs.filter(l => l.date >= ws && l.date <= today)
      const finance = await db.financeEntries.where('date').between(ws, today, true, true).toArray()
      const review = await generateReview({
        weekStart: ws, weekEnd: today,
        tasks: tasksWeek, trackers, trackerLogs: logsWeek, financeEntries: finance,
      }, key)
      setAiReview(review)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setAiLoading(false)
    }
  }
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', fontSize: '13px', alignItems: 'center' }}>
              <span><strong>{weeklyStats.tasksDone}</strong> tasks done</span>
              <span><strong>{weeklyStats.events}</strong> events</span>
              {weeklyStats.moodLabel && (
                <span>Avg mood: <strong>{weeklyStats.moodLabel}</strong> ({weeklyStats.moodLogged} logs)</span>
              )}
              <button
                onClick={runAiReview}
                disabled={aiLoading}
                data-no-sculpt
                style={{
                  marginLeft: 'auto',
                  padding: '4px 12px', borderRadius: '9999px',
                  border: '1px solid var(--accent)', background: 'transparent',
                  color: 'var(--accent)', fontSize: '11px', fontWeight: 600,
                  cursor: aiLoading ? 'wait' : 'pointer',
                }}
              >{aiLoading ? 'Thinking…' : aiReview ? 'Regenerate AI insights' : '✨ AI insights'}</button>
            </div>
            {aiError && (
              <div role="alert" style={{
                marginTop: '12px', padding: '10px 12px', borderRadius: '8px',
                background: '#FEE2E2', border: '1px solid #FCA5A5',
                color: '#7F1D1D', fontSize: '12px',
              }}>{aiError}</div>
            )}
            {aiReview && (
              <div style={{ marginTop: '14px', fontSize: '13px', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 10px', color: 'var(--text-primary)' }}>{aiReview.summary}</p>
                {aiReview.highlights.length > 0 && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Highlights</div>
                    <ul style={{ margin: '0 0 10px', paddingLeft: '20px' }}>
                      {aiReview.highlights.map((h, i) => <li key={i} style={{ marginBottom: '2px' }}>{h}</li>)}
                    </ul>
                  </>
                )}
                {aiReview.suggestions.length > 0 && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>For next week</div>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {aiReview.suggestions.map((s, i) => <li key={i} style={{ marginBottom: '2px' }}>{s}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* Trackers — full-width row so the ring tiles get horizontal
            real estate to pack densely (8+ trackers in one row at desktop).
            Sits above the 2-col grid because tracking is a daily ritual
            that benefits from being scanned first. */}
        {dashboardTrackers.all.length > 0 && (
          <Section title="Today's trackers" actionHref="/trackers" actionLabel="All trackers">
            <div style={{
              // Rule-of-thirds × N. Min 72px per ring + gap means ~8-9
              // tiles per row at typical desktop, stacks gracefully on narrow.
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))',
              gap: '4px',
              marginTop: '4px',
            }}>
              {dashboardTrackers.all.map(t => {
                const isPinned = dashboardTrackers.pinnedSet.has(t.uid)
                const todayVal = getTodayValue(t.uid)
                const weekData = getWeekData(t.uid)
                return (
                  <TrackerRing
                    key={t.uid}
                    tracker={t}
                    todayValue={todayVal}
                    weekData={weekData}
                    logs={trackerLogs}
                    pinned={isPinned}
                    onTap={() => {
                      if (t.type === 'habit') {
                        if (todayVal > 0) addLog(t.uid, -todayVal)
                        else addLog(t.uid, 1)
                      } else if (t.type === 'select' && t.options) {
                        const opts: string[] = (() => { try { return JSON.parse(t.options!) } catch { return [] } })()
                        const next = todayVal >= opts.length ? 0 : todayVal + 1
                        setTodayValue(t.uid, next)
                      } else {
                        addLog(t.uid, 1)
                      }
                    }}
                    onDetail={() => {/* TrackerRing handles routing */}}
                    onTogglePin={() => togglePin(t.uid)}
                  />
                )
              })}
            </div>
          </Section>
        )}

        <div className="dashboard-grid" style={{ marginTop: '24px' }}>
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

          {/* Side column: recent pages (trackers now live in a full-width
              row below this 2-col grid where they have room to breathe). */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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

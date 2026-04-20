'use client'
import { useEffect, useState, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { db, Task } from '@/db/schema'
import EventModal from '@/components/calendar/EventModal'
import { nanoid } from 'nanoid'
import { expandRecurring } from '@/lib/expandRecurring'
import { safeDbWrite } from '@/lib/dbError'

const getEventColor = (task: Task) => task.color || 'var(--accent)'

const getTextColor = (hexColor: string) => {
  if (!hexColor.startsWith('#')) return 'white'
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#1a1a1a' : 'white'
}

function getEventStyle(color: string): React.CSSProperties {
  const calStyle = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-cal-style') || 'soft' : 'soft'
  if (calStyle === 'solid') return { background: color, color: getTextColor(color), border: 'none', borderLeft: 'none' }
  if (calStyle === 'outline') return { background: 'transparent', color: color, border: `2px solid ${color}`, borderLeft: `2px solid ${color}` }
  return { background: `${color}20`, color: color, borderLeft: `3px solid ${color}` }
}
import { useTrackerStore } from '@/stores/trackers'


// Full 24h timetable: 12 AM (0) through 11 PM (23).
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function formatHour(h: number) {
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  if (h > 12) return `${h - 12} PM`
  return `${h} AM`
}

function WeekStrip({ today, onDayClick, selectedDay }: {
  today: Date
  onDayClick?: (date: Date) => void
  selectedDay?: string | null
}) {
  const startOnMonday = typeof window !== 'undefined' && localStorage.getItem('week_start') === 'monday'

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    const dayOfWeek = today.getDay()
    const startOffset = startOnMonday
      ? (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
      : -dayOfWeek
    d.setDate(today.getDate() + startOffset + i)
    return d
  })

  const labels = startOnMonday
    ? ['Mo','Tu','We','Th','Fr','Sa','Su']
    : ['Su','Mo','Tu','We','Th','Fr','Sa']
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 12px 8px',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0
    }}>
      {days.map((d, i) => {
        const isToday = d.toDateString() === today.toDateString()
        return (
          <div key={i}
            onClick={() => onDayClick && onDayClick(d)}
            style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '3px',
              cursor: 'pointer'
          }}>
            <span style={{
              fontSize: '11px', color: 'var(--text-tertiary)',
              fontWeight: 500, textTransform: 'uppercase'
            }}>{labels[i]}</span>
            <div
              onClick={() => onDayClick && onDayClick(d)}
              onMouseEnter={e => {
                if (!isToday) e.currentTarget.style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={e => {
                if (!isToday) e.currentTarget.style.background =
                  selectedDay === d.toISOString().split('T')[0] ? 'rgba(99, 102, 241, 0.2)' : 'transparent'
              }}
              style={{
                width: '26px', height: '26px', borderRadius: '50%',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer',
                background: isToday
                  ? 'var(--accent)'
                  : selectedDay === d.toISOString().split('T')[0]
                    ? 'rgba(99, 102, 241, 0.2)'
                    : 'transparent',
                boxShadow: isToday ? '0 0 0 3px var(--accent-light)' : 'none'
              }}>
              <span style={{
                fontSize: '11px',
                fontWeight: isToday ? 700 : 400,
                color: isToday ? 'white' : 'var(--text-primary)'
              }}>{d.getDate()}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Timeline({ now, tasks, onAddEvent, onUpdateTask, onEventClick }: {
  now: number
  tasks: Task[]
  onAddEvent?: (startTime: string, endTime: string) => void
  onUpdateTask?: (uid: string, changes: Partial<Task>) => void
  onEventClick?: (task: Task) => void
}) {
  const HOUR_H = 52
  const START = 6
  const currentTop = (now - START) * HOUR_H
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragEnd, setDragEnd] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Move state
  const [movingTask, setMovingTask] = useState<Task | null>(null)
  const [moveHour, setMoveHour] = useState<number | null>(null)
  const moveDuration = useRef(0)
  const moveStartPos = useRef<{ x: number; y: number } | null>(null)

  // Resize state
  const [resizingTask, setResizingTask] = useState<Task | null>(null)
  const [resizeEndHour, setResizeEndHour] = useState<number | null>(null)

  function yToHour(y: number, containerTop: number): number {
    const relY = y - containerTop
    const hour = START + relY / HOUR_H
    return Math.max(START, Math.min(22, Math.round(hour * 4) / 4))
  }

  function getHourFromMouseEvent(e: MouseEvent): number {
    if (!containerRef.current) return START
    const rect = containerRef.current.getBoundingClientRect()
    const scrollTop = containerRef.current.scrollTop
    return yToHour(e.clientY, rect.top - scrollTop)
  }

  // Window-level listeners for move/resize
  useEffect(() => {
    if (!movingTask && !resizingTask) return
    const onMove = (e: MouseEvent) => {
      if (movingTask) {
        if (moveStartPos.current) {
          const dy = Math.abs(e.clientY - moveStartPos.current.y)
          if (dy < 3) return
          moveStartPos.current = null
        }
        setMoveHour(getHourFromMouseEvent(e))
      }
      if (resizingTask) {
        const h = getHourFromMouseEvent(e)
        const startH = resizingTask.startTime ? parseInt(resizingTask.startTime.split(':')[0]) + parseInt(resizingTask.startTime.split(':')[1]) / 60 : 9
        setResizeEndHour(Math.max(startH + 0.25, h))
      }
    }
    const onUp = () => {
      if (movingTask && moveHour !== null && onUpdateTask) {
        const newStart = moveHour
        const newEnd = newStart + moveDuration.current
        onUpdateTask(movingTask.uid, {
          startTime: fmt(newStart),
          endTime: fmt(Math.min(22, newEnd)),
        })
      } else if (movingTask && moveHour === null && onEventClick) {
        // Click without move — open edit modal
        onEventClick(movingTask)
      }
      if (resizingTask && resizeEndHour !== null && onUpdateTask) {
        onUpdateTask(resizingTask.uid, { endTime: fmt(resizeEndHour) })
      }
      setMovingTask(null)
      setMoveHour(null)
      setResizingTask(null)
      setResizeEndHour(null)
      moveStartPos.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [movingTask, resizingTask, moveHour, resizeEndHour, onUpdateTask, onEventClick])

  function fmt(h: number) {
    const hrs = Math.floor(h)
    const mins = Math.round((h - hrs) * 60)
    return String(hrs).padStart(2, '0') + ':' + String(mins).padStart(2, '0')
  }

  function fmtDisplay(h: number) {
    const hrs = Math.floor(h)
    const mins = Math.round((h - hrs) * 60)
    const period = hrs >= 12 ? 'PM' : 'AM'
    const displayHr = hrs > 12 ? hrs - 12 : hrs === 0 ? 12 : hrs
    return `${displayHr}:${String(mins).padStart(2, '0')} ${period}`
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1, overflowY: 'auto', position: 'relative',
        cursor: movingTask ? 'grabbing' : resizingTask ? 'ns-resize' : 'crosshair',
        userSelect: 'none'
      }}
      onMouseDown={(e) => {
        // Resize handle
        if ((e.target as HTMLElement).closest('[data-rail-resize]')) return
        // Event click — start move
        const eventEl = (e.target as HTMLElement).closest('[data-rail-event]') as HTMLElement | null
        if (eventEl) {
          e.preventDefault()
          const uid = eventEl.getAttribute('data-rail-event')
          const task = tasks.find(t => t.uid === uid)
          if (!task) return
          const startH = task.startTime ? parseInt(task.startTime.split(':')[0]) + parseInt(task.startTime.split(':')[1]) / 60 : 9
          const endH = task.endTime ? parseInt(task.endTime.split(':')[0]) + parseInt(task.endTime.split(':')[1]) / 60 : startH + 1
          moveDuration.current = endH - startH
          moveStartPos.current = { x: e.clientX, y: e.clientY }
          setMovingTask(task)
          return
        }
        // Empty space — create drag
        const rect = e.currentTarget.getBoundingClientRect()
        const hour = yToHour(e.clientY, rect.top + e.currentTarget.scrollTop)
        setDragStart(hour)
        setDragEnd(hour)
        setIsDragging(true)
      }}
      onMouseMove={(e) => {
        if (!isDragging) return
        const rect = e.currentTarget.getBoundingClientRect()
        const hour = yToHour(e.clientY, rect.top + e.currentTarget.scrollTop)
        setDragEnd(hour)
      }}
      onMouseUp={() => {
        if (isDragging && dragStart !== null && dragEnd !== null) {
          const start = Math.min(dragStart, dragEnd)
          const end = Math.max(dragStart, dragEnd)
          if (end - start >= 0.25) {
            onAddEvent && onAddEvent(fmt(start), fmt(end))
          }
        }
        setIsDragging(false)
        setDragStart(null)
        setDragEnd(null)
      }}
    >
      {HOURS.map(h => (
        <div key={h}
          style={{
            height: `${HOUR_H}px`,
            borderBottom: '1px solid var(--border-light, #F1F5F9)',
            display: 'flex', alignItems: 'flex-start',
            position: 'relative'
          }}
        >
          <span style={{
            fontSize: '11px', color: 'var(--text-tertiary)',
            width: '36px', paddingTop: '4px',
            paddingLeft: '8px', flexShrink: 0
          }}>{formatHour(h)}</span>
        </div>
      ))}

      {tasks.length === 0 && (
        <div style={{
          position: 'absolute',
          top: `${(9 - START) * HOUR_H}px`,
          left: '44px', right: '8px',
          textAlign: 'center',
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          padding: '8px',
          pointerEvents: 'none'
        }}>
          No scheduled tasks today
        </div>
      )}

      {/* Move ghost */}
      {movingTask && moveHour !== null && (() => {
        const color = movingTask.color && movingTask.color.startsWith('#') ? movingTask.color : '#6366F1'
        const topPx = (moveHour - START) * HOUR_H
        const heightPx = Math.max(moveDuration.current * HOUR_H - 2, 20)
        return (
          <div style={{
            position: 'absolute', top: `${topPx}px`,
            left: '44px', right: '8px', height: `${heightPx}px`,
            background: `${color}30`, borderLeft: `3px dashed ${color}`,
            borderRadius: 'var(--radius-xs, 4px)', pointerEvents: 'none', zIndex: 8,
            padding: '3px 6px', fontSize: '11px', fontWeight: 600, color,
          }}>{movingTask.title}</div>
        )
      })()}

      {tasks.map(task => {
        const isMoving = movingTask?.uid === task.uid && moveHour !== null
        const isResizing = resizingTask?.uid === task.uid
        const startHour = task.startTime ? parseInt(task.startTime.split(':')[0]) : 9
        const startMin = task.startTime ? parseInt(task.startTime.split(':')[1]) : 0
        const endHour = isResizing && resizeEndHour !== null ? Math.floor(resizeEndHour) : (task.endTime ? parseInt(task.endTime.split(':')[0]) : startHour + 1)
        const endMin = isResizing && resizeEndHour !== null ? Math.round((resizeEndHour % 1) * 60) : (task.endTime ? parseInt(task.endTime.split(':')[1]) : 0)
        const topPx = (startHour - START + startMin / 60) * HOUR_H
        const heightPx = Math.max(((endHour - startHour) + (endMin - startMin) / 60) * HOUR_H - 2, 20)
        const color = getEventColor(task)
        return (
          <div key={task.uid} data-rail-event={task.uid} className="calendar-event" style={{
            position: 'absolute',
            top: `${topPx}px`,
            left: '44px', right: '8px',
            height: `${heightPx}px`,
            ...getEventStyle(color),
            borderRadius: 'var(--radius-xs, 4px)',
            padding: heightPx > 40 ? '4px 6px' : '2px 6px',
            overflow: 'hidden',
            minHeight: '24px',
            maxWidth: '100%',
            cursor: 'grab',
            opacity: isMoving ? 0.3 : 1,
            zIndex: isMoving || isResizing ? 10 : 3,
          }}>
            <div style={{
              fontSize: '11px', fontWeight: 600,
              color: getEventStyle(color).color || color,
              whiteSpace: 'nowrap', overflow: 'hidden',
              textOverflow: 'ellipsis', lineHeight: 1.3,
              textDecoration: task.status === 'done' ? 'line-through' : 'none',
              opacity: task.status === 'done' ? 0.6 : 1,
            }}>{task.itemType === 'task' ? '\u2610 ' : ''}{task.title}</div>
            {heightPx > 40 && (
              <div style={{
                fontSize: '11px', color: getEventStyle(color).color || color, opacity: 0.8, marginTop: '2px',
              }}>{task.startTime} – {task.endTime}</div>
            )}
            <div
              data-rail-resize="true"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setResizingTask(task)
                const eH = task.endTime ? parseInt(task.endTime.split(':')[0]) + parseInt(task.endTime.split(':')[1]) / 60 : startHour + 1
                setResizeEndHour(eH)
              }}
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: '6px', cursor: 'ns-resize',
              }}
            />
          </div>
        )
      })}

      {isDragging && dragStart !== null && dragEnd !== null && (
        <div style={{
          position: 'absolute',
          top: `${(Math.min(dragStart, dragEnd) - START) * HOUR_H}px`,
          left: '44px', right: '8px',
          height: `${Math.abs(dragEnd - dragStart) * HOUR_H}px`,
          background: 'rgba(99,102,241,0.2)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 'var(--radius-xs, 4px)',
          pointerEvents: 'none',
          minHeight: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '2px 4px',
          overflow: 'hidden'
        }}>
          <span style={{
            fontSize: '11px', fontWeight: 700,
            color: 'var(--accent)', lineHeight: 1
          }}>
            {fmtDisplay(Math.min(dragStart, dragEnd))}
          </span>
          {Math.abs(dragEnd - dragStart) >= 0.5 && (
            <span style={{
              fontSize: '11px', fontWeight: 700,
              color: 'var(--accent)', lineHeight: 1,
              alignSelf: 'flex-end'
            }}>
              {fmtDisplay(Math.max(dragStart, dragEnd))}
            </span>
          )}
        </div>
      )}

      {now >= START && now <= 22 && (
        <div style={{
          position: 'absolute',
          top: `${currentTop}px`,
          left: '36px', right: '8px',
          height: '2px', background: '#EF4444', zIndex: 10,
          pointerEvents: 'none'
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#EF4444', position: 'absolute',
            left: '-4px', top: '-3px'
          }}/>
        </div>
      )}
    </div>
  )
}

function Ring({ value, max, color, label }: {
  value: number, max: number, color: string, label: string
}) {
  const r = 18
  const circ = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const offset = circ * (1 - pct)
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '4px'
    }}>
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none"
          stroke="var(--border)" strokeWidth="4"/>
        <circle cx="24" cy="24" r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
          style={{ transition: 'stroke-dashoffset 0.5s' }}/>
        <text x="24" y="28" textAnchor="middle"
          fontSize="9" fontWeight="700"
          fill="var(--text-primary)">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <span style={{
        fontSize: '11px', color: 'var(--text-tertiary)',
        fontWeight: 500
      }}>{label}</span>
    </div>
  )
}

interface RightRailProps {
  toggleRight?: () => void
}

export default function RightRail({ toggleRight }: RightRailProps = {}) {
  const { definitions: trackerDefs, loaded: trackersLoaded, load: loadTrackers, getTodayValue } = useTrackerStore()
  const [upcoming, setUpcoming] = useState<Task[]>([])
  const [todayTasks, setTodayTasks] = useState<Task[]>([])
  const [editingEvent, setEditingEvent] = useState<Partial<Task> | null>(null)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [today, setToday] = useState<Date | null>(null)
  const [now, setNow] = useState(0)
  const [dateStr, setDateStr] = useState('')
  const [newEvent, setNewEvent] = useState<{ startTime: string, endTime: string, title: string } | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    if (!trackersLoaded) loadTrackers()
  }, [trackersLoaded, loadTrackers])

  useEffect(() => {
    const interval = setInterval(() => loadTrackers(), 30000)
    const onFocus = () => loadTrackers()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [loadTrackers])

  const [ringUids, setRingUids] = useState<string[]>([])

  useEffect(() => {
    async function loadRingPref() {
      const setting = await db.settings.where('key').equals('daily_progress_trackers').first()
      if (setting?.value) {
        try { setRingUids(JSON.parse(setting.value)) } catch {}
      }
    }
    loadRingPref()
  }, [])

  const ringTrackers = ringUids.length > 0
    ? ringUids.map(uid => trackerDefs.find(d => d.uid === uid)).filter(Boolean) as typeof trackerDefs
    : trackerDefs.slice(0, 3)

  useEffect(() => {
    const d = new Date()
    setToday(d)
    setNow(d.getHours() + d.getMinutes() / 60)
    setDateStr(d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    }))
    const interval = setInterval(() => {
      const n = new Date()
      setNow(n.getHours() + n.getMinutes() / 60)
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const loadEvents = async () => {
      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]
      const nowMins = now.getHours() * 60 + now.getMinutes()

      // Fetch all non-done tasks, then expand recurring events across the
      // next 30 days so virtual occurrences show up in the upcoming list.
      const allTasks = await db.tasks
        .filter(t => t.status !== 'done')
        .toArray()
      const rangeEnd = new Date()
      rangeEnd.setDate(rangeEnd.getDate() + 30)
      const expanded = expandRecurring(allTasks, now, rangeEnd)

      // Upcoming: anything dated today or later, sorted ascending.
      // Use the same date-lookup pattern (dueDate ?? scheduledDate) that
      // the rest of RightRail already uses.
      const upcomingRaw = expanded
        .filter(t => {
          const d = t.dueDate ?? t.scheduledDate ?? ''
          return d !== '' && d >= todayStr
        })
        .sort((a, b) => {
          const da = a.dueDate ?? a.scheduledDate ?? ''
          const dbKey = b.dueDate ?? b.scheduledDate ?? ''
          return da.localeCompare(dbKey)
        })

      // Exclude events that already ended today
      const filtered = upcomingRaw.filter(t => {
        if ((t.dueDate ?? t.scheduledDate) === todayStr && t.endTime) {
          const [h, m] = t.endTime.split(':').map(Number)
          if (h * 60 + (m || 0) <= nowMins) return false
        }
        return true
      })
      setUpcoming(filtered.slice(0, 10))

      // Today timeline: events scheduled for today (including virtual
      // recurring occurrences that land on today) that have a startTime.
      const scheduled = expanded.filter(t =>
        (t.scheduledDate === todayStr || t.dueDate === todayStr) &&
        t.startTime !== null
      )
      setTodayTasks(scheduled)
  }

  useEffect(() => {
    loadEvents()
  }, [])

  return (
    <aside style={{
      width: '280px', minWidth: '280px',
      height: '100vh',
      borderLeft: '1px solid var(--border)',
      background: 'var(--bg-sidebar)',
      display: 'flex', flexDirection: 'column',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{
        height: '48px', flexShrink: 0,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '0 16px',
        borderBottom: '1px solid var(--border)'
      }}>
        {toggleRight && (
          <button
            onClick={toggleRight}
            aria-label="Hide right sidebar"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <ChevronRight size={16} />
          </button>
        )}
        <span style={{
          fontSize: '13px', fontWeight: 600,
          color: 'var(--text-primary)'
        }}>Today</span>
        <span style={{
          fontSize: '11px', color: 'var(--text-tertiary)',
          marginLeft: 'auto',
        }}>
          {dateStr}
        </span>
      </div>

      {today && <WeekStrip today={today}
        selectedDay={selectedDay}
        onDayClick={(date) => setSelectedDay(date.toISOString().split('T')[0])}
      />}
      <div style={{ flex: 1, position: 'relative', overflowX: 'hidden', overflowY: 'auto' }}>
        <Timeline
          now={now}
          tasks={todayTasks}
          onAddEvent={(startTime, endTime) => setNewEvent({ startTime, endTime, title: '' })}
          onUpdateTask={async (uid, changes) => {
            await db.tasks.where('uid').equals(uid).modify(changes)
            setTodayTasks(prev => prev.map(t => t.uid === uid ? { ...t, ...changes } : t))
          }}
          onEventClick={(task) => setEditingEvent(task)}
        />
      </div>

      {newEvent && (
        <div style={{
          position: 'absolute',
          top: '56px', left: '8px', right: '8px',
          zIndex: 300,
          background: 'var(--bg-primary)',
          border: '2px solid var(--accent)',
          borderRadius: '10px',
          padding: '14px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '10px'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600,
              color: 'var(--text-primary)' }}>
              Add at {newEvent.startTime} → {newEvent.endTime}
            </span>
            <button onClick={() => setNewEvent(null)} style={{
              background: 'none', border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer', fontSize: '18px', lineHeight: 1
            }}>&times;</button>
          </div>
          <input
            autoFocus
            placeholder="Event title..."
            value={newEvent.title}
            onChange={e => setNewEvent(p =>
              p ? { ...p, title: e.target.value } : null)}
            onKeyDown={async e => {
              if (e.key === 'Enter' && newEvent.title.trim()) {
                const { nanoid } = await import('nanoid')
                const todayStr = new Date().toISOString().split('T')[0]
                await safeDbWrite(
                  () => db.tasks.add({
                    uid: nanoid(),
                    pageUid: 'global',
                    title: newEvent.title.trim(),
                    status: 'todo' as const,
                    priority: null,
                    dueDate: todayStr,
                    scheduledDate: todayStr,
                    startTime: newEvent.startTime,
                    endTime: newEvent.endTime,
                    color: 'var(--accent)',
                    createdAt: new Date().toISOString()
                  }),
                  'Failed to save event. Please try again.'
                )
                setNewEvent(null)
                const t = await db.tasks.filter(task =>
                  (task.scheduledDate === todayStr || task.dueDate === todayStr) &&
                  task.startTime !== null
                ).toArray()
                setTodayTasks(t)
              }
              if (e.key === 'Escape') setNewEvent(null)
            }}
            style={{
              width: '100%', padding: '8px 10px',
              borderRadius: 'var(--radius-sm, 6px)',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '13px', boxSizing: 'border-box'
            }}
          />
          <div style={{ fontSize: '11px',
            color: 'var(--text-tertiary)', marginTop: '6px' }}>
            Enter to save &middot; Esc to cancel
          </div>
        </div>
      )}

      {/* Progress rings */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '12px 16px', paddingBottom: '24px',
        marginBottom: '8px', flexShrink: 0
      }}>
        <div style={{
          fontSize: '11px', fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--text-tertiary)', marginBottom: '10px'
        }}>Daily Progress</div>
        {trackersLoaded && ringTrackers.length > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            {ringTrackers.map(tracker => (
              <Ring
                key={tracker.uid}
                value={getTodayValue(tracker.uid)}
                max={Math.max(tracker.target, 1)}
                color={tracker.color}
                label={tracker.name}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <Ring value={0} max={1} color="var(--text-tertiary)" label="No trackers"/>
          </div>
        )}
      </div>

      {/* Upcoming — grouped */}
      {(() => {
        const todayS = new Date().toISOString().split('T')[0]
        const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1)
        const tmrwS = tmrw.toISOString().split('T')[0]
        const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7)
        const weekEndS = weekEnd.toISOString().split('T')[0]
        const groups: { label: string; tasks: Task[] }[] = [
          { label: 'Today', tasks: upcoming.filter(t => (t.dueDate || t.scheduledDate) === todayS) },
          { label: 'Tomorrow', tasks: upcoming.filter(t => (t.dueDate || t.scheduledDate) === tmrwS) },
          { label: 'This week', tasks: upcoming.filter(t => { const d = t.dueDate || t.scheduledDate || ''; return d > tmrwS && d <= weekEndS }) },
          { label: 'Later', tasks: upcoming.filter(t => { const d = t.dueDate || t.scheduledDate || ''; return d > weekEndS }) },
        ].filter(g => g.tasks.length > 0)
        return (
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Upcoming</div>
              <button onClick={() => setShowNewEvent(true)} style={{
                padding: '3px 10px', borderRadius: '9999px', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--accent)', fontSize: '11px',
                fontWeight: 600, cursor: 'pointer',
              }}>+ Event</button>
            </div>
            {groups.map(g => (
              <div key={g.label} style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{g.label}</div>
                {g.tasks.slice(0, 3).map(t => (
                  <div key={t.uid} onClick={() => setEditingEvent(t)} style={{
                    fontSize: '12px', color: 'var(--text-secondary)', padding: '4px 6px',
                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                    borderRadius: '6px',
                  }}
                  onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}
                  >
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: t.color || 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    {t.startTime && t.endTime && (
                      <span style={{ fontSize: '11px', color: 'var(--text-primary)', flexShrink: 0, fontWeight: 500 }}>
                        {t.startTime}–{t.endTime}
                      </span>
                    )}
                    {t.reminder && <span style={{ fontSize: '11px' }} title={`Reminder: ${t.reminder}min before`}>🔔</span>}
                    {t.recurrence && <span style={{ fontSize: '11px' }} title="Recurring">🔁</span>}
                  </div>
                ))}
              </div>
            ))}
            {groups.length === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '4px 0' }}>No upcoming events</div>
            )}
          </div>
        )
      })()}
      {/* Event Modal */}
      {(editingEvent || showNewEvent) && (
        <EventModal
          initialEvent={editingEvent || undefined}
          defaultDate={new Date().toISOString().split('T')[0]}
          defaultStartTime={`${String(new Date().getHours()).padStart(2, '0')}:00`}
          defaultEndTime={`${String(Math.min(23, new Date().getHours() + 1)).padStart(2, '0')}:00`}
          onClose={() => { setEditingEvent(null); setShowNewEvent(false) }}
          onSave={async (evt) => {
            if (evt.uid) {
              const existing = upcoming.find(t => t.uid === evt.uid) || todayTasks.find(t => t.uid === evt.uid)
              if (existing?.id) await safeDbWrite(
                () => db.tasks.update(existing.id!, evt),
                'Failed to update event. Please try again.'
              )
            } else {
              await safeDbWrite(
                () => db.tasks.add({
                  uid: nanoid(), pageUid: '', createdAt: new Date().toISOString(),
                  title: evt.title || '', status: evt.status || 'todo',
                  priority: evt.priority || null, dueDate: evt.dueDate || null,
                  scheduledDate: evt.scheduledDate || null,
                  startTime: evt.startTime || null, endTime: evt.endTime || null,
                  color: evt.color || 'var(--accent)',
                  description: evt.description, location: evt.location,
                  itemType: evt.itemType, recurrence: evt.recurrence,
                  reminder: evt.reminder, url: evt.url,
                } as Task),
                'Failed to save event. Please try again.'
              )
            }
            loadEvents()
          }}
          onDelete={async (uid) => {
            const task = [...upcoming, ...todayTasks].find(t => t.uid === uid)
            if (task?.id) await safeDbWrite(
              () => db.tasks.delete(task.id!),
              'Failed to delete event. Please try again.'
            )
            loadEvents()
          }}
          onDeleted={() => {
            setEditingEvent(null)
            setShowNewEvent(false)
            loadEvents()
          }}
        />
      )}
    </aside>
  )
}

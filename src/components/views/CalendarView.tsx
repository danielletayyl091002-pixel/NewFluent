'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { db, Task } from '@/db/schema'
import EventModal from '@/components/calendar/EventModal'
import { nanoid } from 'nanoid'
import { expandRecurring } from '@/lib/expandRecurring'
import { safeDbWrite } from '@/lib/dbError'

function getEventStyle(color: string): React.CSSProperties {
  const calStyle = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-cal-style') || 'soft' : 'soft'
  if (calStyle === 'solid') return { background: color, color: getTextColor(color), border: 'none', borderLeft: 'none', borderRadius: 'var(--radius-base, 4px)' }
  if (calStyle === 'outline') return { background: 'transparent', color: color, border: `2px solid ${color}`, borderLeft: `2px solid ${color}`, borderRadius: 'var(--radius-base, 4px)' }
  return { background: `${color}20`, color: color, borderLeft: `3px solid ${color}`, borderRadius: 'var(--radius-base, 4px)' }
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May',
  'June','July','August','September','October',
  'November','December']

const getEventColor = (task: Task) => task.color || 'var(--accent)'

const getTextColor = (hexColor: string) => {
  if (!hexColor.startsWith('#')) return 'white'
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#1a1a1a' : 'white'
}

function WeekView({ currentDate, tasks, onDeleteTask, pageUid, setTasks }: {
  currentDate: Date
  tasks: Task[]
  onDeleteTask: (uid: string) => void
  pageUid: string
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
}) {
  const HOURS = Array.from({ length: 24 }, (_, i) => i)
  const HOUR_H = 60
  const START = 0
  const TOTAL_H = HOURS.length * HOUR_H

  const [dragState, setDragState] = useState<{
    dateStr: string; startHour: number; endHour: number
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [pendingEvent, setPendingEvent] = useState<{
    dateStr: string; startTime: string; endTime: string
  } | null>(null)
  const [pendingTitle, setPendingTitle] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)

  // Undo toast
  const [undoToast, setUndoToast] = useState<{
    message: string; undoFn: () => Promise<void>
  } | null>(null)
  const [editingEvent, setEditingEvent] = useState<Partial<Task> | null>(null)
  const [modalDefaults, setModalDefaults] = useState<{ date?: string; start?: string; end?: string } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  function showUndo(message: string, undoFn: () => Promise<void>) {
    clearTimeout(undoTimer.current)
    setUndoToast({ message, undoFn })
    undoTimer.current = setTimeout(() => setUndoToast(null), 5000)
  }

  // Drag-to-move state
  const [movingTask, setMovingTask] = useState<Task | null>(null)
  const [moveGhost, setMoveGhost] = useState<{ dateStr: string; startHour: number; endHour: number } | null>(null)
  const moveDuration = useRef(0)
  const moveStartPos = useRef<{ x: number; y: number } | null>(null)

  // Drag-to-resize state
  const [resizingTask, setResizingTask] = useState<Task | null>(null)
  const [resizeEndHour, setResizeEndHour] = useState<number | null>(null)

  // Helper: get hour from raw mouse event (window coords)
  function getHourFromEvent(e: MouseEvent): { dateStr: string; hour: number } | null {
    if (!gridRef.current) return null
    const rect = gridRef.current.getBoundingClientRect()
    const scrollTop = gridRef.current.scrollTop
    const relX = e.clientX - rect.left - 48
    const relY = e.clientY - rect.top + scrollTop
    const colW = (rect.width - 48) / 7
    const colIdx = Math.max(0, Math.min(6, Math.floor(relX / colW)))
    const hour = snap(START + relY / HOUR_H)
    const dateStr = weekDays[colIdx].toISOString().split('T')[0]
    return { dateStr, hour }
  }

  // Window-level listeners for drag move/resize (fires even if mouse leaves grid)
  useEffect(() => {
    if (!movingTask && !resizingTask) return

    const onMove = (e: MouseEvent) => {
      if (movingTask) {
        if (moveStartPos.current) {
          const dx = Math.abs(e.clientX - moveStartPos.current.x)
          const dy = Math.abs(e.clientY - moveStartPos.current.y)
          if (dx < 3 && dy < 3) return
          moveStartPos.current = null
        }
        const pos = getHourFromEvent(e)
        if (!pos) return
        setMoveGhost({ dateStr: pos.dateStr, startHour: pos.hour, endHour: snap(pos.hour + moveDuration.current) })
      }
      if (resizingTask) {
        const pos = getHourFromEvent(e)
        if (!pos) return
        const startHour = toMinutes(resizingTask.startTime!) / 60
        setResizeEndHour(Math.max(startHour + 0.25, pos.hour))
      }
    }

    const onUp = async () => {
      if (movingTask && moveGhost) {
        const oldDate = movingTask.scheduledDate || movingTask.dueDate || ''
        const oldStart = movingTask.startTime || ''
        const oldEnd = movingTask.endTime || ''
        const taskUid = movingTask.uid
        const newStart = moveGhost.startHour
        const newEnd = newStart + moveDuration.current
        await db.tasks.where('uid').equals(taskUid).modify({
          scheduledDate: moveGhost.dateStr,
          dueDate: moveGhost.dateStr,
          startTime: fmtDB(newStart),
          endTime: fmtDB(snap(newEnd)),
        })
        setTasks(prev => prev.map(t => t.uid === taskUid ? {
          ...t,
          scheduledDate: moveGhost.dateStr,
          dueDate: moveGhost.dateStr,
          startTime: fmtDB(newStart),
          endTime: fmtDB(snap(newEnd)),
        } : t))
        showUndo(`Moved to ${fmt(newStart)}`, async () => {
          await db.tasks.where('uid').equals(taskUid).modify({ scheduledDate: oldDate, dueDate: oldDate, startTime: oldStart, endTime: oldEnd })
          setTasks(prev => prev.map(t => t.uid === taskUid ? { ...t, scheduledDate: oldDate, dueDate: oldDate, startTime: oldStart, endTime: oldEnd } : t))
        })
      }
      if (resizingTask && resizeEndHour !== null) {
        const oldEnd = resizingTask.endTime || ''
        const taskUid = resizingTask.uid
        const newEnd = fmtDB(resizeEndHour)
        await db.tasks.where('uid').equals(taskUid).modify({ endTime: newEnd })
        setTasks(prev => prev.map(t => t.uid === taskUid ? { ...t, endTime: newEnd } : t))
        showUndo(`Resized to ${fmt(resizeEndHour)}`, async () => {
          await db.tasks.where('uid').equals(taskUid).modify({ endTime: oldEnd })
          setTasks(prev => prev.map(t => t.uid === taskUid ? { ...t, endTime: oldEnd } : t))
        })
      }
      setMovingTask(null)
      setMoveGhost(null)
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
  }, [movingTask, resizingTask, moveGhost, resizeEndHour])

  const snap = (h: number) => Math.max(START, Math.min(23.75, Math.round(h * 4) / 4))

  const use24h = typeof localStorage !== 'undefined' && localStorage.getItem('time_format') === '24h'
  const fmt = (h: number) => {
    const hrs = Math.floor(h)
    const mins = Math.round((h - hrs) * 60)
    if (use24h) return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
    const period = hrs >= 12 ? 'PM' : 'AM'
    const displayHr = hrs > 12 ? hrs - 12 : hrs === 0 ? 12 : hrs
    return `${displayHr}:${String(mins).padStart(2, '0')} ${period}`
  }

  const fmtDB = (h: number) => {
    const hrs = Math.floor(h)
    const mins = Math.round((h - hrs) * 60)
    return String(hrs).padStart(2, '0') + ':' + String(mins).padStart(2, '0')
  }

  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + (m || 0)
  }

  const weekDays = useMemo(() => {
    const days = []
    const mondayStart = typeof localStorage !== 'undefined' && localStorage.getItem('week_start') === 'monday'
    const startOfWeek = new Date(currentDate)
    const dayOfWeek = currentDate.getDay()
    const offset = mondayStart ? (dayOfWeek === 0 ? 6 : dayOfWeek - 1) : dayOfWeek
    startOfWeek.setDate(currentDate.getDate() - offset)
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      days.push(d)
    }
    return days
  }, [currentDate])

  const todayStr = new Date().toISOString().split('T')[0]
  const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Get column index and hour from mouse event on the grid
  function getColAndHour(e: React.MouseEvent | MouseEvent): {
    dateStr: string; hour: number
  } | null {
    if (!gridRef.current) return null
    const rect = gridRef.current.getBoundingClientRect()
    const scrollTop = gridRef.current.scrollTop
    const relX = e.clientX - rect.left - 48 // subtract time label width
    const relY = e.clientY - rect.top + scrollTop
    const colW = (rect.width - 48) / 7
    const colIdx = Math.max(0, Math.min(6, Math.floor(relX / colW)))
    const hour = snap(START + relY / HOUR_H)
    const dateStr = weekDays[colIdx].toISOString().split('T')[0]
    return { dateStr, hour }
  }

  // Expand recurring events for the visible week
  const expandedTasks = useMemo(() => {
    if (weekDays.length === 0) return tasks
    const start = weekDays[0]
    const end = new Date(weekDays[6])
    end.setDate(end.getDate() + 1)
    return expandRecurring(tasks, start, end)
  }, [tasks, weekDays])

  function getTasksForDate(dateStr: string) {
    return expandedTasks.filter(t =>
      (t.dueDate === dateStr || t.scheduledDate === dateStr) &&
      t.startTime && t.endTime
    )
  }

  function computeColumns(evts: Task[]): {
    task: Task; col: number; totalCols: number
  }[] {
    if (evts.length === 0) return []
    const sorted = [...evts].sort((a, b) =>
      toMinutes(a.startTime!) - toMinutes(b.startTime!)
    )
    // Group into clusters of overlapping events
    const clusters: Task[][] = []
    let currentCluster: Task[] = []
    let clusterEnd = 0
    for (const task of sorted) {
      const start = toMinutes(task.startTime!)
      const end = toMinutes(task.endTime!)
      if (currentCluster.length === 0 || start < clusterEnd) {
        currentCluster.push(task)
        clusterEnd = Math.max(clusterEnd, end)
      } else {
        clusters.push(currentCluster)
        currentCluster = [task]
        clusterEnd = end
      }
    }
    if (currentCluster.length > 0) clusters.push(currentCluster)

    // Assign columns per cluster
    const result: { task: Task; col: number; totalCols: number }[] = []
    for (const cluster of clusters) {
      const colEnds: number[] = []
      const assigned: { task: Task; col: number }[] = []
      for (const task of cluster) {
        const start = toMinutes(task.startTime!)
        const end = toMinutes(task.endTime!)
        let col = 0
        while (colEnds[col] !== undefined && colEnds[col] > start) col++
        colEnds[col] = end
        assigned.push({ task, col })
      }
      const totalCols = Math.max(...assigned.map(a => a.col)) + 1
      result.push(...assigned.map(a => ({ ...a, totalCols })))
    }
    return result
  }

  function handleMouseDown(e: React.MouseEvent) {
    const resizeHandle = (e.target as HTMLElement).closest('[data-resize]')
    if (resizeHandle) return
    const eventEl = (e.target as HTMLElement).closest('[data-event-uid]') as HTMLElement | null
    if (eventEl) {
      e.preventDefault()
      const uid = eventEl.getAttribute('data-event-uid')
      // Look up in expandedTasks so virtual recurring occurrences
      // (uid like "masterUid_YYYY-MM-DD") are resolvable — the raw
      // `tasks` array only contains the master records.
      const task = expandedTasks.find(t => t.uid === uid)
      if (!task) return
      // Virtual recurring occurrences have no DB id — drag/resize would silently
      // no-op (where('uid') won't match "master_YYYY-MM-DD"). Route to edit instead.
      if (!task.id) {
        setEditingEvent(task)
        return
      }
      const startMin = toMinutes(task.startTime!)
      const endMin = toMinutes(task.endTime!)
      moveDuration.current = (endMin - startMin) / 60
      moveStartPos.current = { x: e.clientX, y: e.clientY }
      setMovingTask(task)
      return
    }
    // Empty space — start create-new drag
    e.preventDefault()
    const pos = getColAndHour(e)
    if (!pos) return
    setDragState({ dateStr: pos.dateStr, startHour: pos.hour, endHour: pos.hour })
    setIsDragging(true)
  }

  function handleMouseMove(e: React.MouseEvent) {
    // Moving an event
    if (movingTask) {
      if (moveStartPos.current) {
        const dx = Math.abs(e.clientX - moveStartPos.current.x)
        const dy = Math.abs(e.clientY - moveStartPos.current.y)
        if (dx < 3 && dy < 3) return
        moveStartPos.current = null
      }
      const pos = getColAndHour(e)
      if (!pos) return
      const endHour = pos.hour + moveDuration.current
      setMoveGhost({ dateStr: pos.dateStr, startHour: pos.hour, endHour: snap(endHour) })
      return
    }
    // Resizing an event
    if (resizingTask) {
      const pos = getColAndHour(e)
      if (!pos) return
      const startHour = toMinutes(resizingTask.startTime!) / 60
      const minEnd = startHour + 0.25
      setResizeEndHour(Math.max(minEnd, pos.hour))
      return
    }
    // Creating new event
    if (!isDragging || !dragState) return
    const pos = getColAndHour(e)
    if (!pos) return
    setDragState(p => p ? { ...p, endHour: pos.hour, dateStr: pos.dateStr } : null)
  }

  async function handleMouseUp() {
    // Finish moving event
    if (movingTask && moveGhost) {
      const newStart = moveGhost.startHour
      const newEnd = newStart + moveDuration.current
      const task = movingTask
      await db.tasks.where('uid').equals(task.uid).modify({
        scheduledDate: moveGhost.dateStr,
        dueDate: moveGhost.dateStr,
        startTime: fmtDB(newStart),
        endTime: fmtDB(snap(newEnd)),
      })
      setTasks(prev => prev.map(t => t.uid === task.uid ? {
        ...t,
        scheduledDate: moveGhost.dateStr,
        dueDate: moveGhost.dateStr,
        startTime: fmtDB(newStart),
        endTime: fmtDB(snap(newEnd)),
      } : t))
      setMovingTask(null)
      setMoveGhost(null)
      moveStartPos.current = null
      return
    }
    if (movingTask) {
      // Click without move — open edit modal
      setEditingEvent(movingTask)
      setMovingTask(null)
      setMoveGhost(null)
      moveStartPos.current = null
      return
    }
    // Finish resizing event
    if (resizingTask && resizeEndHour !== null) {
      const task = resizingTask
      const newEndTime = fmtDB(resizeEndHour)
      await db.tasks.where('uid').equals(task.uid).modify({
        endTime: newEndTime,
      })
      setTasks(prev => prev.map(t => t.uid === task.uid ? {
        ...t, endTime: newEndTime,
      } : t))
      setResizingTask(null)
      setResizeEndHour(null)
      return
    }
    // Finish creating new event
    if (!isDragging || !dragState) return
    setIsDragging(false)
    const start = Math.min(dragState.startHour, dragState.endHour)
    const end = Math.max(dragState.startHour, dragState.endHour)
    if (end - start >= 0.25) {
      // Open event modal for new event
      setModalDefaults({
        date: dragState.dateStr,
        start: fmtDB(start),
        end: fmtDB(end),
      })
      setDragState(null)
    } else {
      setDragState(null)
    }
  }

  function handleResizeStart(e: React.MouseEvent, task: Task) {
    e.preventDefault()
    e.stopPropagation()
    if (!task.id) return // Virtual recurring occurrence — can't resize
    setResizingTask(task)
    setResizeEndHour(toMinutes(task.endTime!) / 60)
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      border: '1px solid var(--border)',
      borderRadius: '12px', overflow: 'hidden'
    }}>
      {/* Day headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '48px repeat(7, 1fr)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        flexShrink: 0
      }}>
        <div />
        {weekDays.map((d, i) => {
          const dateStr = d.toISOString().split('T')[0]
          const isToday = dateStr === todayStr
          return (
            <div key={i} style={{
              padding: '8px 4px', textAlign: 'center',
              borderLeft: '1px solid var(--border)'
            }}>
              <div style={{
                fontSize: '11px', color: isToday ? 'var(--accent)' : 'var(--text-tertiary)',
                fontWeight: isToday ? 700 : 400,
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                {DAYS_SHORT[i]}
              </div>
              <div style={{
                display: 'inline-flex', width: '28px', height: '28px',
                alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                background: isToday ? 'var(--accent)' : 'transparent',
                color: isToday ? 'white' : 'var(--text-primary)',
                fontSize: '13px', fontWeight: isToday ? 700 : 400,
                margin: '2px auto 0'
              }}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scrollable grid — single container owns ALL mouse events */}
      <div
        ref={gridRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          position: 'relative',
          cursor: isDragging ? 'crosshair' : movingTask ? 'grabbing' : resizingTask ? 'ns-resize' : 'default',
          userSelect: 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={e => {
          const pos = getColAndHour(e)
          if (!pos) return
          setModalDefaults({ date: pos.dateStr, start: fmtDB(pos.hour), end: fmtDB(pos.hour + 1) })
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: '48px repeat(7, 1fr)',
          height: `${TOTAL_H}px`,
          position: 'relative'
        }}>
          {/* Time labels */}
          <div style={{ position: 'relative' }}>
            {HOURS.map(h => (
              <div key={h} style={{
                position: 'absolute',
                top: `${(h - START) * HOUR_H}px`,
                left: 0, right: 0,
                height: `${HOUR_H}px`,
                padding: '4px 8px',
                fontSize: '11px',
                color: 'var(--text-tertiary)',
                pointerEvents: 'none'
              }}>
                {use24h ? `${String(h).padStart(2, '0')}:00` : (h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((d, di) => {
            const dateStr = d.toISOString().split('T')[0]
            const dayTasks = getTasksForDate(dateStr)
            const positioned = computeColumns(dayTasks)
            const isDraggingThisDay = isDragging && dragState?.dateStr === dateStr

            return (
              <div key={di} style={{
                borderLeft: '1px solid var(--border)',
                position: 'relative',
                height: '100%'
              }}>
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div key={h} style={{
                    position: 'absolute',
                    top: `${(h - START) * HOUR_H}px`,
                    left: 0, right: 0,
                    height: `${HOUR_H}px`,
                    borderBottom: '1px solid var(--border)',
                    pointerEvents: 'none'
                  }} />
                ))}

                {/* Current time line */}
                {dateStr === todayStr && (() => {
                  const now = new Date()
                  const nowH = now.getHours() + now.getMinutes() / 60
                  if (nowH >= START && nowH <= 22) {
                    return (
                      <div style={{
                        position: 'absolute', top: `${(nowH - START) * HOUR_H}px`,
                        left: 0, right: 0, height: '2px', background: '#EF4444',
                        zIndex: 20, pointerEvents: 'none',
                      }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444', position: 'absolute', left: '-4px', top: '-3px' }} />
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Drag preview */}
                {isDraggingThisDay && dragState && (
                  <div style={{
                    position: 'absolute',
                    top: `${(Math.min(dragState.startHour, dragState.endHour) - START) * HOUR_H}px`,
                    left: '2px', right: '2px',
                    height: `${Math.max(Math.abs(dragState.endHour - dragState.startHour) * HOUR_H, 4)}px`,
                    background: 'var(--accent-light)',
                    borderLeft: '3px solid var(--accent)',
                    borderRadius: '3px',
                    pointerEvents: 'none',
                    zIndex: 5,
                    padding: '2px 4px',
                    overflow: 'hidden'
                  }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700,
                      color: 'var(--accent)'
                    }}>
                      {fmt(Math.min(dragState.startHour, dragState.endHour))}
                      {' \u2192 '}
                      {fmt(Math.max(dragState.startHour, dragState.endHour))}
                    </span>
                  </div>
                )}

                {/* Move ghost preview */}
                {movingTask && moveGhost && moveGhost.dateStr === dateStr && (
                  <div style={{
                    position: 'absolute',
                    top: `${(moveGhost.startHour - START) * HOUR_H}px`,
                    left: '2px', right: '2px',
                    height: `${moveDuration.current * HOUR_H}px`,
                    background: 'var(--accent-light)',
                    borderLeft: '3px dashed var(--accent)',
                    borderRadius: '3px',
                    opacity: 0.7,
                    pointerEvents: 'none',
                    zIndex: 8,
                    padding: '2px 4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--accent)',
                  }}>
                    {movingTask.title} — {fmt(moveGhost.startHour)} → {fmt(moveGhost.startHour + moveDuration.current)}
                  </div>
                )}

                {/* Events */}
                {positioned.map(({ task, col, totalCols }) => {
                  const isBeingMoved = movingTask?.uid === task.uid && moveGhost
                  const isBeingResized = resizingTask?.uid === task.uid
                  const startMins = toMinutes(task.startTime!)
                  const endMins = isBeingResized && resizeEndHour !== null
                    ? resizeEndHour * 60
                    : toMinutes(task.endTime!)
                  const top = (startMins / 60 - START) * HOUR_H
                  const height = Math.max(((endMins - startMins) / 60) * HOUR_H, 20)
                  const colW = 100 / totalCols
                  const color = getEventColor(task)
                  return (
                    <div
                      key={task.uid}
                      data-event-uid={task.uid}
                      className="calendar-event"
                      style={{
                        position: 'absolute',
                        top: `${top}px`,
                        left: `${col * colW + 0.5}%`,
                        width: `${colW - 1}%`,
                        height: `${height}px`,
                        ...getEventStyle(color),
                        padding: '3px 6px',
                        overflow: 'hidden',
                        zIndex: isBeingMoved || isBeingResized ? 10 : 3,
                        cursor: 'grab',
                        display: 'flex',
                        flexDirection: 'column',
                        boxSizing: 'border-box',
                        opacity: isBeingMoved ? 0.3 : (task.priority === 'high' ? 1 : task.priority === 'medium' ? 0.85 : 0.75),
                        transition: isBeingMoved ? 'none' : 'opacity 0.15s',
                      }}
                    >
                      <span style={{
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontSize: '11px', fontWeight: 600, lineHeight: 1.3,
                        textDecoration: task.status === 'done' ? 'line-through' : 'none',
                      }}>
                        {task.itemType === 'task' ? '\u2610 ' : ''}{task.title}
                      </span>
                      {height > 32 && (
                        <span style={{ fontSize: '11px', opacity: 0.85 }}>
                          {task.startTime} - {isBeingResized && resizeEndHour !== null ? fmtDB(resizeEndHour) : task.endTime}
                        </span>
                      )}
                      {height > 50 && task.location && (
                        <span style={{ fontSize: '11px', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.location}
                        </span>
                      )}
                      {/* Resize handle at bottom */}
                      <div
                        data-resize="true"
                        onMouseDown={e => handleResizeStart(e, task)}
                        style={{
                          position: 'absolute',
                          bottom: 0, left: 0, right: 0,
                          height: '6px',
                          cursor: 'ns-resize',
                          background: 'transparent',
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pending event popover */}
      {pendingEvent && (
        <div
          onClick={() => {
            setPendingEvent(null)
            setPendingTitle('')
            setDragState(null)
          }}
          style={{
            position: 'fixed', inset: 0,
            zIndex: 999,
            background: 'rgba(0,0,0,0.3)'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'var(--bg-primary)',
              border: '2px solid var(--accent)',
              borderRadius: '10px',
              padding: '16px',
              zIndex: 1000,
              width: '280px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{
              fontSize: '12px', fontWeight: 600,
              color: 'var(--text-primary)', marginBottom: '4px'
            }}>
              New Event
            </div>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-tertiary)', marginBottom: '10px'
            }}>
              {pendingEvent.startTime} → {pendingEvent.endTime}
            </div>
            <input
              autoFocus
              placeholder="Event title..."
              value={pendingTitle}
              onChange={e => setPendingTitle(e.target.value)}
              onKeyDown={async e => {
                if (e.key === 'Enter' && pendingTitle.trim()) {
                  const { nanoid } = await import('nanoid')
                  const task: Task = {
                    uid: nanoid(),
                    title: pendingTitle.trim(),
                    status: 'todo',
                    priority: null,
                    dueDate: pendingEvent.dateStr,
                    pageUid,
                    scheduledDate: pendingEvent.dateStr,
                    startTime: pendingEvent.startTime,
                    endTime: pendingEvent.endTime,
                    color: 'var(--accent)',
                    createdAt: new Date().toISOString()
                  }
                  await safeDbWrite(
                    () => db.tasks.add(task),
                    'Failed to save event. Please try again.'
                  )
                  setTasks(prev => [...prev, task])
                  setPendingEvent(null)
                  setPendingTitle('')
                  setDragState(null)
                }
                if (e.key === 'Escape') {
                  setPendingEvent(null)
                  setPendingTitle('')
                  setDragState(null)
                }
              }}
              style={{
                width: '100%', padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
            <div style={{
              fontSize: '11px',
              color: 'var(--text-tertiary)', marginTop: '6px'
            }}>
              Enter to save · Esc to cancel
            </div>
          </div>
        </div>
      )}

      {/* Undo toast */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 2000,
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-base, 8px)', padding: '10px 16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px',
        }}>
          <span style={{ color: 'var(--text-primary)' }}>{undoToast.message}</span>
          <button onClick={async () => { await undoToast.undoFn(); setUndoToast(null) }} style={{
            padding: '4px 12px', borderRadius: 'var(--radius-base, 6px)', border: 'none',
            background: 'var(--accent)', color: 'white', fontSize: '12px',
            fontWeight: 600, cursor: 'pointer',
          }}>Undo</button>
        </div>
      )}

      {/* Event Modal */}
      {(editingEvent !== null || modalDefaults) && (
        <EventModal
          initialEvent={editingEvent || undefined}
          defaultDate={modalDefaults?.date}
          defaultStartTime={modalDefaults?.start}
          defaultEndTime={modalDefaults?.end}
          onClose={() => { setEditingEvent(null); setModalDefaults(null) }}
          onSave={async (evt) => {
            if (evt.uid) {
              // Optimistic update first
              setTasks(prev => prev.map(t => t.uid === evt.uid ? { ...t, ...evt } as Task : t))
              const existing = tasks.find(t => t.uid === evt.uid)
              if (existing?.id) await safeDbWrite(
                () => db.tasks.update(existing.id!, evt),
                'Failed to update event. Please try again.'
              )
            } else {
              const newTask: Task = {
                uid: nanoid(), pageUid, createdAt: new Date().toISOString(),
                title: evt.title || '', status: evt.status || 'todo',
                priority: evt.priority || null,
                dueDate: evt.dueDate || evt.scheduledDate || null,
                scheduledDate: evt.scheduledDate || null,
                startTime: evt.startTime || null, endTime: evt.endTime || null,
                color: evt.color || 'var(--accent)',
                description: evt.description, location: evt.location,
                itemType: evt.itemType, recurrence: evt.recurrence,
                reminder: evt.reminder, url: evt.url,
              }
              // Optimistic add first
              setTasks(prev => [...prev, newTask])
              await safeDbWrite(
                () => db.tasks.add(newTask),
                'Failed to save event. Please try again.'
              )
            }
          }}
          onDelete={async (uid) => { onDeleteTask(uid) }}
          onDeleted={async () => {
            const all = await db.tasks.toArray()
            setTasks(all.filter(t => t.dueDate || t.scheduledDate))
            setEditingEvent(null)
            setModalDefaults(null)
          }}
        />
      )}
    </div>
  )
}

function AgendaView({ tasks }: { tasks: Task[] }) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const rangeEnd = new Date()
  rangeEnd.setDate(rangeEnd.getDate() + 60)

  const expanded = expandRecurring(tasks, now, rangeEnd)

  const upcoming = expanded
    .filter(t => {
      const d = new Date(t.scheduledDate ?? '')
      return !isNaN(d.getTime()) && d >= now
    })
    .sort((a, b) => {
      const da = new Date(a.scheduledDate ?? '')
      const db = new Date(b.scheduledDate ?? '')
      return da.getTime() - db.getTime()
    })

  const groups: Record<string, Task[]> = {}
  for (const t of upcoming) {
    const key = (t.scheduledDate ?? '').slice(0, 10)
    if (!key) continue
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }

  const dateKeys = Object.keys(groups).sort()
  const todayKey = new Date().toISOString().slice(0, 10)

  if (dateKeys.length === 0) {
    return (
      <div style={{
        padding: '48px',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontSize: '14px',
      }}>
        No upcoming events
      </div>
    )
  }

  return (
    <div style={{
      padding: '16px 24px',
      overflowY: 'auto',
      height: '100%',
      flex: 1,
    }}>
      {dateKeys.map(key => {
        const date = new Date(key + 'T00:00:00')
        const isToday = key === todayKey
        return (
          <div key={key} style={{ marginBottom: '24px' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: isToday ? 'var(--accent)' : 'var(--text-tertiary)',
              marginBottom: '8px',
              paddingBottom: '6px',
              borderBottom: '0.5px solid var(--border)',
            }}>
              {isToday ? 'Today \u2014 ' : ''}
              {date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </div>
            {groups[key].map((t, i) => (
              <div
                key={t.uid ?? i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  marginBottom: '4px',
                  cursor: 'pointer',
                  background: 'var(--bg-secondary)',
                  borderLeft: `3px solid ${t.color || 'var(--accent)'}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {t.title || 'Untitled'}
                  </div>
                  {(t.startTime || t.endTime) && (
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-tertiary)',
                      marginTop: '2px',
                    }}>
                      {t.startTime}{t.endTime ? ` \u2014 ${t.endTime}` : ''}
                    </div>
                  )}
                </div>
                {t.recurrence && (
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    flexShrink: 0,
                  }}>{'\u21bb'}</span>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export default function CalendarView({
  pageUid
}: {
  pageUid: string
}) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [tasks, setTasks] = useState<Task[]>([])
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'agenda'>('month')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  const [dayEditingEvent, setDayEditingEvent] = useState<Partial<Task> | null>(null)

  // Day view drag state — kept in refs to avoid stale closures
  const [dayDragState, setDayDragState] = useState<{ startHour: number; endHour: number } | null>(null)
  const [dayMovingTask, setDayMovingTask] = useState<Task | null>(null)
  const [dayMoveGhost, setDayMoveGhost] = useState<{ startHour: number; endHour: number } | null>(null)
  const [dayResizingTask, setDayResizingTask] = useState<Task | null>(null)
  const [dayResizeEndHour, setDayResizeEndHour] = useState<number | null>(null)
  const [dayModalDefaults, setDayModalDefaults] = useState<{ date: string; start: string; end: string } | null>(null)

  const dayDragRef = useRef<{ startHour: number; endHour: number } | null>(null)
  const dayMovingRef = useRef<Task | null>(null)
  const dayResizingRef = useRef<Task | null>(null)
  const dayMoveDuration = useRef(0)
  const dayMoveStartPos = useRef<{ x: number; y: number } | null>(null)
  const dayGridRef = useRef<HTMLDivElement>(null)
  const tasksRef = useRef<Task[]>([])
  useEffect(() => { tasksRef.current = tasks }, [tasks])

  // Day view helpers
  function dayYToHour(clientY: number): number | null {
    if (!dayGridRef.current) return null
    const rect = dayGridRef.current.getBoundingClientRect()
    const scrollTop = dayGridRef.current.scrollTop
    const relY = clientY - rect.top + scrollTop
    return Math.max(0, Math.min(23.75, Math.round((relY / 60) * 4) / 4))
  }
  function dayFmtHour(h: number): string {
    const hrs = Math.floor(h)
    const mins = Math.round((h - hrs) * 60)
    return String(hrs).padStart(2, '0') + ':' + String(mins).padStart(2, '0')
  }
  function dayToMins(time: string): number {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + (m || 0)
  }

  function handleDayMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('[data-day-resize]')) return
    const eventEl = (e.target as HTMLElement).closest('[data-day-event-uid]') as HTMLElement | null
    if (eventEl) {
      e.preventDefault()
      const uid = eventEl.getAttribute('data-day-event-uid')
      // Look up in expandedMonthTasks so virtual recurring occurrences
      // (uid like "masterUid_YYYY-MM-DD") are resolvable — tasksRef only
      // mirrors the raw master records.
      const task = expandedMonthTasks.find(t => t.uid === uid)
        ?? tasksRef.current.find(t => t.uid === uid)
      if (!task || !task.startTime || !task.endTime) return
      if (!task.id) {
        setDayEditingEvent(task)
        return
      }
      const dur = (dayToMins(task.endTime) - dayToMins(task.startTime)) / 60
      dayMoveDuration.current = dur
      dayMoveStartPos.current = { x: e.clientX, y: e.clientY }
      dayMovingRef.current = task
      setDayMovingTask(task)
      return
    }
    // Empty space — start create drag
    e.preventDefault()
    const h = dayYToHour(e.clientY)
    if (h === null) return
    const initial = { startHour: h, endHour: h }
    dayDragRef.current = initial
    setDayDragState(initial)
  }

  // Window-level mouse listeners — no closure staleness because we read refs
  useEffect(() => {
    const isDragActive = dayDragState !== null || dayMovingTask !== null || dayResizingTask !== null
    if (!isDragActive) return

    const onMove = (e: MouseEvent) => {
      // Moving an event
      if (dayMovingRef.current) {
        if (dayMoveStartPos.current) {
          const dx = Math.abs(e.clientX - dayMoveStartPos.current.x)
          const dy = Math.abs(e.clientY - dayMoveStartPos.current.y)
          if (dx < 3 && dy < 3) return
          dayMoveStartPos.current = null
        }
        const h = dayYToHour(e.clientY); if (h === null) return
        setDayMoveGhost({ startHour: h, endHour: h + dayMoveDuration.current })
        return
      }
      // Resizing an event
      if (dayResizingRef.current) {
        const h = dayYToHour(e.clientY); if (h === null) return
        const startH = dayToMins(dayResizingRef.current.startTime!) / 60
        setDayResizeEndHour(Math.max(startH + 0.25, h))
        return
      }
      // Creating new
      if (dayDragRef.current) {
        const h = dayYToHour(e.clientY); if (h === null) return
        const updated = { startHour: dayDragRef.current.startHour, endHour: h }
        dayDragRef.current = updated
        setDayDragState(updated)
      }
    }

    const onUp = async (e: MouseEvent) => {
      const dateStr = currentDate.toISOString().split('T')[0]

      // Finish moving an event
      if (dayMovingRef.current) {
        const task = dayMovingRef.current
        const wasDragged = dayMoveStartPos.current === null
        if (wasDragged) {
          const h = dayYToHour(e.clientY)
          if (h !== null) {
            const newStart = h
            const newEnd = newStart + dayMoveDuration.current
            await db.tasks.where('uid').equals(task.uid).modify({
              scheduledDate: dateStr, dueDate: dateStr,
              startTime: dayFmtHour(newStart), endTime: dayFmtHour(newEnd),
            })
            setTasks(prev => prev.map(t => t.uid === task.uid
              ? { ...t, scheduledDate: dateStr, dueDate: dateStr, startTime: dayFmtHour(newStart), endTime: dayFmtHour(newEnd) }
              : t))
          }
        } else {
          // Click without move → open edit modal
          setDayEditingEvent(task)
        }
        dayMovingRef.current = null
        dayMoveStartPos.current = null
        setDayMovingTask(null)
        setDayMoveGhost(null)
        return
      }

      // Finish resizing
      if (dayResizingRef.current) {
        const task = dayResizingRef.current
        const h = dayYToHour(e.clientY)
        if (h !== null) {
          const startH = dayToMins(task.startTime!) / 60
          const newEnd = Math.max(startH + 0.25, h)
          await db.tasks.where('uid').equals(task.uid).modify({ endTime: dayFmtHour(newEnd) })
          setTasks(prev => prev.map(t => t.uid === task.uid ? { ...t, endTime: dayFmtHour(newEnd) } : t))
        }
        dayResizingRef.current = null
        setDayResizingTask(null)
        setDayResizeEndHour(null)
        return
      }

      // Finish creating new event
      if (dayDragRef.current) {
        const drag = dayDragRef.current
        const start = Math.min(drag.startHour, drag.endHour)
        const end = Math.max(drag.startHour, drag.endHour)
        // Even a tiny click (< 15 min) creates a default 1-hour event
        if (end - start >= 0.25) {
          setDayModalDefaults({ date: dateStr, start: dayFmtHour(start), end: dayFmtHour(end) })
        } else {
          const defaultEnd = Math.min(23.75, start + 1)
          setDayModalDefaults({ date: dateStr, start: dayFmtHour(start), end: dayFmtHour(defaultEnd) })
        }
        dayDragRef.current = null
        setDayDragState(null)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dayDragState, dayMovingTask, dayResizingTask, currentDate])

  function startDayResize(e: React.MouseEvent, task: Task) {
    e.preventDefault()
    e.stopPropagation()
    if (!task.id) return // Virtual recurring occurrence — can't resize
    dayResizingRef.current = task
    setDayResizingTask(task)
    setDayResizeEndHour(dayToMins(task.endTime!) / 60)
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    async function load() {
      const allTasks = await db.tasks.toArray()
      setTasks(allTasks.filter(t =>
        t.dueDate || t.scheduledDate
      ))
    }
    load()
  }, [])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const days: {
      date: Date
      isCurrentMonth: boolean
      dateStr: string
    }[] = []

    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i)
      days.push({
        date: d,
        isCurrentMonth: false,
        dateStr: d.toISOString().split('T')[0]
      })
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i)
      days.push({
        date: d,
        isCurrentMonth: true,
        dateStr: d.toISOString().split('T')[0]
      })
    }

    // Next month padding to complete grid
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      days.push({
        date: d,
        isCurrentMonth: false,
        dateStr: d.toISOString().split('T')[0]
      })
    }

    return days
  }, [year, month])

  // Expand recurring events for the visible month
  const expandedMonthTasks = useMemo(() => {
    if (calendarDays.length === 0) return tasks
    const start = calendarDays[0].date
    const end = new Date(calendarDays[calendarDays.length - 1].date)
    end.setDate(end.getDate() + 1)
    return expandRecurring(tasks, start, end)
  }, [tasks, calendarDays])

  function getTasksForDate(dateStr: string) {
    return expandedMonthTasks.filter(t =>
      t.dueDate === dateStr || t.scheduledDate === dateStr
    )
  }

  // TODO: implement single-occurrence editing with exceptions
  async function deleteTask(taskUid: string) {
    const task = tasks.find(t => t.uid === taskUid)
    if (!task?.id) return
    await safeDbWrite(
      () => db.tasks.delete(task.id!),
      'Failed to delete event. Please try again.'
    )
    setTasks(prev => prev.filter(t => t.uid !== taskUid))
  }

  async function addTaskOnDate(dateStr: string, title?: string) {
    const taskTitle = title || newTaskTitle
    if (!taskTitle.trim()) return
    const { nanoid } = await import('nanoid')
    const task: Task = {
      uid: nanoid(),
      title: taskTitle.trim(),
      status: 'todo',
      priority: null,
      dueDate: dateStr,
      pageUid: pageUid,
      scheduledDate: dateStr,
      startTime: null,
      endTime: null,
      color: 'var(--accent)',
      createdAt: new Date().toISOString()
    }
    await safeDbWrite(
      () => db.tasks.add(task),
      'Failed to save event. Please try again.'
    )
    setTasks(prev => [...prev, task])
    setNewTaskTitle('')
    setShowAddTask(false)
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex',
          alignItems: 'center', gap: '12px' }}>
          <button onClick={() => {
            if (viewMode === 'day') {
              const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d)
            } else if (viewMode === 'week') {
              const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d)
            } else {
              setCurrentDate(new Date(year, month - 1, 1))
            }
          }} style={{
            background: 'none', border: 'none',
            cursor: 'pointer', fontSize: '18px',
            color: 'var(--text-secondary)',
            padding: '4px 8px', borderRadius: '6px'
          }}>{'<'}</button>

          <h2 style={{
            margin: 0, fontSize: '18px', fontWeight: 700,
            color: 'var(--text-primary)', minWidth: '180px',
            textAlign: 'center'
          }}>
            {viewMode === 'day' ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : viewMode === 'week' ? (() => {
              const mondayStart = typeof localStorage !== 'undefined' && localStorage.getItem('week_start') === 'monday'
              const dow = currentDate.getDay()
              const offset = mondayStart ? (dow === 0 ? 6 : dow - 1) : dow
              const ws = new Date(currentDate)
              ws.setDate(currentDate.getDate() - offset)
              const we = new Date(ws)
              we.setDate(ws.getDate() + 6)
              if (ws.getMonth() !== we.getMonth()) {
                return `${ws.toLocaleDateString('en-US', { month: 'long' })} – ${we.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
              }
              return `${MONTHS[ws.getMonth()]} ${ws.getFullYear()}`
            })() : `${MONTHS[month]} ${year}`}
          </h2>

          <button onClick={() => {
            if (viewMode === 'day') {
              const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d)
            } else if (viewMode === 'week') {
              const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d)
            } else {
              setCurrentDate(new Date(year, month + 1, 1))
            }
          }} style={{
            background: 'none', border: 'none',
            cursor: 'pointer', fontSize: '18px',
            color: 'var(--text-secondary)',
            padding: '4px 8px', borderRadius: '6px'
          }}>{'>'}</button>

          <button onClick={() => setCurrentDate(new Date())}
            style={{
              padding: '4px 12px', borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'none', fontSize: '12px',
              color: 'var(--text-secondary)', cursor: 'pointer'
            }}>
            Today
          </button>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {(['day', 'week', 'month', 'agenda'] as const).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              style={{
                padding: '4px 12px', borderRadius: '6px',
                border: 'none', fontSize: '12px',
                fontWeight: 500, cursor: 'pointer',
                background: viewMode === v
                  ? 'var(--accent-light)' : 'transparent',
                color: viewMode === v
                  ? 'var(--accent)' : 'var(--text-tertiary)',
                textTransform: 'capitalize'
              }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'month' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px', marginBottom: '4px'
        }}>
          {DAYS.map(d => (
            <div key={d} style={{
              textAlign: 'center', fontSize: '11px',
              fontWeight: 600, color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em', padding: '4px'
            }}>{d}</div>
          ))}
        </div>
      )}

      {viewMode === 'agenda' ? (
        <AgendaView tasks={tasks} />
      ) : viewMode === 'month' ? (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        flex: 1,
        background: 'var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid var(--border)'
      }}>
        {calendarDays.map(({ date, isCurrentMonth, dateStr }) => {
          const dayTasks = getTasksForDate(dateStr)
          const isToday = dateStr === today
          const isSelected = dateStr === selectedDate

          return (
            <div
              key={dateStr}
              onClick={() => {
                setSelectedDate(dateStr)
                setShowAddTask(true)
              }}
              onMouseEnter={() => setHoveredDate(dateStr)}
              onMouseLeave={() => setHoveredDate(null)}
              style={{
                background: isSelected
                  ? 'rgba(99, 102, 241, 0.12)'
                  : isToday
                    ? 'rgba(99, 102, 241, 0.08)'
                    : isCurrentMonth
                      ? 'var(--bg-primary)'
                      : 'var(--bg-secondary)',
                padding: '8px',
                minHeight: '80px',
                cursor: 'pointer',
                position: 'relative',
                opacity: isCurrentMonth ? 1 : 0.4
              }}
            >
              <div style={{
                display: 'inline-flex',
                width: '24px', height: '24px',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: isToday
                  ? 'var(--accent)' : 'transparent',
                color: isToday
                  ? 'white' : 'var(--text-primary)',
                fontSize: '12px', fontWeight: isToday ? 700 : 400,
                marginBottom: '4px'
              }}>
                {date.getDate()}
              </div>

              {/* Inline add task input */}
              {selectedDate === dateStr && showAddTask && (
                <input
                  autoFocus
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addTaskOnDate(dateStr)
                    if (e.key === 'Escape') setShowAddTask(false)
                  }}
                  placeholder="Add task..."
                  style={{
                    width: '100%', fontSize: '11px',
                    border: '1px solid var(--accent)',
                    borderRadius: '4px', padding: '2px 4px',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                    marginBottom: '2px'
                  }}
                />
              )}

              <div style={{
                display: 'flex', flexDirection: 'column',
                gap: '2px'
              }}>
                {dayTasks.slice(0, 3).map(task => (
                  <div key={task.uid}
                    onClick={e => {
                      e.stopPropagation()
                      if (task.pageUid)
                        router.push(`/page/${task.pageUid}`)
                    }}
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      background: getEventColor(task) + '20',
                      color: getEventColor(task),
                      cursor: 'pointer',
                      fontWeight: 500
                    }}>
                    <span style={{ flex: 1, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.title}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteTask(task.uid)
                      }}
                      style={{
                        marginLeft: '4px',
                        color: 'inherit',
                        opacity: 0.6,
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 700,
                        flexShrink: 0
                      }}
                    >&times;</span>
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    padding: '0 4px'
                  }}>
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>

              {/* Hover ghost + */}
              {hoveredDate === dateStr && dayTasks.length === 0 && !(selectedDate === dateStr && showAddTask) && (
                <div style={{
                  position: 'absolute', bottom: '4px', right: '4px',
                  fontSize: '16px', color: 'var(--text-tertiary)',
                  opacity: 0.5, lineHeight: 1
                }}>+</div>
              )}
            </div>
          )
        })}
      </div>
      ) : viewMode === 'week' ? (
        <WeekView
          currentDate={currentDate}
          tasks={tasks}
          onDeleteTask={deleteTask}
          pageUid={pageUid}
          setTasks={setTasks}
        />
      ) : (
        /* Day view — single day column */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div
            ref={dayGridRef}
            onMouseDown={handleDayMouseDown}
            style={{
              flex: 1, overflowY: 'auto', position: 'relative',
              userSelect: 'none',
              cursor: dayMovingTask ? 'grabbing' : dayResizingTask ? 'ns-resize' : dayDragState ? 'crosshair' : 'default',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', height: `${24 * 60}px`, position: 'relative' }}>
              {/* Time labels */}
              <div style={{ position: 'relative' }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ position: 'absolute', top: `${h * 60}px`, left: 0, right: 0, height: '60px', padding: '4px 8px', fontSize: '11px', color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
                    {h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                  </div>
                ))}
              </div>
              {/* Day column */}
              <div style={{ borderLeft: '1px solid var(--border)', position: 'relative', height: '100%' }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ position: 'absolute', top: `${h * 60}px`, left: 0, right: 0, height: '60px', borderBottom: '1px solid var(--border)', pointerEvents: 'none' }} />
                ))}
                {/* Current time line */}
                {currentDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0] && (() => {
                  const now = new Date(); const nowH = now.getHours() + now.getMinutes() / 60
                  return <div style={{ position: 'absolute', top: `${nowH * 60}px`, left: 0, right: 0, height: '2px', background: '#EF4444', zIndex: 20, pointerEvents: 'none' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444', position: 'absolute', left: '-4px', top: '-3px' }} /></div>
                })()}
                {/* Events */}
                {(() => {
                  const dateStr = currentDate.toISOString().split('T')[0]
                  const dayTasks = expandedMonthTasks.filter(t => (t.dueDate === dateStr || t.scheduledDate === dateStr) && t.startTime && t.endTime)
                  return dayTasks.map(task => {
                    const [sh, sm] = (task.startTime || '0:0').split(':').map(Number)
                    const [eh, em] = (task.endTime || '1:0').split(':').map(Number)
                    const startH = sh + sm / 60
                    const isResizingThis = dayResizingTask?.uid === task.uid && dayResizeEndHour !== null
                    const endH = isResizingThis ? dayResizeEndHour! : (eh + em / 60)
                    const top = startH * 60
                    const height = Math.max((endH - startH) * 60, 20)
                    const color = getEventColor(task)
                    const isMovingThis = dayMovingTask?.uid === task.uid
                    const use24hDay = typeof localStorage !== 'undefined' && localStorage.getItem('time_format') === '24h'
                    const fmtTime = (t: string) => {
                      if (use24hDay) return t
                      const [h, m] = t.split(':').map(Number)
                      const ampm = h >= 12 ? 'PM' : 'AM'
                      const hr = h % 12 || 12
                      return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
                    }
                    return (
                      <div
                        key={task.uid}
                        data-day-event-uid={task.uid}
                        className="calendar-event"
                        style={{
                          position: 'absolute', top: `${top}px`, left: '4px', right: '4px', height: `${height}px`,
                          ...getEventStyle(color),
                          padding: '4px 8px', overflow: 'hidden',
                          cursor: 'grab', zIndex: isMovingThis || isResizingThis ? 10 : 3,
                          opacity: isMovingThis ? 0.3 : 1,
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
                        {height > 32 && <div style={{ fontSize: '11px', opacity: 0.8 }}>{fmtTime(task.startTime!)} - {isResizingThis ? dayFmtHour(endH) : fmtTime(task.endTime!)}</div>}
                        {height > 50 && task.location && <div style={{ fontSize: '11px', opacity: 0.7 }}>{task.location}</div>}
                        <div
                          data-day-resize="true"
                          onMouseDown={e => startDayResize(e, task)}
                          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '6px', cursor: 'ns-resize' }}
                        />
                      </div>
                    )
                  })
                })()}
                {/* Create-new drag preview */}
                {dayDragState && (() => {
                  const s = Math.min(dayDragState.startHour, dayDragState.endHour)
                  const e = Math.max(dayDragState.startHour, dayDragState.endHour)
                  const h = Math.max((e - s) * 60, 24)
                  return (
                    <div style={{
                      position: 'absolute', top: `${s * 60}px`, left: '4px', right: '4px',
                      height: `${h}px`,
                      background: 'var(--accent)',
                      opacity: 0.85,
                      border: '2px solid var(--accent)',
                      borderRadius: '6px', zIndex: 8, pointerEvents: 'none',
                      padding: '4px 8px', overflow: 'hidden',
                      color: 'white',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 700 }}>(New event)</div>
                      <div style={{ fontSize: '11px', opacity: 0.9 }}>
                        {dayFmtHour(s)} – {dayFmtHour(e)}
                      </div>
                    </div>
                  )
                })()}
                {/* Move ghost */}
                {dayMovingTask && dayMoveGhost && (() => {
                  const color = getEventColor(dayMovingTask)
                  return (
                    <div style={{
                      position: 'absolute', top: `${dayMoveGhost.startHour * 60}px`, left: '4px', right: '4px',
                      height: `${dayMoveDuration.current * 60}px`,
                      ...getEventStyle(color),
                      border: '2px dashed var(--accent)',
                      opacity: 0.7, zIndex: 9, pointerEvents: 'none',
                      padding: '4px 8px', overflow: 'hidden',
                      borderRadius: '6px',
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>{dayMovingTask.title}</div>
                      <div style={{ fontSize: '11px', opacity: 0.8 }}>
                        {dayFmtHour(dayMoveGhost.startHour)} – {dayFmtHour(dayMoveGhost.startHour + dayMoveDuration.current)}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected date panel */}
      {selectedDate && (
        <div style={{
          marginTop: '16px',
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          borderTop: '1px solid var(--border)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600,
              color: 'var(--text-primary)' }}>
              {new Date(selectedDate + 'T12:00:00')
                .toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric'
                })}
            </span>
            <button
              onClick={() => setShowAddTask(true)}
              style={{
                background: 'none', border: 'none',
                color: 'var(--accent)', fontSize: '12px',
                cursor: 'pointer', fontWeight: 500,
                padding: 0
              }}>
              + Add task
            </button>
          </div>

          {getTasksForDate(selectedDate).length === 0 ? (
            <p style={{ fontSize: '13px',
              color: 'var(--text-tertiary)', margin: 0 }}>
              No tasks for this day
            </p>
          ) : (
            <div style={{ display: 'flex',
              flexDirection: 'column', gap: '6px',
              maxHeight: '200px', overflowY: 'auto' }}>
              {getTasksForDate(selectedDate).map(task => (
                <div key={task.uid} style={{
                  display: 'flex', alignItems: 'center',
                  gap: '8px', padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{
                    width: '8px', height: '8px',
                    borderRadius: '50%', flexShrink: 0,
                    background: getEventColor(task)
                  }}/>
                  <span style={{ flex: 1, fontSize: '13px',
                    color: 'var(--text-primary)' }}>
                    {task.title}
                  </span>
                  <span style={{
                    fontSize: '11px', padding: '2px 8px',
                    borderRadius: '8px',
                    background: task.status === 'done'
                      ? '#10B98125' : 'var(--bg-hover)',
                    color: task.status === 'done'
                      ? '#10B981' : 'var(--text-tertiary)'
                  }}>
                    {task.status.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => deleteTask(task.uid)}
                    style={{
                      background: 'none', border: 'none',
                      color: '#EF4444', cursor: 'pointer',
                      fontSize: '12px', padding: '2px 6px',
                      opacity: 0.7,
                      borderRadius: '4px'
                    }}
                  >Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Day view edit modal */}
      {dayEditingEvent && (
        <EventModal
          initialEvent={dayEditingEvent}
          onClose={() => setDayEditingEvent(null)}
          onSave={async (evt) => {
            if (evt.uid) {
              const existing = tasks.find(t => t.uid === evt.uid)
              if (existing?.id) {
                await safeDbWrite(
                  () => db.tasks.update(existing.id!, evt),
                  'Failed to update event. Please try again.'
                )
                setTasks(prev => prev.map(t => t.uid === evt.uid ? { ...t, ...evt } : t))
              }
            }
            setDayEditingEvent(null)
          }}
          onDelete={async (uid) => {
            const task = tasks.find(t => t.uid === uid)
            if (task?.id) {
              await safeDbWrite(
                () => db.tasks.delete(task.id!),
                'Failed to delete event. Please try again.'
              )
              setTasks(prev => prev.filter(t => t.uid !== uid))
            }
            setDayEditingEvent(null)
          }}
          onDeleted={async () => {
            const all = await db.tasks.toArray()
            setTasks(all.filter(t => t.dueDate || t.scheduledDate))
            setDayEditingEvent(null)
          }}
        />
      )}

      {/* Day view create modal */}
      {dayModalDefaults && (
        <EventModal
          defaultDate={dayModalDefaults.date}
          defaultStartTime={dayModalDefaults.start}
          defaultEndTime={dayModalDefaults.end}
          onClose={() => setDayModalDefaults(null)}
          onSave={async (evt) => {
            const newTask = {
              uid: nanoid(),
              pageUid: '',
              createdAt: new Date().toISOString(),
              title: evt.title || 'New event',
              status: evt.status || 'todo',
              priority: evt.priority || null,
              dueDate: evt.dueDate || dayModalDefaults.date,
              scheduledDate: evt.scheduledDate || dayModalDefaults.date,
              startTime: evt.startTime || dayModalDefaults.start,
              endTime: evt.endTime || dayModalDefaults.end,
              color: evt.color || 'var(--accent)',
              itemType: evt.itemType || 'event',
              description: evt.description ?? null,
              location: evt.location ?? null,
              recurrence: evt.recurrence ?? null,
              reminder: evt.reminder ?? null,
              url: evt.url ?? null,
            } as Task
            const id = await safeDbWrite(
              () => db.tasks.add(newTask),
              'Failed to save event. Please try again.'
            )
            // If the write failed, leave the modal open so the user can retry
            // (the toast already fired inside safeDbWrite).
            if (id == null) return
            setTasks(prev => [...prev, { ...newTask, id: id as number }])
            setDayModalDefaults(null)
          }}
        />
      )}
    </div>
  )
}

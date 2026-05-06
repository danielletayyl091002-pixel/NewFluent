'use client'
import { useState, useEffect, useRef } from 'react'
import {
  DndContext, DragOverlay, pointerWithin,
  PointerSensor, useSensor, useSensors,
  DragStartEvent, DragOverEvent, DragEndEvent,
  useDroppable
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db, Task } from '@/db/schema'
import { nanoid } from 'nanoid'

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: '#6B7280' },
  { id: 'in_progress', label: 'In Progress', color: '#F59E0B' },
  { id: 'done', label: 'Done', color: '#10B981' },
]

const PRIORITY_COLORS: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
}

function DroppableColumn({ id, children, style }: {
  id: string
  children: React.ReactNode
  style: React.CSSProperties
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} style={{
      ...style,
      outline: isOver ? '2px solid var(--accent)' : 'none'
    }}>
      {children}
    </div>
  )
}

export default function BoardView({ pageUid }: { pageUid: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [editTask, setEditTask] = useState<Task | null>(null)
  const pendingStatus = useRef<{ uid: string; status: Task['status'] } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function load() {
      const t = pageUid === 'global'
        ? await db.tasks.toArray()
        : await db.tasks.where('pageUid').equals(pageUid).toArray()
      if (cancelled) return
      setTasks(t)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [pageUid])

  async function addTask(status: string) {
    if (!newTaskTitle.trim()) return
    const task: Task = {
      uid: nanoid(),
      pageUid,
      title: newTaskTitle.trim(),
      status: status as Task['status'],
      priority: null,
      dueDate: null,
      scheduledDate: null,
      startTime: null,
      endTime: null,
      color: '#3B82F6',
      createdAt: new Date().toISOString()
    }
    await db.tasks.add(task)
    setTasks(prev => [...prev, task])
    setNewTaskTitle('')
    setAddingTo(null)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find(t => t.uid === event.active.id) || null)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const aId = active.id as string
    const overId = over.id as string
    if (aId === overId) return

    const activeTask = tasks.find(t => t.uid === aId)
    if (!activeTask) return

    const overColumn = COLUMNS.find(c => c.id === overId)
    const overTask = tasks.find(t => t.uid === overId)
    const newStatus = overColumn
      ? overColumn.id as Task['status']
      : overTask?.status

    if (!newStatus) return

    if (activeTask.status !== newStatus) {
      pendingStatus.current = { uid: aId, status: newStatus }
      setTasks(prev => prev.map(t =>
        t.uid === aId ? { ...t, status: newStatus } : t
      ))
      return
    }

    if (overTask && activeTask.status === overTask.status) {
      setTasks(prev => {
        const oldIndex = prev.findIndex(t => t.uid === aId)
        const newIndex = prev.findIndex(t => t.uid === overId)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active } = event
    setActiveTask(null)
    if (pendingStatus.current?.uid === active.id) {
      const task = tasks.find(t => t.uid === active.id)
      if (task?.id) {
        await db.tasks.update(task.id, { status: pendingStatus.current.status })
      }
      pendingStatus.current = null
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', gap: '16px',
        padding: '24px', height: '100%',
        overflowX: 'auto', alignItems: 'flex-start'
      }}>
        {COLUMNS.map(col => (
          <div key={col.id} style={{
            minWidth: '280px', width: '280px',
            minHeight: 'calc(100vh - 200px)',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-card, 12px)',
            padding: '16px', opacity: 0.5
          }}>
            <div style={{
              fontSize: '12px', fontWeight: 600,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.06em'
            }}>{col.label}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', gap: '16px',
      padding: '24px', height: '100%',
      overflowX: 'auto', alignItems: 'flex-start',
      backgroundImage: 'var(--bg_board, none)',
      backgroundSize: 'cover', backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    }}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id)
          return (
            <DroppableColumn
              key={col.id}
              id={col.id}
              style={{
                minWidth: '280px', width: '280px',
                minHeight: 'calc(100vh - 200px)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-card, 12px)',
                padding: '16px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '10px', height: '10px',
                    borderRadius: '50%', background: col.color,
                    boxShadow: `0 0 0 2px ${col.color}22`,
                  }} />
                  <span style={{
                    fontSize: '12px', fontWeight: 700,
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {col.label}
                  </span>
                  <span style={{
                    fontSize: '11px', color: 'var(--text-tertiary)',
                    background: 'var(--bg-hover)',
                    padding: '1px 6px', borderRadius: 'var(--radius-base, 8px)'
                  }}>
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => setAddingTo(col.id)}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer', fontSize: '18px',
                    lineHeight: 1, padding: '0 4px'
                  }}
                >+</button>
              </div>

              <SortableContext
                items={colTasks.map(t => t.uid)}
                strategy={verticalListSortingStrategy}
              >
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  gap: '8px', flex: 1
                }}>
                  {colTasks.map(task => (
                    <TaskCard
                      key={task.uid}
                      task={task}
                      onDelete={async () => {
                        if (task.id) await db.tasks.delete(task.id)
                        setTasks(prev => prev.filter(t => t.uid !== task.uid))
                      }}
                      onPriorityChange={async (priority) => {
                        if (task.id) await db.tasks.update(task.id, { priority })
                        setTasks(prev => prev.map(t =>
                          t.uid === task.uid ? { ...t, priority } : t
                        ))
                      }}
                      onEdit={() => setEditTask(task)}
                    />
                  ))}
                  {colTasks.length === 0 && addingTo !== col.id && (
                    <div
                      onClick={() => setAddingTo(col.id)}
                      style={{
                        padding: '20px 12px', textAlign: 'center',
                        border: '1px dashed var(--border)',
                        borderRadius: 'var(--radius-base, 8px)',
                        color: 'var(--text-tertiary)', fontSize: '12px',
                        cursor: 'pointer', lineHeight: 1.5,
                      }}
                    >
                      Drop tasks here or
                      <br />
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>+ click to add</span>
                    </div>
                  )}
                </div>
              </SortableContext>

              {addingTo === col.id ? (
                <div style={{ marginTop: '8px' }}>
                  <input
                    autoFocus
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') addTask(col.id)
                      if (e.key === 'Escape') {
                        setAddingTo(null)
                        setNewTaskTitle('')
                      }
                    }}
                    placeholder="Task title..."
                    style={{
                      width: '100%', padding: '8px 12px',
                      borderRadius: 'var(--radius-base, 8px)',
                      border: '1px solid var(--accent)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px', boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button onClick={() => addTask(col.id)} style={{
                      padding: '4px 12px', borderRadius: 'var(--radius-sm, 6px)',
                      border: 'none', background: 'var(--accent)',
                      color: 'white', fontSize: '12px', cursor: 'pointer'
                    }}>Add</button>
                    <button onClick={() => {
                      setAddingTo(null)
                      setNewTaskTitle('')
                    }} style={{
                      padding: '4px 12px', borderRadius: 'var(--radius-sm, 6px)',
                      border: '1px solid var(--border)',
                      background: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '12px', cursor: 'pointer'
                    }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTo(col.id)}
                  style={{
                    width: '100%', marginTop: '8px',
                    padding: '8px', borderRadius: 'var(--radius-base, 8px)',
                    border: '1px dashed var(--border)',
                    background: 'none',
                    color: 'var(--text-tertiary)',
                    fontSize: '12px', cursor: 'pointer'
                  }}
                >
                  + Add task
                </button>
              )}
            </DroppableColumn>
          )
        })}

        <DragOverlay>
          {activeTask ? (
            <div style={{
              background: 'var(--bg-primary)',
              borderRadius: '10px', padding: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              border: '1px solid var(--border)', opacity: 0.9,
              width: '280px'
            }}>
              <span style={{
                fontSize: '13px', color: 'var(--text-primary)',
                fontWeight: 500
              }}>
                {activeTask.title}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {editTask && (
        <EditTaskModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSave={async (updates) => {
            if (editTask.id) await db.tasks.update(editTask.id, updates)
            setTasks(prev => prev.map(t =>
              t.uid === editTask.uid ? { ...t, ...updates } : t
            ))
            setEditTask(null)
          }}
        />
      )}
    </div>
  )
}

function EditTaskModal({ task, onClose, onSave }: {
  task: Task
  onClose: () => void
  onSave: (updates: Partial<Task>) => Promise<void>
}) {
  const [title, setTitle] = useState(task.title)
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState<string>(task.priority || '')
  const [dueDate, setDueDate] = useState(task.dueDate || '')

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-primary)', borderRadius: '14px',
        padding: '24px', width: '400px', maxWidth: '90vw',
        boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
        border: '1px solid var(--border)'
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Edit Task
        </h3>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} autoFocus style={{
            width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-base, 8px)',
            border: '1px solid var(--border)', background: 'var(--bg-secondary)',
            color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
          }} />
        </div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as Task['status'])} style={{
              width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-base, 8px)',
              border: '1px solid var(--border)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: '13px'
            }}>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} style={{
              width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-base, 8px)',
              border: '1px solid var(--border)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: '13px'
            }}>
              <option value="">None</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Due Date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{
            width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-base, 8px)',
            border: '1px solid var(--border)', background: 'var(--bg-secondary)',
            color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
          }} />
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-base, 8px)',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer'
          }}>Cancel</button>
          <button onClick={() => onSave({
            title, status,
            priority: (priority || null) as Task['priority'],
            dueDate: dueDate || null
          })} style={{
            padding: '8px 20px', borderRadius: 'var(--radius-base, 8px)', border: 'none',
            background: 'var(--accent)', color: 'white',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer'
          }}>Save</button>
        </div>
      </div>
    </div>
  )
}

function TaskCard({ task, onDelete, onPriorityChange, onEdit }: {
  task: Task
  onDelete: () => void
  onPriorityChange: (p: Task['priority']) => void
  onEdit: () => void
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging
  } = useSortable({ id: task.uid })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        background: 'var(--bg-primary)',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none'
      }}
    >
      <div style={{ padding: '12px 12px 8px' }}>
        <div
          onClick={e => { e.stopPropagation(); onEdit() }}
          onPointerDown={e => e.stopPropagation()}
          style={{
            fontSize: '13px', fontWeight: 500,
            color: 'var(--text-primary)', lineHeight: 1.4,
            cursor: 'pointer'
          }}
        >
          {task.title}
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px 12px'
      }}>
        <select
          value={task.priority || ''}
          onChange={e => {
            e.stopPropagation()
            onPriorityChange((e.target.value as Task['priority']) || null)
          }}
          onPointerDown={e => e.stopPropagation()}
          style={{
            fontSize: '11px', padding: '2px 6px',
            borderRadius: 'var(--radius-sm, 6px)', border: 'none',
            background: task.priority
              ? (PRIORITY_COLORS[task.priority] || '#6B7280') + '20'
              : 'var(--bg-hover)',
            color: task.priority
              ? (PRIORITY_COLORS[task.priority] || '#6B7280')
              : 'var(--text-tertiary)',
            cursor: 'pointer', fontWeight: 500
          }}
        >
          <option value="">No priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={onDelete}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer', fontSize: '12px',
            padding: '2px 4px', borderRadius: 'var(--radius-xs, 4px)'
          }}
        >x</button>
      </div>
      {task.dueDate && (
        <div style={{
          fontSize: '11px', color: 'var(--text-tertiary)',
          padding: '0 12px 10px'
        }}>
          {new Date(task.dueDate).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
          })}
        </div>
      )}
    </div>
  )
}

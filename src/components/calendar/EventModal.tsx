'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'
import { db, Task, Page } from '@/db/schema'
import { safeDbWrite } from '@/lib/dbError'

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6']
const REMINDERS = [
  { label: 'None', value: null },
  { label: '5 min before', value: 5 },
  { label: '10 min before', value: 10 },
  { label: '30 min before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '1 day before', value: 1440 },
]
const RECURRENCES = [
  { label: 'Does not repeat', value: null },
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekly', value: 'FREQ=WEEKLY' },
  { label: 'Monthly', value: 'FREQ=MONTHLY' },
  { label: 'Yearly', value: 'FREQ=YEARLY' },
]

interface EventModalProps {
  initialEvent?: Partial<Task> | null
  defaultDate?: string
  defaultStartTime?: string
  defaultEndTime?: string
  onClose: () => void
  onSave: (event: Partial<Task>) => Promise<void>
  onDelete?: (uid: string) => Promise<void>
  onDeleted?: () => void
}

// Chip that loads and displays a linked page by uid. Clicking the title
// navigates to the page; clicking × calls onRemove (which clears the
// local linkedPageUid state in the parent).
function LinkedPageChip({
  uid,
  onRemove,
}: {
  uid: string
  onRemove: () => void
}) {
  const [page, setPage] = useState<Page | null>(null)
  const router = useRouter()

  useEffect(() => {
    db.pages.where('uid').equals(uid).first().then(p => setPage(p ?? null))
  }, [uid])

  if (!page) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      fontSize: '12px',
      color: 'var(--text-primary)',
    }}>
      <span
        onClick={() => router.push(`/page/${uid}`)}
        style={{ cursor: 'pointer', flex: 1 }}
      >
        {page.icon ? `${page.icon} ` : ''}{page.title || 'Untitled'}
      </span>
      <button
        onClick={onRemove}
        aria-label="Remove linked page"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-tertiary)',
          fontSize: '14px',
          lineHeight: 1,
          padding: 0,
        }}
      >
        {'\u00d7'}
      </button>
    </div>
  )
}

export default function EventModal({
  initialEvent, defaultDate, defaultStartTime, defaultEndTime,
  onClose, onSave, onDelete, onDeleted,
}: EventModalProps) {
  const [title, setTitle] = useState(initialEvent?.title || '')
  const [date, setDate] = useState(initialEvent?.scheduledDate || initialEvent?.dueDate || defaultDate || new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState(initialEvent?.startTime || defaultStartTime || '09:00')
  const [endTime, setEndTime] = useState(initialEvent?.endTime || defaultEndTime || '10:00')
  const [itemType, setItemType] = useState<'task' | 'event'>(initialEvent?.itemType || (initialEvent?.startTime || defaultStartTime ? 'event' : 'task'))
  const [color, setColor] = useState(initialEvent?.color || 'var(--accent)')
  const [description, setDescription] = useState(initialEvent?.description || '')
  const [location, setLocation] = useState(initialEvent?.location || '')
  const [showLocation, setShowLocation] = useState(!!initialEvent?.location)
  const [url, setUrl] = useState(initialEvent?.url || '')
  const [showUrl, setShowUrl] = useState(!!initialEvent?.url)
  const [reminder, setReminder] = useState<number | null>(initialEvent?.reminder ?? null)
  const [recurrence, setRecurrence] = useState<string | null>(initialEvent?.recurrence ?? null)
  const [priority, setPriority] = useState<'high' | 'medium' | 'low' | null>(initialEvent?.priority || null)
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false)
  // Linked page state
  const [linkedPageUid, setLinkedPageUid] = useState<string | null>(initialEvent?.linkedPageUid ?? null)
  const [showPagePicker, setShowPagePicker] = useState(false)
  const [allPages, setAllPages] = useState<Page[]>([])
  const [pageSearch, setPageSearch] = useState('')
  const [hoveredPageUid, setHoveredPageUid] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  async function openPagePicker() {
    const pages = await db.pages
      .filter(p => !p.inTrash)
      .toArray()
    setAllPages(pages)
    setShowPagePicker(true)
  }

  // Resolve the real master task for this event. For virtual recurring
  // occurrences from CalendarView, initialEvent.id is undefined and the
  // uid looks like "<masterUid>_YYYY-MM-DD". Strip the date suffix and
  // look up the master by uid from Dexie.
  async function resolveMasterTask(): Promise<Task | null> {
    if (!initialEvent?.uid) return null
    if (initialEvent.id != null) {
      const real = await db.tasks.get(initialEvent.id)
      if (real) return real
    }
    const match = initialEvent.uid.match(/^(.+)_\d{4}-\d{2}-\d{2}$/)
    const masterUid = match ? match[1] : initialEvent.uid
    const master = await db.tasks.where('uid').equals(masterUid).first()
    return master ?? null
  }

  async function handleDelete() {
    if (!initialEvent?.uid) return
    if (initialEvent.recurrence) {
      setShowRecurrenceOptions(true)
      return
    }
    if (!confirm('Delete this event?')) return
    const master = await resolveMasterTask()
    if (master?.id != null) {
      await safeDbWrite(
        () => db.tasks.delete(master.id!),
        'Failed to delete event. Please try again.'
      )
    }
    // Keep backward compat with parents that rely on onDelete for state sync.
    if (onDelete) {
      try { await onDelete(initialEvent.uid) } catch { /* ignore */ }
    }
    onClose()
    onDeleted?.()
  }

  async function confirmDelete(mode: 'single' | 'future' | 'all') {
    if (!initialEvent?.uid) return
    const master = await resolveMasterTask()
    if (!master?.id) {
      setShowRecurrenceOptions(false)
      onClose()
      return
    }
    // The occurrence date the user clicked — for virtual occurrences this
    // is the individual date, for the master it's the series start.
    const occurrenceDate = initialEvent.scheduledDate || initialEvent.dueDate || null

    if (mode === 'single') {
      const exceptions: string[] = master.recurrenceException
        ? JSON.parse(master.recurrenceException) : []
      if (occurrenceDate && !exceptions.includes(occurrenceDate)) {
        exceptions.push(occurrenceDate)
      }
      await safeDbWrite(
        () => db.tasks.update(master.id!, {
          recurrenceException: JSON.stringify(exceptions)
        }),
        'Failed to update event. Please try again.'
      )
    } else if (mode === 'future') {
      if (occurrenceDate) {
        const untilDate = new Date(occurrenceDate + 'T00:00:00')
        untilDate.setDate(untilDate.getDate() - 1)
        const untilStr = untilDate.toISOString().split('T')[0].replace(/-/g, '')
        let newRrule = master.recurrence || ''
        newRrule = newRrule.replace(/;UNTIL=\d+/, '')
        newRrule += `;UNTIL=${untilStr}`
        await safeDbWrite(
          () => db.tasks.update(master.id!, { recurrence: newRrule }),
          'Failed to update recurrence. Please try again.'
        )
      }
    } else if (mode === 'all') {
      await safeDbWrite(
        () => db.tasks.delete(master.id!),
        'Failed to delete event. Please try again.'
      )
      if (onDelete) {
        try { await onDelete(master.uid) } catch { /* ignore */ }
      }
    }

    setShowRecurrenceOptions(false)
    onClose()
    onDeleted?.()
  }

  useEffect(() => { titleRef.current?.focus() }, [])

  const markDirty = useCallback(() => { if (!dirty) setDirty(true) }, [dirty])

  const handleSave = useCallback(async () => {
    if (!title.trim()) { setTitleError(true); titleRef.current?.focus(); return }
    setSaving(true)
    await onSave({
      ...(initialEvent || {}),
      title: title.trim(),
      scheduledDate: date,
      dueDate: date,
      startTime: itemType === 'event' ? startTime : null,
      endTime: itemType === 'event' ? endTime : null,
      itemType,
      color,
      description: description || null,
      location: location || null,
      url: url || null,
      reminder,
      recurrence,
      priority,
      status: initialEvent?.status || 'todo',
      linkedPageUid: linkedPageUid ?? null,
    })
    setSaving(false)
    onClose()
  }, [title, date, startTime, endTime, itemType, color, description, location, url, reminder, recurrence, priority, linkedPageUid, initialEvent, onSave, onClose])

  const handleClose = useCallback(() => {
    if (dirty && !confirm('Discard unsaved changes?')) return
    onClose()
  }, [dirty, onClose])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If the page picker is open, close it first
        if (showPagePicker) {
          setShowPagePicker(false)
          return
        }
        // If the recurrence options dialog is open, close it first
        if (showRecurrenceOptions) {
          setShowRecurrenceOptions(false)
          return
        }
        handleClose()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleClose, handleSave, showRecurrenceOptions, showPagePicker])

  const isEditing = !!initialEvent?.uid

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        onClick={e => e.stopPropagation()}
        style={{
          width: '480px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--bg-primary)', borderRadius: 'var(--radius-card, 14px)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)', padding: '24px',
        }}
      >
        {/* Title */}
        <input
          ref={titleRef}
          value={title}
          onChange={e => { setTitle(e.target.value); setTitleError(false); markDirty() }}
          placeholder="Event title"
          style={{
            width: '100%', fontSize: '18px', fontWeight: 700,
            border: 'none', borderBottom: titleError ? '2px solid #EF4444' : '2px solid var(--accent)',
            outline: 'none', background: 'transparent',
            color: 'var(--text-primary)', padding: '0 0 8px 0',
            marginBottom: titleError ? '2px' : '16px',
            boxSizing: 'border-box',
          }}
        />
        {titleError && <div style={{ fontSize: '11px', color: '#EF4444', marginBottom: '12px' }}>Title is required</div>}

        {/* Type selector */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {(['event', 'task'] as const).map(t => (
            <button key={t} onClick={() => { setItemType(t); markDirty() }} style={{
              padding: '5px 14px', borderRadius: '9999px',
              border: itemType === t ? 'none' : '1px solid var(--border)',
              background: itemType === t ? 'var(--accent)' : 'transparent',
              color: itemType === t ? 'white' : 'var(--text-secondary)',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>

        {/* Date & Time */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); markDirty() }}
            style={{ padding: '6px 10px', borderRadius: 'var(--radius-base, 8px)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
          {itemType === 'event' && (
            <>
              <input type="time" step="900" value={startTime} onChange={e => { setStartTime(e.target.value); markDirty() }}
                style={{ padding: '6px 10px', borderRadius: 'var(--radius-base, 8px)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
              <span style={{ alignSelf: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>to</span>
              <input type="time" step="900" value={endTime} onChange={e => { setEndTime(e.target.value); markDirty() }}
                style={{ padding: '6px 10px', borderRadius: 'var(--radius-base, 8px)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
            </>
          )}
        </div>

        {/* Color */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>COLOR</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {COLORS.map(c => (
              <button key={c} aria-label={`Color ${c}`} onClick={() => { setColor(c); markDirty() }} style={{
                width: '20px', height: '20px', borderRadius: '50%', background: c, padding: 0,
                border: color === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                cursor: 'pointer', transform: color === c ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform 0.1s',
              }} />
            ))}
            <label style={{
              width: '20px', height: '20px', borderRadius: '50%',
              background: COLORS.includes(color) ? 'var(--bg-hover)' : color,
              border: '2px dashed var(--text-tertiary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative',
            }}>
              <input type="color" value={color} onChange={e => { setColor(e.target.value); markDirty() }}
                style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, pointerEvents: 'none' }}>+</span>
            </label>
          </div>
        </div>

        {/* Priority */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', alignSelf: 'center', marginRight: '4px' }}>Priority:</span>
          {([null, 'low', 'medium', 'high'] as const).map(p => (
            <button key={String(p)} onClick={() => { setPriority(p); markDirty() }} style={{
              padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              border: priority === p ? 'none' : '1px solid var(--border)',
              background: priority === p ? (p === 'high' ? '#EF4444' : p === 'medium' ? '#F59E0B' : p === 'low' ? '#10B981' : 'var(--accent)') : 'transparent',
              color: priority === p ? 'white' : 'var(--text-secondary)',
            }}>{p || 'None'}</button>
          ))}
        </div>

        {/* Location */}
        {showLocation ? (
          <input value={location} onChange={e => { setLocation(e.target.value); markDirty() }} placeholder="Add location"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-base, 8px)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }} />
        ) : (
          <button onClick={() => setShowLocation(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', padding: '0', marginBottom: '12px' }}>+ Add location</button>
        )}

        {/* Description */}
        <textarea value={description} onChange={e => { setDescription(e.target.value); markDirty() }} placeholder="Add description..."
          style={{ width: '100%', minHeight: '60px', padding: '8px 12px', borderRadius: 'var(--radius-base, 8px)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical', marginBottom: '12px', boxSizing: 'border-box', fontFamily: 'inherit' }} />

        {/* Recurrence & Reminder row */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <select value={recurrence || ''} onChange={e => { setRecurrence(e.target.value || null); markDirty() }}
            style={{ padding: '6px 10px', borderRadius: 'var(--radius-base, 8px)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
            {RECURRENCES.map(r => <option key={r.label} value={r.value || ''}>{r.label}</option>)}
          </select>
          <select value={reminder ?? ''} onChange={e => { setReminder(e.target.value ? Number(e.target.value) : null); markDirty() }}
            style={{ padding: '6px 10px', borderRadius: 'var(--radius-base, 8px)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
            {REMINDERS.map(r => <option key={r.label} value={r.value ?? ''}>{r.label}</option>)}
          </select>
        </div>

        {/* URL */}
        {showUrl ? (
          <input value={url} onChange={e => { setUrl(e.target.value); markDirty() }} placeholder="https://..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-base, 8px)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', marginBottom: '16px', boxSizing: 'border-box' }} />
        ) : (
          <button onClick={() => setShowUrl(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', padding: '0', marginBottom: '16px' }}>+ Add link</button>
        )}

        {/* Linked page */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 0',
          borderTop: '0.5px solid var(--border)',
        }}>
          <span style={{
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            minWidth: '80px',
          }}>
            Linked page
          </span>
          {linkedPageUid ? (
            <LinkedPageChip
              uid={linkedPageUid}
              onRemove={() => { setLinkedPageUid(null); markDirty() }}
            />
          ) : (
            <button
              onClick={openPagePicker}
              style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                background: 'none',
                border: '1px dashed var(--border)',
                borderRadius: '6px',
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              + Link a page
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <div>
            {isEditing && (onDelete || onDeleted) && (
              <button onClick={handleDelete}
                style={{ padding: '6px 14px', borderRadius: '9999px', border: 'none', background: '#FEE2E2', color: '#EF4444', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Delete
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleClose} style={{
              padding: '6px 16px', borderRadius: '9999px', border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: '6px 20px', borderRadius: '9999px', border: 'none',
              background: 'var(--accent)', color: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}>{saving ? 'Saving...' : isEditing ? 'Update' : 'Save'}</button>
          </div>
        </div>

        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '8px', textAlign: 'right' }}>
          {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to save
        </div>
      </div>

      {showRecurrenceOptions && (
        <div
          onClick={(e) => { e.stopPropagation(); setShowRecurrenceOptions(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-primary)',
              borderRadius: '12px',
              padding: '24px',
              width: '320px',
              border: '1px solid var(--border)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)'
            }}
          >
            <p style={{
              margin: '0 0 16px',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              Delete recurring event
            </p>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              {[
                { mode: 'single', label: 'Delete this occurrence only' },
                { mode: 'future', label: 'Delete all future events' },
                { mode: 'all',    label: 'Delete all events in series' },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => confirmDelete(
                    mode as 'single' | 'future' | 'all'
                  )}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowRecurrenceOptions(false)}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '10px',
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showPagePicker && (
        <div
          onClick={(e) => { e.stopPropagation(); setShowPagePicker(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 6000,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              width: '360px',
              maxHeight: '400px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
            }}
          >
            <input
              autoFocus
              value={pageSearch}
              onChange={(e) => setPageSearch(e.target.value)}
              placeholder="Search pages..."
              style={{
                padding: '12px 16px',
                fontSize: '14px',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {allPages
                .filter(p =>
                  (p.title || '').toLowerCase()
                    .includes(pageSearch.toLowerCase())
                )
                .slice(0, 20)
                .map(p => (
                  <div
                    key={p.uid}
                    onClick={() => {
                      setLinkedPageUid(p.uid)
                      setShowPagePicker(false)
                      setPageSearch('')
                      setHoveredPageUid(null)
                      markDirty()
                    }}
                    onMouseEnter={() => setHoveredPageUid(p.uid)}
                    onMouseLeave={() => setHoveredPageUid(null)}
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: hoveredPageUid === p.uid ? 'var(--bg-secondary)' : 'transparent',
                    }}
                  >
                    {p.icon && <span>{p.icon}</span>}
                    <span>{p.title || 'Untitled'}</span>
                  </div>
                ))
              }
              <div
                onClick={async () => {
                  const newUid = nanoid()
                  const count = await db.pages.count()
                  await safeDbWrite(
                    () => db.pages.add({
                      uid: newUid,
                      title: 'Untitled',
                      icon: null,
                      parentUid: null,
                      isFavorite: false,
                      inTrash: false,
                      order: count,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    }),
                    'Failed to save page. Please try again.'
                  )
                  setLinkedPageUid(newUid)
                  setShowPagePicker(false)
                  setPageSearch('')
                  setHoveredPageUid(null)
                  markDirty()
                }}
                onMouseEnter={() => setHoveredPageUid('__create__')}
                onMouseLeave={() => setHoveredPageUid(null)}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--accent)',
                  borderTop: '0.5px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: hoveredPageUid === '__create__' ? 'var(--bg-secondary)' : 'transparent',
                }}
              >
                + Create new page
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { nanoid } from 'nanoid'
import { db, Task } from '@/db/schema'
import { safeDbWrite } from '@/lib/dbError'
import LinkedPageChip from './LinkedPageChip'
import LinkedPagePicker from './LinkedPagePicker'
import {
  getPresetOptions, detectPresetKey, parseRrule, serializeRrule,
  defaultParsedRrule, formatRruleSummary, parseDateLocal,
  dayCodeFromDate, nthWeekdayOfMonth, ordinalLabel, weekdayName,
  WEEKDAY_CODES, WEEKDAY_LETTERS, ParsedRrule, Freq,
} from '@/lib/recurrence'

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6']
const REMINDERS = [
  { label: 'None', value: null },
  { label: '5 min before', value: 5 },
  { label: '10 min before', value: 10 },
  { label: '30 min before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '1 day before', value: 1440 },
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
  // Three-way edit picker for recurring events (this / future / all)
  const [showEditOptions, setShowEditOptions] = useState(false)
  // Custom recurrence builder modal
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false)
  // Linked page state
  const [linkedPageUid, setLinkedPageUid] = useState<string | null>(initialEvent?.linkedPageUid ?? null)
  const [showPagePicker, setShowPagePicker] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

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

  // Build the partial Task we want to save — used by both the "all" path
  // (existing onSave callback) and the new "single" / "future" paths.
  const buildEventPayload = useCallback((): Partial<Task> => ({
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
  }), [title, date, startTime, endTime, itemType, color, description, location, url, reminder, recurrence, priority, linkedPageUid, initialEvent])

  // Apply the edit as a single-occurrence override: add an EXDATE on the
  // master so it skips this date, then insert a new standalone task with
  // the user's edits.
  async function applyEditSingle(master: Task) {
    const occurrenceDate = initialEvent?.scheduledDate || initialEvent?.dueDate
    if (!occurrenceDate) return
    const exceptions: string[] = master.recurrenceException
      ? JSON.parse(master.recurrenceException) : []
    if (!exceptions.includes(occurrenceDate)) exceptions.push(occurrenceDate)
    await safeDbWrite(
      () => db.tasks.update(master.id!, {
        recurrenceException: JSON.stringify(exceptions),
      }),
      'Failed to update event. Please try again.'
    )
    await safeDbWrite(
      () => db.tasks.add({
        uid: nanoid(),
        pageUid: master.pageUid,
        createdAt: new Date().toISOString(),
        title: title.trim(),
        status: master.status,
        priority,
        dueDate: date,
        scheduledDate: date,
        startTime: itemType === 'event' ? startTime : null,
        endTime: itemType === 'event' ? endTime : null,
        color,
        description: description || null,
        location: location || null,
        itemType,
        recurrence: null,           // standalone override
        recurrenceException: null,
        reminder,
        url: url || null,
        linkedPageUid: linkedPageUid ?? null,
      }),
      'Failed to save edited occurrence. Please try again.'
    )
  }

  // Apply the edit to this and all future occurrences: truncate the master
  // with an UNTIL the day before this occurrence, then create a new
  // recurring series starting at this occurrence with the new fields.
  async function applyEditFuture(master: Task) {
    const occurrenceDate = initialEvent?.scheduledDate || initialEvent?.dueDate
    if (!occurrenceDate) return
    const untilDate = new Date(occurrenceDate + 'T00:00:00')
    untilDate.setDate(untilDate.getDate() - 1)
    const untilStr = untilDate.toISOString().split('T')[0].replace(/-/g, '')
    let truncated = (master.recurrence || '').replace(/;?UNTIL=\d+/, '')
    truncated = truncated.replace(/^;|;$/g, '')
    truncated += (truncated ? ';' : '') + `UNTIL=${untilStr}`
    await safeDbWrite(
      () => db.tasks.update(master.id!, { recurrence: truncated }),
      'Failed to truncate series. Please try again.'
    )
    await safeDbWrite(
      () => db.tasks.add({
        uid: nanoid(),
        pageUid: master.pageUid,
        createdAt: new Date().toISOString(),
        title: title.trim(),
        status: master.status,
        priority,
        dueDate: date,
        scheduledDate: date,
        startTime: itemType === 'event' ? startTime : null,
        endTime: itemType === 'event' ? endTime : null,
        color,
        description: description || null,
        location: location || null,
        itemType,
        recurrence,                  // new (possibly modified) rule
        recurrenceException: null,
        reminder,
        url: url || null,
        linkedPageUid: linkedPageUid ?? null,
      }),
      'Failed to save new series. Please try again.'
    )
  }

  // Run the picked edit scope, then close.
  async function confirmEdit(scope: 'single' | 'future' | 'all') {
    setShowEditOptions(false)
    if (scope === 'all') {
      // Existing onSave path edits the master. For virtual occurrences
      // we need to resolve to the master first so the parent's
      // .find(t => t.uid === evt.uid) finds it.
      const master = await resolveMasterTask()
      const payload = buildEventPayload()
      if (master) {
        payload.uid = master.uid
        payload.id = master.id
      }
      setSaving(true)
      await onSave(payload)
      setSaving(false)
      onClose()
      return
    }
    const master = await resolveMasterTask()
    if (!master?.id) { onClose(); return }
    setSaving(true)
    if (scope === 'single') await applyEditSingle(master)
    else await applyEditFuture(master)
    setSaving(false)
    onClose()
    onDeleted?.() // triggers the parent to reload tasks from DB
  }

  const handleSave = useCallback(async () => {
    if (!title.trim()) { setTitleError(true); titleRef.current?.focus(); return }
    // Editing a recurring event → show the GCal-style 3-way picker
    // (this / future / all). New events and non-recurring edits go
    // straight through.
    if (initialEvent?.uid && initialEvent?.recurrence) {
      setShowEditOptions(true)
      return
    }
    setSaving(true)
    await onSave(buildEventPayload())
    setSaving(false)
    onClose()
  }, [title, buildEventPayload, initialEvent, onSave, onClose])

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
        // Custom recurrence builder takes precedence over the modal
        if (showCustomRecurrence) {
          setShowCustomRecurrence(false)
          return
        }
        // If the edit-options picker is open, close it first
        if (showEditOptions) {
          setShowEditOptions(false)
          return
        }
        // If the delete-options picker is open, close it first
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
  }, [handleClose, handleSave, showRecurrenceOptions, showPagePicker, showEditOptions, showCustomRecurrence])

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
        data-modal
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
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Preset list is computed from the event's date so labels read
              naturally ("Weekly on Monday" rather than just "Weekly"). */}
          <select
            value={detectPresetKey(recurrence, date)}
            onChange={e => {
              const newKey = e.target.value
              const presets = getPresetOptions(date)
              const opt = presets.find(p => p.key === newKey)
              if (newKey === 'custom') {
                // Open the custom builder; don't change the rule until they confirm
                setShowCustomRecurrence(true)
              } else if (opt) {
                setRecurrence(opt.value === 'CUSTOM' ? recurrence : opt.value)
                markDirty()
              }
            }}
            style={{ padding: '6px 10px', borderRadius: 'var(--radius-base, 8px)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
          >
            {getPresetOptions(date).map(p => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          {/* When the rule is custom (no preset matches), show a summary +
              "Edit" so the user can re-open the builder. Native <select>
              doesn't fire onChange when re-selecting the active option,
              hence this side affordance. */}
          {detectPresetKey(recurrence, date) === 'custom' && recurrence && (
            <button
              type="button"
              onClick={() => setShowCustomRecurrence(true)}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--accent)', fontSize: '11px',
                cursor: 'pointer', padding: '0 4px',
              }}
              title="Edit custom recurrence"
            >
              {formatRruleSummary(recurrence, date)} · edit
            </button>
          )}
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
              onClick={() => setShowPagePicker(true)}
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
                {/* Ellipsis = "more dialog incoming" (OS convention).
                    For recurring events the next click reveals a 3-way picker. */}
                {initialEvent?.recurrence ? 'Delete…' : 'Delete'}
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

      {/* Three-way edit picker for recurring events — mirror of the
          delete picker above. Apply the user's edits to just this
          occurrence, this + future, or the whole series. */}
      {showEditOptions && (
        <div
          onClick={(e) => { e.stopPropagation(); setShowEditOptions(false) }}
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
              Edit recurring event
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { mode: 'single', label: 'This event' },
                { mode: 'future', label: 'This and following events' },
                { mode: 'all',    label: 'All events' },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => confirmEdit(mode as 'single' | 'future' | 'all')}
                  style={{
                    padding: '10px 14px', textAlign: 'left',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px', cursor: 'pointer',
                    fontSize: '13px', color: 'var(--text-primary)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowEditOptions(false)}
              style={{
                marginTop: '16px', width: '100%', padding: '10px',
                background: 'none', border: '1px solid var(--border)',
                borderRadius: '8px', cursor: 'pointer',
                fontSize: '13px', color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showCustomRecurrence && (
        <CustomRecurrenceModal
          dateStr={date}
          initial={recurrence ? parseRrule(recurrence) : defaultParsedRrule(date)}
          onCancel={() => setShowCustomRecurrence(false)}
          onDone={(newRule) => {
            setRecurrence(newRule)
            markDirty()
            setShowCustomRecurrence(false)
          }}
        />
      )}

      {showPagePicker && (
        <LinkedPagePicker
          onSelect={(uid) => { setLinkedPageUid(uid); markDirty() }}
          onClose={() => setShowPagePicker(false)}
        />
      )}
    </div>
  )
}

// ── Custom recurrence builder ─────────────────────────────────────────────
// GCal-style modal: "Repeat every [N] [days|weeks|months|years]", optional
// day-of-week pickers for weekly, day-of-month / nth-weekday radio for
// monthly, and end conditions (Never / On date / After N).

interface CustomRecurrenceModalProps {
  dateStr: string
  initial: ParsedRrule
  onCancel: () => void
  onDone: (rrule: string) => void
}

function CustomRecurrenceModal({ dateStr, initial, onCancel, onDone }: CustomRecurrenceModalProps) {
  const [opts, setOpts] = useState<ParsedRrule>(initial)
  const [endsKind, setEndsKind] = useState<'never' | 'on' | 'after'>(
    initial.until ? 'on' : initial.count ? 'after' : 'never'
  )
  const [untilStr, setUntilStr] = useState<string>(() => {
    if (!initial.until) return ''
    const y = initial.until.slice(0, 4)
    const m = initial.until.slice(4, 6)
    const d = initial.until.slice(6, 8)
    return `${y}-${m}-${d}`
  })
  const [countStr, setCountStr] = useState<string>(initial.count ? String(initial.count) : '13')
  const eventDate = useMemo(() => parseDateLocal(dateStr), [dateStr])

  function commit() {
    const final: ParsedRrule = { ...opts, until: null, count: null }
    if (endsKind === 'on' && untilStr) {
      final.until = untilStr.replace(/-/g, '')
    } else if (endsKind === 'after') {
      const n = parseInt(countStr, 10)
      if (n > 0) final.count = n
    }
    onDone(serializeRrule(final))
  }

  function toggleDay(code: typeof WEEKDAY_CODES[number]) {
    const has = opts.byday.includes(code)
    const next = has
      ? opts.byday.filter(d => d !== code)
      : [...opts.byday, code]
    // Don't allow zero days; ensure at least the event's day stays selected.
    setOpts({ ...opts, byday: next.length === 0 ? [dayCodeFromDate(eventDate)] : next })
  }

  const inputBase: React.CSSProperties = {
    padding: '4px 8px', borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
    fontSize: '13px', outline: 'none',
  }

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 3500,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          borderRadius: '12px', padding: '24px', width: '380px',
          border: '1px solid var(--border)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Custom recurrence
        </h3>

        {/* Repeat every N [unit] */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Repeat every</span>
          <input
            type="number" min={1} value={opts.interval}
            onChange={e => setOpts({ ...opts, interval: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            style={{ ...inputBase, width: '52px' }}
          />
          <select
            value={opts.freq}
            onChange={e => setOpts({ ...opts, freq: e.target.value as Freq })}
            style={{ ...inputBase, cursor: 'pointer' }}
          >
            <option value="DAILY">{opts.interval === 1 ? 'day' : 'days'}</option>
            <option value="WEEKLY">{opts.interval === 1 ? 'week' : 'weeks'}</option>
            <option value="MONTHLY">{opts.interval === 1 ? 'month' : 'months'}</option>
            <option value="YEARLY">{opts.interval === 1 ? 'year' : 'years'}</option>
          </select>
        </div>

        {/* Weekly: pick days */}
        {opts.freq === 'WEEKLY' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '6px', textAlign: 'center' }}>Repeat on</div>
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
              {WEEKDAY_CODES.map((code, i) => {
                const active = opts.byday.includes(code)
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleDay(code)}
                    style={{
                      // Explicit flex centering so the letter sits dead-center
                      // regardless of button padding from the global Sculpt rules.
                      width: '32px', height: '32px', borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center',
                      padding: 0, lineHeight: 1,
                      background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: active ? 'white' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      fontSize: '12px', fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {WEEKDAY_LETTERS[i]}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Monthly: day-of-month vs nth-weekday */}
        {opts.freq === 'MONTHLY' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <input
                type="radio"
                checked={!opts.bydayWithPos}
                onChange={() => setOpts({
                  ...opts,
                  bydayWithPos: null,
                  bymonthday: eventDate.getDate(),
                })}
              />
              Monthly on day {eventDate.getDate()}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input
                type="radio"
                checked={!!opts.bydayWithPos}
                onChange={() => setOpts({
                  ...opts,
                  bymonthday: null,
                  bydayWithPos: {
                    pos: nthWeekdayOfMonth(eventDate),
                    day: dayCodeFromDate(eventDate),
                  },
                })}
              />
              Monthly on the {ordinalLabel(nthWeekdayOfMonth(eventDate))} {weekdayName(eventDate)}
            </label>
          </div>
        )}

        {/* Ends */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Ends</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <input type="radio" checked={endsKind === 'never'} onChange={() => setEndsKind('never')} />
            Never
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <input type="radio" checked={endsKind === 'on'} onChange={() => setEndsKind('on')} />
            On
            <input
              type="date"
              value={untilStr}
              onChange={e => { setUntilStr(e.target.value); setEndsKind('on') }}
              style={{ ...inputBase }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <input type="radio" checked={endsKind === 'after'} onChange={() => setEndsKind('after')} />
            After
            <input
              type="number" min={1} value={countStr}
              onChange={e => { setCountStr(e.target.value); setEndsKind('after') }}
              style={{ ...inputBase, width: '60px' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>occurrences</span>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 16px', borderRadius: '9999px',
              border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-secondary)',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={commit}
            style={{
              padding: '6px 20px', borderRadius: '9999px', border: 'none',
              background: 'var(--accent)', color: 'white',
              fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

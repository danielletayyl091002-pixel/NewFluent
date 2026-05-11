'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { db, Task } from '@/db/schema'
import { nanoid } from 'nanoid'
import { usePagesStore } from '@/stores/pages'

interface Props {
  onClose: () => void
  onCreated?: () => void
}

type CaptureKind = 'page' | 'task' | 'event'

const KIND_OPTIONS: { value: CaptureKind; label: string; placeholder: string }[] = [
  { value: 'page',  label: 'Page',  placeholder: 'Page title…' },
  { value: 'task',  label: 'Task',  placeholder: 'What do you need to do?' },
  { value: 'event', label: 'Event', placeholder: 'What\'s on your calendar?' },
]

// Universal quick-add. Sunsama-style: one keyboard shortcut, three things
// you can capture without leaving the dashboard. Picks the right table
// based on the kind tab.
export default function QuickCapture({ onClose, onCreated }: Props) {
  const [kind, setKind] = useState<CaptureKind>('page')
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const createPage = usePagesStore(s => s.createPage)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // Tab through kinds with the kind shortcuts: 1=page 2=task 3=event
      if ((e.metaKey || e.ctrlKey) && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault()
        setKind(KIND_OPTIONS[Number(e.key) - 1].value)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  async function handleCreate() {
    if (!title.trim()) return
    try {
      if (kind === 'page') {
        const page = await createPage({ title: title.trim() })
        onCreated?.()
        onClose()
        router.push(`/page/${page.uid}`)
      } else if (kind === 'task') {
        await db.tasks.add({
          uid: nanoid(),
          pageUid: '', // global task — visible in dashboard + board
          title: title.trim(),
          status: 'todo',
          priority: null,
          dueDate: new Date().toISOString().split('T')[0],
          scheduledDate: new Date().toISOString().split('T')[0],
          startTime: null, endTime: null,
          color: 'var(--accent)',
          itemType: 'task',
          createdAt: new Date().toISOString(),
        } as Task)
        onCreated?.()
        onClose()
      } else {
        // Event — default to next hour
        const now = new Date()
        const dateStr = now.toISOString().split('T')[0]
        const start = `${String(now.getHours()).padStart(2, '0')}:00`
        const end = `${String(Math.min(23, now.getHours() + 1)).padStart(2, '0')}:00`
        await db.tasks.add({
          uid: nanoid(),
          pageUid: '',
          title: title.trim(),
          status: 'todo',
          priority: null,
          dueDate: dateStr,
          scheduledDate: dateStr,
          startTime: start, endTime: end,
          color: 'var(--accent)',
          itemType: 'event',
          createdAt: new Date().toISOString(),
        } as Task)
        onCreated?.()
        onClose()
      }
    } catch (err) {
      console.error('QuickCapture: failed', err)
      alert('Could not save. Please try again.')
    }
  }

  const placeholder = KIND_OPTIONS.find(k => k.value === kind)?.placeholder

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 5000,
      background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', paddingTop: '20vh',
    }}>
      <div data-modal onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: '12px', padding: '16px', width: '480px',
        maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
      }}>
        {/* Kind picker — segmented control */}
        <div data-flat style={{
          display: 'flex', gap: '4px', marginBottom: '12px',
          padding: '3px', borderRadius: '8px',
          background: 'var(--bg-secondary)',
        }}>
          {KIND_OPTIONS.map(k => (
            <button
              key={k.value}
              onClick={() => { setKind(k.value); inputRef.current?.focus() }}
              style={{
                flex: 1, padding: '5px 12px', borderRadius: '6px',
                border: 'none',
                background: kind === k.value ? 'var(--bg-primary)' : 'transparent',
                color: kind === k.value ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                boxShadow: kind === k.value ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              }}
            >{k.label}</button>
          ))}
        </div>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          placeholder={placeholder}
          style={{
            width: '100%', fontSize: '16px', fontWeight: 500,
            border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--text-primary)',
            padding: '4px 0',
          }}
        />
        <div style={{
          display: 'flex', justifyContent: 'flex-end',
          gap: '8px', marginTop: '12px', paddingTop: '12px',
          borderTop: '0.5px solid var(--border)',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginRight: 'auto' }}>
            Enter to create · Esc to cancel · ⌘1/2/3 to switch
          </span>
          <button onClick={onClose} style={{
            padding: '6px 14px', background: 'none',
            border: '1px solid var(--border)', borderRadius: '6px',
            cursor: 'pointer', fontSize: '12px',
            color: 'var(--text-secondary)',
          }}>Cancel</button>
          <button onClick={handleCreate} style={{
            padding: '6px 14px', background: 'var(--accent)',
            border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontSize: '12px',
            fontWeight: 600, color: '#fff',
          }}>Create {kind}</button>
        </div>
      </div>
    </div>
  )
}

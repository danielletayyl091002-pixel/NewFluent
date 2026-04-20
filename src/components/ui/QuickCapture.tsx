'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePagesStore } from '@/stores/pages'

interface Props {
  onClose: () => void
  onCreated?: () => void
}

export default function QuickCapture({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const createPage = usePagesStore(s => s.createPage)

  useEffect(() => {
    // Capture whatever was focused before this modal opened so we can
    // restore focus on close (keyboard users were left on <body>).
    const previouslyFocused = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  async function handleCreate() {
    if (!title.trim()) return
    let page
    try {
      page = await createPage({ title: title.trim() })
    } catch (err) {
      console.error('QuickCapture: failed to create page', err)
      alert('Could not create page. Please try again.')
      return
    }
    onCreated?.()
    onClose()
    router.push(`/page/${page.uid}`)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 5000,
      background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', paddingTop: '20vh',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: '12px', padding: '16px', width: '480px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
      }}>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          placeholder="Page title..."
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
        }}>
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
          }}>Create page</button>
        </div>
      </div>
    </div>
  )
}

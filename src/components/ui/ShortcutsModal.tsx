'use client'
import { useEffect } from 'react'

interface Props { onClose: () => void }

const SHORTCUTS = [
  { category: 'Navigation', items: [
    { keys: 'Cmd+K', action: 'Open command palette' },
    { keys: 'Cmd+?', action: 'Show keyboard shortcuts' },
    { keys: 'Cmd+Shift+N', action: 'Quick capture new page' },
  ]},
  { category: 'Editor', items: [
    { keys: '/', action: 'Open block menu' },
    { keys: 'Cmd+B', action: 'Bold' },
    { keys: 'Cmd+I', action: 'Italic' },
    { keys: 'Cmd+Z', action: 'Undo' },
    { keys: 'Cmd+Shift+Z', action: 'Redo' },
  ]},
  { category: 'Calendar', items: [
    { keys: 'T', action: 'Go to today' },
  ]},
]

export default function ShortcutsModal({ onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 5000,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px', width: '480px',
        maxHeight: '70vh', overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '20px',
        }}>
          <span style={{
            fontSize: '14px', fontWeight: 600,
            color: 'var(--text-primary)',
          }}>Keyboard shortcuts</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-tertiary)',
            fontSize: '18px', lineHeight: 1,
          }}>×</button>
        </div>
        {SHORTCUTS.map(group => (
          <div key={group.category} style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '10px', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--text-tertiary)', marginBottom: '8px',
            }}>{group.category}</div>
            {group.items.map(item => (
              <div key={item.keys} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '6px 0',
                borderBottom: '0.5px solid var(--border)',
              }}>
                <span style={{
                  fontSize: '13px', color: 'var(--text-secondary)',
                }}>{item.action}</span>
                <kbd style={{
                  fontSize: '11px', fontFamily: 'monospace',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px', padding: '2px 8px',
                  color: 'var(--text-primary)',
                }}>{item.keys}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

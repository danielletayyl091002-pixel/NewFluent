'use client'
import { useEffect } from 'react'

interface Props {
  message: string
  onDismiss: () => void
}

export default function ErrorToast({ message, onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: '#1a1a1a',
      color: '#fff',
      padding: '10px 20px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: 500,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      maxWidth: '420px',
    }}>
      <span style={{ color: '#f87171' }}>{'\u26a0'}</span>
      <span>{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: '#9ca3af',
          cursor: 'pointer',
          fontSize: '16px',
          lineHeight: 1,
          padding: 0,
          marginLeft: 'auto',
        }}
      >
        {'\u00d7'}
      </button>
    </div>
  )
}

'use client'

// App-level error boundary. Next.js renders this when a route throws.
// Local-first means the user's data is safe in IndexedDB; a render
// crash should never make them think they lost their workspace.

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error('[Fluent] route error', error) }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px', textAlign: 'center',
      background: 'var(--bg-primary)', color: 'var(--text-primary)',
    }}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }} aria-hidden>⚠️</div>
      <h1 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700 }}>
        Something went wrong
      </h1>
      <p style={{
        margin: '0 0 16px', maxWidth: '400px',
        fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.5,
      }}>
        Your data is safe — it lives in your browser, not on a server.
        Try again, or refresh the page.
      </p>
      {error?.message && (
        <pre style={{
          fontSize: '11px', color: 'var(--text-tertiary)',
          background: 'var(--bg-secondary)', padding: '8px 12px',
          borderRadius: '6px', maxWidth: '600px', overflow: 'auto',
          marginBottom: '16px',
        }}>{error.message}</pre>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={reset} style={{
          padding: '8px 16px', borderRadius: '8px',
          border: 'none', background: 'var(--accent)', color: '#fff',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}>Try again</button>
        <button onClick={() => { window.location.href = '/' }} style={{
          padding: '8px 16px', borderRadius: '8px',
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
        }}>Go home</button>
      </div>
    </div>
  )
}

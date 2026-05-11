// Top-level loading skeleton. Next.js shows this while route segments
// are streaming in. Keeps the layout from flashing blank.

export default function Loading() {
  return (
    <div style={{
      flex: 1, padding: '40px 24px',
      display: 'flex', flexDirection: 'column', gap: '16px',
      maxWidth: '720px', margin: '0 auto', width: '100%',
    }}>
      {/* Header bar */}
      <div className="skeleton-pulse" style={{ height: '24px', width: '40%', borderRadius: '6px' }} />
      <div className="skeleton-pulse" style={{ height: '40px', width: '60%', borderRadius: '8px' }} />
      {/* Content rows */}
      <div className="skeleton-pulse" style={{ height: '14px', borderRadius: '4px', marginTop: '16px' }} />
      <div className="skeleton-pulse" style={{ height: '14px', width: '90%', borderRadius: '4px' }} />
      <div className="skeleton-pulse" style={{ height: '14px', width: '75%', borderRadius: '4px' }} />
    </div>
  )
}

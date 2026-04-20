'use client'
import TrackerGrid from '@/components/trackers/TrackerGrid'

export default function TrackersPage() {
  return (
    <div className="has-bg-image" style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg-primary)', backgroundImage: 'var(--bg_trackers, none)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        padding: '32px 40px 16px',
        maxWidth: '860px', margin: '0 auto'
      }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Trackers
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
          Track your daily habits, goals, and metrics.
        </p>
      </div>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '8px 40px 120px' }}>
        <TrackerGrid />
      </div>
    </div>
  )
}

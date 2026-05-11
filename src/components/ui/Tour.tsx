'use client'
// Interactive onboarding tour. Runs once after the Welcome modal completes
// (or on first launch for existing users after this feature ships).
// Highlights real UI surfaces with a positioned tooltip card so users
// learn by looking at the actual app, not at static intro slides.
//
// Persists completion to the Dexie settings table under 'tour_complete'.

import { useEffect, useState, useLayoutEffect } from 'react'
import { db } from '@/db/schema'

interface TourStep {
  // CSS selector for the element to highlight. null = full-screen card.
  target: string | null
  title: string
  body: string
  // Where to anchor the tooltip relative to the highlighted element
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

const STEPS: TourStep[] = [
  {
    target: null,
    title: 'Welcome to your dashboard',
    body: 'This is the Today view — your daily anchor. Schedule, tasks, trackers, and recent pages all in one place.',
    placement: 'center',
  },
  {
    target: null,
    title: 'Press ⌘K anywhere',
    body: 'The command palette searches across pages, tasks, trackers, and finance. It also runs every shortcut — toggle theme, switch time format, jump to a section.',
    placement: 'center',
  },
  {
    target: '[data-tour="trackers-section"]',
    title: 'Track habits with one tap',
    body: 'Tap a ring to log a habit. Mood cycles through emojis. Streaks appear after 3 days in a row. Hover a ring to pin it for emphasis.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="tasks-section"]',
    title: 'Drag tasks onto the timeline',
    body: 'Backlog tasks sit below today\'s. Grab the dots and drag onto any hour cell in the right rail to time-block it. Sunsama-style planning.',
    placement: 'right',
  },
  {
    target: null,
    title: 'You\'re set',
    body: 'Quick capture: ⌘⇧N. Sidebar toggles in/out. Sculpt vs Flat in Settings. Everything lives on your device — no account, works offline.',
    placement: 'center',
  },
]

interface Props {
  onClose: () => void
}

export default function Tour({ onClose }: Props) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const current = STEPS[step]

  // Recompute the highlight rect on each step change + on resize.
  useLayoutEffect(() => {
    function compute() {
      if (!current.target) { setRect(null); return }
      const el = document.querySelector(current.target) as HTMLElement | null
      if (!el) { setRect(null); return }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      // Wait one frame for scroll to settle before reading rect
      requestAnimationFrame(() => setRect(el.getBoundingClientRect()))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [step, current.target])

  async function complete() {
    await db.settings.add({ key: 'tour_complete', value: 'true' })
    onClose()
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1)
    else complete()
  }
  function skip() { complete() }

  // Tooltip position
  const tipStyle: React.CSSProperties = (() => {
    if (!rect || current.placement === 'center' || !current.placement) {
      return {
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }
    const padding = 16
    const tipW = 360, tipH = 200
    if (current.placement === 'bottom') {
      return {
        position: 'fixed',
        top: Math.min(window.innerHeight - tipH - padding, rect.bottom + padding),
        left: Math.max(padding, Math.min(window.innerWidth - tipW - padding, rect.left + rect.width / 2 - tipW / 2)),
      }
    }
    if (current.placement === 'top') {
      return {
        position: 'fixed',
        top: Math.max(padding, rect.top - tipH - padding),
        left: Math.max(padding, Math.min(window.innerWidth - tipW - padding, rect.left + rect.width / 2 - tipW / 2)),
      }
    }
    if (current.placement === 'right') {
      return {
        position: 'fixed',
        top: Math.max(padding, Math.min(window.innerHeight - tipH - padding, rect.top + rect.height / 2 - tipH / 2)),
        left: Math.min(window.innerWidth - tipW - padding, rect.right + padding),
      }
    }
    // left
    return {
      position: 'fixed',
      top: Math.max(padding, Math.min(window.innerHeight - tipH - padding, rect.top + rect.height / 2 - tipH / 2)),
      left: Math.max(padding, rect.left - tipW - padding),
    }
  })()

  return (
    <>
      {/* Dim overlay using SVG mask so the highlighted element shows through.
          Click overlay to skip. */}
      <svg
        onClick={skip}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          width: '100vw', height: '100vh',
          cursor: 'pointer',
        }}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - 6}
                y={rect.top - 6}
                width={rect.width + 12}
                height={rect.height + 12}
                rx={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#tour-mask)" />
        {rect && (
          <rect
            x={rect.left - 6}
            y={rect.top - 6}
            width={rect.width + 12}
            height={rect.height + 12}
            rx={12}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* Tooltip card */}
      <div
        role="dialog"
        aria-label="Onboarding tour"
        style={{
          ...tipStyle,
          zIndex: 9001,
          width: '360px', maxWidth: 'calc(100vw - 32px)',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '20px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '12px',
          fontSize: '11px', color: 'var(--text-tertiary)',
          fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          <span>Step {step + 1} of {STEPS.length}</span>
          <button
            onClick={skip}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-tertiary)', fontSize: '11px',
              cursor: 'pointer', padding: 0,
            }}
          >Skip tour</button>
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {current.title}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          {current.body}
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                padding: '6px 14px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer',
              }}
            >Back</button>
          )}
          <button
            onClick={next}
            data-no-sculpt
            style={{
              padding: '6px 18px', borderRadius: '8px',
              border: 'none', background: 'var(--accent)', color: '#fff',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >{step < STEPS.length - 1 ? 'Next' : 'Got it'}</button>
        </div>
      </div>
    </>
  )
}

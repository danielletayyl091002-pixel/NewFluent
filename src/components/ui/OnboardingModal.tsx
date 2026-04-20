'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/db/schema'
import { nanoid } from 'nanoid'
import { GETTING_STARTED_BLOCKS } from '@/lib/gettingStarted'

interface Props {
  onComplete: () => void
}

const STEPS = [
  {
    title: 'Welcome to Fluent',
    body: 'Your all-in-one workspace for notes, tasks, finance, and calendar. Everything lives on your device — no account needed, works offline.',
    cta: 'Get started',
  },
  {
    title: 'One app, everything you need',
    body: 'Write in the editor, plan in the calendar, track habits, manage finances — all in one place without switching apps.',
    cta: 'Sounds good',
  },
  {
    title: 'Ready to go',
    body: "We'll open a Getting Started page with tips on how to use Fluent. You can delete it anytime.",
    cta: 'Open Fluent',
  },
]

export default function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function handleCta() {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
      return
    }
    if (saving) return
    setSaving(true)

    // Final step — create Getting Started page + blocks.
    // Uses only confirmed Page and Block schema field names.
    const uid = nanoid()
    await db.pages.add({
      uid,
      title: 'Getting Started',
      icon: '\u{1F44B}',
      parentUid: null,
      isFavorite: false,
      inTrash: false,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const now = new Date().toISOString()
    const blocks = GETTING_STARTED_BLOCKS.map((b, i) => ({
      uid: nanoid(),
      pageUid: uid,
      type: b.type,
      content: b.content,
      checked: false,
      order: i,
      createdAt: now,
      updatedAt: now,
    }))
    await db.blocks.bulkAdd(blocks)

    // Mark onboarding complete and point the home redirect at the
    // new page so future visits to '/' land on Getting Started.
    await db.settings.add({ key: 'onboarding_complete', value: 'true' })
    await db.settings.add({ key: 'homePageUid', value: uid })

    onComplete()
    router.push(`/page/${uid}`)
  }

  const current = STEPS[step]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '40px',
        width: '440px',
        maxWidth: 'calc(100vw - 32px)',
        boxSizing: 'border-box',
        textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '6px',
          marginBottom: '32px',
        }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? '24px' : '6px',
              height: '6px',
              borderRadius: '3px',
              background: i === step
                ? 'var(--accent)'
                : 'var(--border)',
              transition: 'width 0.2s ease',
            }} />
          ))}
        </div>

        <h2 style={{
          fontSize: '22px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '12px',
        }}>
          {current.title}
        </h2>

        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: '32px',
        }}>
          {current.body}
        </p>

        <button
          onClick={handleCta}
          disabled={saving}
          style={{
            width: '100%',
            padding: '12px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {current.cta}
        </button>

        {step > 0 && !saving && (
          <button
            onClick={() => setStep(step - 1)}
            style={{
              marginTop: '12px',
              background: 'none',
              border: 'none',
              fontSize: '13px',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            Back
          </button>
        )}
      </div>
    </div>
  )
}

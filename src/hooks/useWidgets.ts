'use client'
import { useEffect, useState } from 'react'
import { db } from '@/db/schema'

// Reactive widget state for the dashboard. Stored as a single JSON row in
// db.settings under 'widgets_state' so adding/removing/configuring widgets
// is one read + one write. Listeners react to a 'widgets-updated' window
// event for instant cross-component sync.

export interface WidgetState {
  id: string
  enabled: boolean
  config: Record<string, unknown>
}

const SETTING_KEY = 'widgets_state'
const EVENT_NAME = 'widgets-updated'

// Defaults — order matters; this is also the dashboard render order.
// Pomodoro and Weather default OFF since they need a deliberate opt-in
// (timer notifications, geolocation permission).
export const DEFAULT_WIDGETS: WidgetState[] = [
  { id: 'clock',     enabled: true,  config: {} },
  { id: 'countdown', enabled: true,  config: { date: '', label: 'New Year' } },
  { id: 'quote',     enabled: true,  config: {} },
  { id: 'pomodoro',  enabled: false, config: { durationMin: 25 } },
  { id: 'weather',   enabled: false, config: { unit: 'C' } },
]

export function useWidgets(): { widgets: WidgetState[]; loaded: boolean } {
  const [widgets, setWidgets] = useState<WidgetState[]>(DEFAULT_WIDGETS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const row = await db.settings.where('key').equals(SETTING_KEY).first()
      if (cancelled) return
      if (row?.value) {
        try {
          const parsed = JSON.parse(row.value) as WidgetState[]
          // Merge with defaults so newly-added widget IDs appear without
          // wiping the user's saved order/config.
          const byId = new Map(parsed.map(w => [w.id, w]))
          const merged: WidgetState[] = [
            ...parsed.filter(w => DEFAULT_WIDGETS.some(d => d.id === w.id)),
            ...DEFAULT_WIDGETS.filter(d => !byId.has(d.id)),
          ]
          setWidgets(merged)
        } catch {
          setWidgets(DEFAULT_WIDGETS)
        }
      }
      setLoaded(true)
    }
    load()
    const onChange = () => load()
    window.addEventListener(EVENT_NAME, onChange)
    return () => {
      cancelled = true
      window.removeEventListener(EVENT_NAME, onChange)
    }
  }, [])

  return { widgets, loaded }
}

export async function saveWidgets(next: WidgetState[]): Promise<void> {
  const value = JSON.stringify(next)
  const exist = await db.settings.where('key').equals(SETTING_KEY).first()
  if (exist?.id) await db.settings.update(exist.id, { value })
  else await db.settings.add({ key: SETTING_KEY, value })
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

// Convenience: toggle a single widget's enabled flag.
export async function toggleWidget(id: string, enabled: boolean, current: WidgetState[]): Promise<void> {
  const byId = new Map(current.map(w => [w.id, w]))
  const existing = byId.get(id)
  const next: WidgetState[] = existing
    ? current.map(w => (w.id === id ? { ...w, enabled } : w))
    : [...current, { id, enabled, config: {} }]
  await saveWidgets(next)
}

// Convenience: patch a widget's config.
export async function updateWidgetConfig(
  id: string,
  patch: Record<string, unknown>,
  current: WidgetState[],
): Promise<void> {
  const next = current.map(w =>
    w.id === id ? { ...w, config: { ...w.config, ...patch } } : w
  )
  await saveWidgets(next)
}

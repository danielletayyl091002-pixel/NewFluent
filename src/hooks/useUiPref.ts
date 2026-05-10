'use client'
import { useSyncExternalStore } from 'react'

// Read-only hook for synchronous-init UI prefs stored in localStorage
// (theme, week_start, time_format). Subscribes to native storage events
// AND in-tab `<key>-changed` custom events so all consumers stay in sync.
//
// Mutators continue to use `localStorage.setItem(key, val)` followed by
// `window.dispatchEvent(new CustomEvent('<key>-changed'))` — the existing
// pattern in CmdK + LeftSidebar + Settings.

export type UiPrefKey = 'theme' | 'week_start' | 'time_format'

function makeSubscribe(key: UiPrefKey) {
  return (cb: () => void) => {
    const onStorage = (e: StorageEvent) => { if (e.key === key) cb() }
    const onChange = () => cb()
    window.addEventListener('storage', onStorage)
    window.addEventListener(`${key}-changed`, onChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(`${key}-changed`, onChange)
    }
  }
}

function getSnapshot(key: UiPrefKey, fallback: string): string {
  if (typeof localStorage === 'undefined') return fallback
  return localStorage.getItem(key) ?? fallback
}

export function useUiPref(key: UiPrefKey, fallback = ''): string {
  return useSyncExternalStore(
    makeSubscribe(key),
    () => getSnapshot(key, fallback),
    () => fallback,
  )
}

export function setUiPref(key: UiPrefKey, value: string) {
  localStorage.setItem(key, value)
  window.dispatchEvent(new CustomEvent(`${key}-changed`, { detail: value }))
}

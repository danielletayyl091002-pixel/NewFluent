'use client'
import { useSyncExternalStore } from 'react'

// Single source of truth for the dark/light theme. Reads localStorage
// synchronously, subscribes to cross-tab `storage` events AND to an
// in-tab `theme-changed` event so all three entry points (sidebar
// toggle, CmdK action, Settings) stay in sync without polling.

type Theme = 'light' | 'dark'

function getSnapshot(): Theme {
  if (typeof localStorage === 'undefined') return 'light'
  return (localStorage.getItem('theme') as Theme) || 'light'
}

function getServerSnapshot(): Theme {
  return 'light'
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === 'theme') cb() }
  const onChange = () => cb()
  window.addEventListener('storage', onStorage)
  window.addEventListener('theme-changed', onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('theme-changed', onChange)
  }
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setTheme = (next: Theme) => {
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: next }))
  }

  return [theme, setTheme]
}

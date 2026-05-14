'use client'
import { useEffect, useState } from 'react'
import { db } from '@/db/schema'

// Reactive user profile (display name + avatar). Stored in db.settings as
// rows 'display_name' (string) and 'avatar' (DataURL string). Subscribers
// listen for the 'profile-updated' window event so changes from /settings
// or anywhere else propagate instantly across sidebar / dashboard / etc.

export interface UserProfile {
  displayName: string
  avatarUrl: string | null   // DataURL or null
  loaded: boolean
}

const EMPTY: UserProfile = { displayName: '', avatarUrl: null, loaded: false }

export function useUserProfile(): UserProfile {
  const [profile, setProfile] = useState<UserProfile>(EMPTY)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [name, avatar] = await Promise.all([
        db.settings.where('key').equals('display_name').first(),
        db.settings.where('key').equals('avatar').first(),
      ])
      if (cancelled) return
      setProfile({
        displayName: name?.value || '',
        avatarUrl: avatar?.value || null,
        loaded: true,
      })
    }
    load()
    const onChange = () => load()
    window.addEventListener('profile-updated', onChange)
    return () => {
      cancelled = true
      window.removeEventListener('profile-updated', onChange)
    }
  }, [])

  return profile
}

// Persist a profile change (one or both fields) and notify all subscribers.
export async function saveProfile(patch: Partial<{ displayName: string; avatarUrl: string | null }>) {
  if (patch.displayName !== undefined) {
    const exist = await db.settings.where('key').equals('display_name').first()
    if (exist?.id) await db.settings.update(exist.id, { value: patch.displayName })
    else await db.settings.add({ key: 'display_name', value: patch.displayName })
  }
  if (patch.avatarUrl !== undefined) {
    const exist = await db.settings.where('key').equals('avatar').first()
    if (patch.avatarUrl === null) {
      if (exist?.id) await db.settings.delete(exist.id)
    } else {
      if (exist?.id) await db.settings.update(exist.id, { value: patch.avatarUrl })
      else await db.settings.add({ key: 'avatar', value: patch.avatarUrl })
    }
  }
  window.dispatchEvent(new CustomEvent('profile-updated'))
}

// Helper: read the user's first initial for the avatar fallback chip.
export function initialFor(displayName: string): string {
  const trimmed = displayName.trim()
  if (!trimmed) return '👤'
  return trimmed.charAt(0).toUpperCase()
}

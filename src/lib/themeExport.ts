// Theme pack — curated subset of settings that controls the workspace's
// visual identity. Designed to be shared between users without leaking
// personal data (display name, avatar, page covers, countdown dates,
// etc. are all excluded by virtue of not appearing in THEME_KEYS).
//
// File format (versioned for future migrations):
//   {
//     "version": 1,
//     "name": "Sunset",
//     "exportedAt": "2026-05-14T18:00:00Z",
//     "settings": { "<key>": "<value>", ... }
//   }

import { db } from '@/db/schema'

export const THEME_VERSION = 1

// Whitelist of setting keys included in a theme export. Add new keys here
// as new visual surfaces are introduced.
export const THEME_KEYS = [
  // Workspace skin
  'sidebar_pattern',
  'accent_gradient_to',
  // Palette
  'palette',
  'palette_accent',
  'palette_accent_light',
  'palette_bg_primary',
  'palette_bg_secondary',
  'palette_bg_sidebar',
  // Typography
  'font',
  'font_size',
  // Interface
  'interface_style',
  'radius_style',
  'border_strength',
  'shadow_depth',
  'layout_density',
  'cal_event_style',
  'tint_strength',
  // Page background images
  'bg_trackers',
  'bg_finance',
  'bg_board',
  'bg_trackers_opacity',
  'bg_finance_opacity',
  'bg_board_opacity',
] as const

export interface ThemePack {
  version: number
  name: string
  exportedAt: string
  settings: Record<string, string>
}

// Build a ThemePack from the current db.settings. Excludes any key not
// listed in THEME_KEYS so personal data never leaks.
export async function buildThemePack(name: string): Promise<ThemePack> {
  const all = await db.settings.toArray()
  const settings: Record<string, string> = {}
  for (const s of all) {
    if ((THEME_KEYS as readonly string[]).includes(s.key)) {
      settings[s.key] = s.value
    }
  }
  return {
    version: THEME_VERSION,
    name: name.trim() || 'Untitled theme',
    exportedAt: new Date().toISOString(),
    settings,
  }
}

// Trigger a browser download of the theme as JSON.
export async function downloadTheme(name: string): Promise<void> {
  const pack = await buildThemePack(name)
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const safeName = pack.name.replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase() || 'theme'
  const a = document.createElement('a')
  a.href = url
  a.download = `fluent-${safeName}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Import a theme pack: validate, write each whitelisted key, then ask the
// caller to reload so CSS variables re-apply via ClientLayout's bootstrap.
export async function importTheme(text: string): Promise<{ applied: number; skipped: number }> {
  let pack: unknown
  try { pack = JSON.parse(text) } catch {
    throw new Error('Not a valid JSON file.')
  }
  if (!pack || typeof pack !== 'object') throw new Error('Theme file is empty.')
  const p = pack as Partial<ThemePack>
  if (p.version == null || typeof p.settings !== 'object' || p.settings === null) {
    throw new Error('Missing version or settings in theme file.')
  }
  if (p.version > THEME_VERSION) {
    throw new Error(`Theme was made with a newer version (${p.version}) than this app supports (${THEME_VERSION}).`)
  }
  let applied = 0
  let skipped = 0
  for (const [key, value] of Object.entries(p.settings)) {
    // Only write keys we recognise — protects against malicious or
    // mistyped files setting arbitrary settings.
    if (!(THEME_KEYS as readonly string[]).includes(key)) { skipped++; continue }
    if (typeof value !== 'string') { skipped++; continue }
    const existing = await db.settings.where('key').equals(key).first()
    if (existing?.id) await db.settings.update(existing.id, { value })
    else await db.settings.add({ key, value })
    applied++
  }
  return { applied, skipped }
}

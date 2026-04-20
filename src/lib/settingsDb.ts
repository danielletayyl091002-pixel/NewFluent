import { db } from '@/db/schema'

// Upsert a single key/value into the settings table. Replaces the
// 14-instance copy-paste of `where().equals().first().then(ex => ex?.id ? update : add)`
// scattered across src/app/settings/page.tsx.
export async function saveSetting(key: string, value: string): Promise<void> {
  const existing = await db.settings.where('key').equals(key).first()
  if (existing?.id) {
    await db.settings.update(existing.id, { value })
  } else {
    await db.settings.add({ key, value })
  }
}

// Read a single setting value. Returns undefined if unset.
export async function readSetting(key: string): Promise<string | undefined> {
  const row = await db.settings.where('key').equals(key).first()
  return row?.value
}

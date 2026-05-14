'use client'
import { create } from 'zustand'
import { db, TrackerDefinition, TrackerLog } from '@/db/schema'
import { nanoid } from 'nanoid'

interface TrackerState {
  definitions: TrackerDefinition[]
  logs: TrackerLog[]
  loaded: boolean
  load: () => Promise<void>
  addDefinition: (def: Omit<TrackerDefinition, 'id' | 'uid' | 'order' | 'createdAt'>) => Promise<void>
  updateDefinition: (uid: string, updates: Partial<TrackerDefinition>) => Promise<void>
  deleteDefinition: (uid: string) => Promise<void>
  addLog: (trackerUid: string, value: number, note?: string, date?: string, startTime?: string, endTime?: string) => Promise<void>
  setTodayValue: (trackerUid: string, value: number, note?: string) => Promise<void>
  getTodayValue: (trackerUid: string) => number
  getWeekData: (trackerUid: string) => number[]
  /** True consecutive-days streak (walks back from today across all logs).
   *  Counts a day as "hit" when the day's total value > 0. For habits with
   *  a target > 1 you can pass `target` to require value >= target. */
  getCurrentStreak: (trackerUid: string, target?: number) => number
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function lastNDays(n: number): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

export const useTrackerStore = create<TrackerState>((set, get) => ({
  definitions: [],
  logs: [],
  loaded: false,

  async load() {
    const definitions = await db.trackerDefinitions.orderBy('order').toArray()
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString().split('T')[0]
    const logs = await db.trackerLogs
      .where('date')
      .aboveOrEqual(weekAgoStr)
      .toArray()
    set({ definitions, logs, loaded: true })
  },

  async addDefinition(def) {
    const { definitions } = get()
    const newDef: TrackerDefinition = {
      ...def,
      uid: nanoid(),
      order: definitions.length,
      createdAt: new Date().toISOString(),
    }
    await db.trackerDefinitions.add(newDef)
    set({ definitions: [...definitions, newDef] })
  },

  async updateDefinition(uid, updates) {
    const def = get().definitions.find(d => d.uid === uid)
    if (!def?.id) return
    await db.trackerDefinitions.update(def.id, updates)
    set({
      definitions: get().definitions.map(d =>
        d.uid === uid ? { ...d, ...updates } : d
      ),
    })
  },

  async deleteDefinition(uid) {
    const def = get().definitions.find(d => d.uid === uid)
    if (!def?.id) return
    await db.trackerDefinitions.delete(def.id)
    // Also delete all logs for this tracker
    await db.trackerLogs.where('trackerUid').equals(uid).delete()
    set({
      definitions: get().definitions.filter(d => d.uid !== uid),
      logs: get().logs.filter(l => l.trackerUid !== uid),
    })
  },

  async addLog(trackerUid, value, note = '', date?: string, startTime?: string, endTime?: string) {
    const logDate = date || todayStr()
    const newLog: TrackerLog = {
      trackerUid,
      value,
      note,
      date: logDate,
      startTime: startTime || null,
      endTime: endTime || null,
      createdAt: new Date().toISOString(),
    }
    await db.trackerLogs.add(newLog)
    set({ logs: [...get().logs, newLog] })
  },

  async setTodayValue(trackerUid, value, note = '') {
    const today = new Date().toISOString().split('T')[0]
    const todayLogs = get().logs.filter(
      l => l.trackerUid === trackerUid && l.date === today
    )
    for (const log of todayLogs) {
      if (log.id) await db.trackerLogs.delete(log.id)
    }
    // value === 0 means clear (no log for today). Used by mood toggle:
    // clicking the same emoji again removes the log.
    if (value === 0) {
      set({ logs: get().logs.filter(l => !(l.trackerUid === trackerUid && l.date === today)) })
      return
    }
    const newLog: TrackerLog = {
      trackerUid, value, note,
      date: today,
      startTime: null, endTime: null,
      createdAt: new Date().toISOString()
    }
    await db.trackerLogs.add(newLog)
    set({
      logs: [
        ...get().logs.filter(l => !(l.trackerUid === trackerUid && l.date === today)),
        newLog
      ]
    })
  },

  getTodayValue(trackerUid) {
    const today = todayStr()
    return get()
      .logs.filter(l => l.trackerUid === trackerUid && l.date === today)
      .reduce((sum, l) => sum + l.value, 0)
  },

  getWeekData(trackerUid) {
    const days = lastNDays(7)
    const logs = get().logs.filter(l => l.trackerUid === trackerUid)
    return days.map(day =>
      logs.filter(l => l.date === day).reduce((sum, l) => sum + l.value, 0)
    )
  },

  getCurrentStreak(trackerUid, target = 1) {
    // Walk backwards from today; stop at the first day with no qualifying
    // log. If today itself isn't logged yet, give the user a one-day grace
    // (start from yesterday) so the chain doesn't visually "break" mid-day.
    const logs = get().logs.filter(l => l.trackerUid === trackerUid)
    const sumByDay = new Map<string, number>()
    for (const l of logs) {
      sumByDay.set(l.date, (sumByDay.get(l.date) || 0) + l.value)
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayKey = today.toISOString().split('T')[0]
    const todayHit = (sumByDay.get(todayKey) || 0) >= target
    let streak = 0
    let cursor = new Date(today)
    if (!todayHit) {
      // Grace day: don't count today as a miss; start from yesterday.
      cursor.setDate(cursor.getDate() - 1)
    }
    while (true) {
      const key = cursor.toISOString().split('T')[0]
      if ((sumByDay.get(key) || 0) >= target) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      } else {
        break
      }
    }
    // If today IS hit, count it on top of the past run.
    if (todayHit) streak++
    return streak
  },
}))

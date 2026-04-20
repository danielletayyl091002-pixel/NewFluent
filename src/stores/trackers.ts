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
}))

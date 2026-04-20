import Dexie, { Table } from 'dexie'
import { nanoid } from 'nanoid'

export interface Page {
  id?: number
  uid: string
  title: string
  icon: string | null
  parentUid: string | null
  isFavorite: boolean
  inTrash: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export interface Block {
  id?: number
  uid: string
  pageUid: string
  type: 'text' | 'heading1' | 'heading2' | 'heading3' |
        'todo' | 'bullet' | 'numbered' | 'quote' | 'code' | 'divider' | 'table' | 'callout' | 'document'
  content: string
  checked: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export interface Task {
  id?: number
  uid: string
  pageUid: string
  title: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'high' | 'medium' | 'low' | null
  dueDate: string | null
  scheduledDate: string | null
  startTime: string | null
  endTime: string | null
  color: string
  createdAt: string
  description?: string | null
  location?: string | null
  itemType?: 'task' | 'event'
  recurrence?: string | null
  recurrenceException?: string | null
  reminder?: number | null
  url?: string | null
  linkedPageUid?: string | null
}

export interface Setting {
  id?: number
  key: string
  value: string
}

export interface FinanceEntry {
  id?: number
  type: 'income' | 'expense'
  amount: number
  category: string
  date: string
  note: string
  createdAt: string
}

export interface FinanceCategory {
  id?: number
  name: string
  color: string
  type: 'income' | 'expense' | 'both'
  isDefault: boolean
}

export interface TrackerDefinition {
  id?: number
  uid: string
  name: string
  icon: string
  unit: string
  target: number
  color: string
  type: 'counter' | 'value' | 'select' | 'habit'
  options: string | null // JSON array for select type (e.g. mood emojis)
  notes: string | null
  order: number
  createdAt: string
}

export interface TrackerLog {
  id?: number
  trackerUid: string
  value: number
  note: string
  date: string
  startTime: string | null
  endTime: string | null
  createdAt: string
}

export interface DatabaseDef {
  id?: number
  uid: string
  pageUid: string
  name: string
  createdAt: string
}

export interface DatabaseColumn {
  id?: number
  uid: string
  databaseUid: string
  name: string
  type: 'text' | 'number' | 'date' | 'checkbox' | 'select'
  order: number
  options?: string | null
}

export interface DatabaseRow {
  id?: number
  uid: string
  databaseUid: string
  order: number
  createdAt: string
}

export interface DatabaseCell {
  id?: number
  uid: string
  rowUid: string
  columnUid: string
  value: string
}

export interface CanvasItem {
  id?: number
  uid: string
  pageUid: string
  type: 'text' | 'image'
  x: number
  y: number
  width: number
  height: number
  content: string
  imageBlob?: Blob
  mimeType?: string
  naturalWidth?: number
  naturalHeight?: number
  createdAt: string
  updatedAt: string
}

class FluentDB extends Dexie {
  pages!: Table<Page>
  blocks!: Table<Block>
  tasks!: Table<Task>
  settings!: Table<Setting>
  financeEntries!: Table<FinanceEntry>
  financeCategories!: Table<FinanceCategory>
  trackerDefinitions!: Table<TrackerDefinition>
  trackerLogs!: Table<TrackerLog>
  databases!: Table<DatabaseDef>
  databaseColumns!: Table<DatabaseColumn>
  databaseRows!: Table<DatabaseRow>
  databaseCells!: Table<DatabaseCell>
  canvasItems!: Table<CanvasItem>

  constructor() {
    super('fluentv2')
    this.version(1).stores({
      pages: '++id, uid, parentUid, isFavorite',
      blocks: '++id, uid, pageUid, type, order',
      tasks: '++id, uid, status, dueDate, scheduledDate',
      settings: '++id, key',
      financeEntries: '++id, type, category, date',
      financeCategories: '++id, type'
    })
    this.version(2).stores({
      pages: '++id, uid, parentUid, isFavorite',
      blocks: '++id, uid, pageUid, type, order',
      tasks: '++id, uid, status, dueDate, scheduledDate',
      settings: '++id, key',
      financeEntries: '++id, type, category, date',
      financeCategories: '++id, type',
      trackerDefinitions: '++id, uid, type, order',
      trackerLogs: '++id, trackerUid, date'
    })
    this.version(3).stores({
      pages: '++id, uid, parentUid, isFavorite',
      blocks: '++id, uid, pageUid, type, order',
      tasks: '++id, uid, pageUid, status, dueDate, scheduledDate',
      settings: '++id, key',
      financeEntries: '++id, type, category, date',
      financeCategories: '++id, type',
      trackerDefinitions: '++id, uid, type, order',
      trackerLogs: '++id, trackerUid, date'
    })
    this.version(4).stores({
      pages: '++id, uid, parentUid, isFavorite',
      blocks: '++id, uid, pageUid, type, order',
      tasks: '++id, uid, pageUid, status, dueDate, scheduledDate',
      settings: '++id, key',
      financeEntries: '++id, type, category, date',
      financeCategories: '++id, type',
      trackerDefinitions: '++id, uid, type, order',
      trackerLogs: '++id, trackerUid, date'
    })
    this.version(5).stores({
      pages: '++id, uid, parentUid, isFavorite',
      blocks: '++id, uid, pageUid, type, order',
      tasks: '++id, uid, pageUid, status, dueDate, scheduledDate',
      settings: '++id, key',
      financeEntries: '++id, type, category, date',
      financeCategories: '++id, type',
      trackerDefinitions: '++id, uid, type, order',
      trackerLogs: '++id, trackerUid, date'
    })
    this.version(6).stores({
      pages: '++id, uid, parentUid, isFavorite',
      blocks: '++id, uid, pageUid, type, order',
      tasks: '++id, uid, pageUid, status, dueDate, scheduledDate',
      settings: '++id, key',
      financeEntries: '++id, type, category, date',
      financeCategories: '++id, type',
      trackerDefinitions: '++id, uid, type, order',
      trackerLogs: '++id, trackerUid, date',
      databases: '++id, uid, pageUid',
      databaseColumns: '++id, uid, databaseUid, order',
      databaseRows: '++id, uid, databaseUid, order',
      databaseCells: '++id, uid, rowUid, columnUid'
    })
    this.version(7).stores({
      pages: '++id, uid, parentUid, isFavorite',
      blocks: '++id, uid, pageUid, type, order',
      tasks: '++id, uid, pageUid, status, dueDate, scheduledDate',
      settings: '++id, key',
      financeEntries: '++id, type, category, date',
      financeCategories: '++id, type',
      trackerDefinitions: '++id, uid, type, order',
      trackerLogs: '++id, trackerUid, date',
      databases: '++id, uid, pageUid',
      databaseColumns: '++id, uid, databaseUid, order',
      databaseRows: '++id, uid, databaseUid, order',
      databaseCells: '++id, uid, rowUid, columnUid'
    })
    this.version(8).stores({
      pages: '++id, uid, parentUid, isFavorite',
      blocks: '++id, uid, pageUid, type, order',
      tasks: '++id, uid, pageUid, status, dueDate, scheduledDate',
      settings: '++id, key',
      financeEntries: '++id, type, category, date',
      financeCategories: '++id, type',
      trackerDefinitions: '++id, uid, type, order',
      trackerLogs: '++id, trackerUid, date',
      databases: '++id, uid, pageUid',
      databaseColumns: '++id, uid, databaseUid, order',
      databaseRows: '++id, uid, databaseUid, order',
      databaseCells: '++id, uid, rowUid, columnUid',
      canvasItems: '++id, uid, pageUid'
    })
    this.version(9).stores({
      pages: '++id, uid, parentUid, isFavorite',
      blocks: '++id, uid, pageUid, type, order',
      tasks: '++id, uid, pageUid, status, dueDate, scheduledDate',
      settings: '++id, key',
      financeEntries: '++id, type, category, date',
      financeCategories: '++id, type',
      trackerDefinitions: '++id, uid, type, order',
      trackerLogs: '++id, trackerUid, date',
      databases: '++id, uid, pageUid',
      databaseColumns: '++id, uid, databaseUid, order',
      databaseRows: '++id, uid, databaseUid, order',
      databaseCells: '++id, uid, rowUid, columnUid',
      canvasItems: '++id, uid, pageUid, type'
    })
    // v10 adds recurrence/recurrenceException fields on Task. These are
    // non-indexed string fields so no schema string change is required, but
    // the version bump ensures Dexie re-opens the DB and applies the TS type.
    this.version(10).stores({
      pages: '++id, uid, parentUid, isFavorite',
      blocks: '++id, uid, pageUid, type, order',
      tasks: '++id, uid, pageUid, status, dueDate, scheduledDate',
      settings: '++id, key',
      financeEntries: '++id, type, category, date',
      financeCategories: '++id, type',
      trackerDefinitions: '++id, uid, type, order',
      trackerLogs: '++id, trackerUid, date',
      databases: '++id, uid, pageUid',
      databaseColumns: '++id, uid, databaseUid, order',
      databaseRows: '++id, uid, databaseUid, order',
      databaseCells: '++id, uid, rowUid, columnUid',
      canvasItems: '++id, uid, pageUid, type'
    })
    // v11 adds Task.linkedPageUid — non-indexed string, no schema
    // string change needed, bump is just for clean upgrade semantics.
    this.version(11).stores({
      pages: '++id, uid, parentUid, isFavorite',
      blocks: '++id, uid, pageUid, type, order',
      tasks: '++id, uid, pageUid, status, dueDate, scheduledDate',
      settings: '++id, key',
      financeEntries: '++id, type, category, date',
      financeCategories: '++id, type',
      trackerDefinitions: '++id, uid, type, order',
      trackerLogs: '++id, trackerUid, date',
      databases: '++id, uid, pageUid',
      databaseColumns: '++id, uid, databaseUid, order',
      databaseRows: '++id, uid, databaseUid, order',
      databaseCells: '++id, uid, rowUid, columnUid',
      canvasItems: '++id, uid, pageUid, type'
    })
  }
}

export const db = new FluentDB()

export async function seedIfEmpty() {
  const existing = await db.settings.where('key').equals('seeded').first()
  if (existing) return

  // Note: the Home page + welcome blocks + homePageUid that used to be
  // seeded here are now created by the first-run OnboardingModal. This
  // function seeds only the side data (trackers, finance, non-page
  // settings) so new users see a blank slate until onboarding runs.

  await db.trackerDefinitions.bulkAdd([
    { uid: nanoid(), name: 'Water', icon: '💧', unit: 'cups', target: 8, color: '#3B82F6', type: 'counter', options: null, notes: null, order: 0, createdAt: new Date().toISOString() },
    { uid: nanoid(), name: 'Sleep', icon: '😴', unit: 'hours', target: 8, color: '#8B5CF6', type: 'value', options: null, notes: null, order: 1, createdAt: new Date().toISOString() },
    { uid: nanoid(), name: 'Exercise', icon: '🏃', unit: 'min', target: 30, color: '#EF4444', type: 'value', options: null, notes: null, order: 2, createdAt: new Date().toISOString() },
    { uid: nanoid(), name: 'Reading', icon: '📖', unit: 'pages', target: 20, color: '#A855F7', type: 'value', options: null, notes: null, order: 3, createdAt: new Date().toISOString() },
    { uid: nanoid(), name: 'Mood', icon: '😊', unit: '', target: 5, color: '#EC4899', type: 'select', options: JSON.stringify(['😢', '😕', '😐', '🙂', '😊']), notes: null, order: 4, createdAt: new Date().toISOString() },
    { uid: nanoid(), name: 'Meditation', icon: '🧘', unit: 'min', target: 15, color: '#14B8A6', type: 'value', options: null, notes: null, order: 5, createdAt: new Date().toISOString() },
    { uid: nanoid(), name: 'Steps', icon: '👟', unit: 'steps', target: 10000, color: '#F59E0B', type: 'value', options: null, notes: null, order: 6, createdAt: new Date().toISOString() },
    { uid: nanoid(), name: 'Journaling', icon: '📝', unit: '', target: 1, color: '#6366F1', type: 'habit', options: null, notes: null, order: 7, createdAt: new Date().toISOString() },
    { uid: nanoid(), name: 'No Caffeine', icon: '☕', unit: '', target: 1, color: '#78716C', type: 'habit', options: null, notes: null, order: 8, createdAt: new Date().toISOString() },
  ])

  await db.financeCategories.bulkAdd([
    { name: 'Salary', color: '#10B981', type: 'income', isDefault: true },
    { name: 'Freelance', color: '#3B82F6', type: 'income', isDefault: true },
    { name: 'Investments', color: '#8B5CF6', type: 'income', isDefault: true },
    { name: 'Food', color: '#F59E0B', type: 'expense', isDefault: true },
    { name: 'Transport', color: '#EF4444', type: 'expense', isDefault: true },
    { name: 'Shopping', color: '#EC4899', type: 'expense', isDefault: true },
    { name: 'Bills', color: '#6366F1', type: 'expense', isDefault: true },
    { name: 'Entertainment', color: '#14B8A6', type: 'expense', isDefault: true },
    { name: 'Health', color: '#22C55E', type: 'expense', isDefault: true },
    { name: 'Other', color: '#78716C', type: 'both', isDefault: true },
  ])

  await db.settings.add({ key: 'seeded', value: 'true' })
  await db.settings.add({ key: 'theme', value: 'light' })
  // homePageUid is now set by OnboardingModal after it creates the
  // Getting Started page on first run.
}

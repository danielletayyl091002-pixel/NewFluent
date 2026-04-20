'use client'
import { create } from 'zustand'
import { db, Page } from '@/db/schema'
import { nanoid } from 'nanoid'

interface PagesState {
  pages: Page[]
  loaded: boolean
  load: () => Promise<void>
  refresh: () => Promise<void>
  createPage: (overrides?: Partial<Omit<Page, 'id' | 'order' | 'createdAt' | 'updatedAt'>>) => Promise<Page>
  updatePage: (uid: string, updates: Partial<Page>) => Promise<void>
  deletePage: (uid: string) => Promise<void>
}

const now = () => new Date().toISOString()

async function loadPages(): Promise<Page[]> {
  return db.pages.filter(p => !p.inTrash).sortBy('order')
}

export const usePagesStore = create<PagesState>((set, get) => ({
  pages: [],
  loaded: false,

  async load() {
    if (get().loaded) return
    const pages = await loadPages()
    set({ pages, loaded: true })
  },

  async refresh() {
    const pages = await loadPages()
    set({ pages })
  },

  async createPage(overrides = {}) {
    const uid = overrides.uid ?? nanoid()
    const page: Page = {
      uid,
      title: 'Untitled',
      icon: null,
      parentUid: null,
      isFavorite: false,
      inTrash: false,
      order: get().pages.length,
      createdAt: now(),
      updatedAt: now(),
      ...overrides,
    }
    await db.pages.add(page)
    set({ pages: [...get().pages, page] })
    return page
  },

  async updatePage(uid, updates) {
    const page = get().pages.find(p => p.uid === uid)
    if (!page?.id) return
    const merged = { ...updates, updatedAt: now() }
    await db.pages.update(page.id, merged)
    set({
      pages: get().pages.map(p =>
        p.uid === uid ? { ...p, ...merged } : p
      ),
    })
  },

  async deletePage(uid) {
    const page = get().pages.find(p => p.uid === uid)
    if (!page?.id) return
    await db.pages.update(page.id, { inTrash: true, updatedAt: now() })
    set({ pages: get().pages.filter(p => p.uid !== uid) })
  },
}))

'use client'
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { ReactRenderer } from '@tiptap/react'
import tippy, { Instance } from 'tippy.js'
import { Editor, Range } from '@tiptap/core'
import { nanoid } from 'nanoid'
import { db } from '@/db/schema'
import { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import Fuse from 'fuse.js'

interface SlashItem {
  title: string
  command: string
  attrs?: Record<string, unknown>
  icon: string
  shortcut: string
}

const commands: SlashItem[] = [
  { title: 'Text', command: 'paragraph', icon: 'T', shortcut: '' },
  { title: 'Heading 1', command: 'heading', attrs: { level: 1 }, icon: 'H1', shortcut: '' },
  { title: 'Heading 2', command: 'heading', attrs: { level: 2 }, icon: 'H2', shortcut: '' },
  { title: 'Heading 3', command: 'heading', attrs: { level: 3 }, icon: 'H3', shortcut: '' },
  { title: 'Bullet List', command: 'bulletList', icon: '\u2022', shortcut: '' },
  { title: 'Numbered List', command: 'orderedList', icon: '1.', shortcut: '' },
  { title: 'To-do List', command: 'taskList', icon: '\u2610', shortcut: '' },
  { title: 'Quote', command: 'blockquote', icon: '\u201C', shortcut: '' },
  { title: 'Code Block', command: 'codeBlock', icon: '</>', shortcut: '' },
  { title: 'Divider', command: 'horizontalRule', icon: '\u2014', shortcut: '' },
  { title: 'Callout', command: 'callout', icon: '\uD83D\uDCA1', shortcut: '' },
  { title: 'Table', command: 'table', icon: '\u229E', shortcut: '' },
  { title: 'Database', command: 'database', icon: '\u25A6', shortcut: '' },
  { title: 'Collapse', command: 'toggle', icon: '\u25B6', shortcut: '' },
]

const fuse = new Fuse(commands, { keys: ['title'], threshold: 0.3 })

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem('fluent_slash_recent') || '[]')
  } catch { return [] }
}

function addRecent(title: string) {
  const recent = getRecent().filter((t: string) => t !== title)
  recent.unshift(title)
  localStorage.setItem('fluent_slash_recent', JSON.stringify(recent.slice(0, 3)))
}

export const suggestion: Omit<SuggestionOptions, 'editor'> = {
  char: '/',
  command: ({ editor, range, props }: { editor: Editor; range: Range; props: any }) => {
    const { type, attrs } = props
    // Delete the slash text first, then apply the block command in one chain
    // For node types that use setNode, chain works directly
    // For toggle types (lists, blockquote), we must deleteRange first then toggle
    switch (type) {
      case 'paragraph':
        editor.chain().focus().deleteRange(range).setNode('paragraph').run()
        break
      case 'heading':
        editor.chain().focus().deleteRange(range).setNode('heading', attrs).run()
        break
      case 'bulletList':
        editor.chain().focus().deleteRange(range).toggleBulletList().run()
        break
      case 'orderedList':
        editor.chain().focus().deleteRange(range).toggleOrderedList().run()
        break
      case 'taskList':
        editor.chain().focus().deleteRange(range).toggleTaskList().run()
        break
      case 'blockquote':
        editor.chain().focus().deleteRange(range).toggleBlockquote().run()
        break
      case 'codeBlock':
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
        break
      case 'horizontalRule':
        editor.chain().focus().deleteRange(range).setHorizontalRule().run()
        break
      case 'callout':
        editor.chain().focus().deleteRange(range).setCallout().run()
        break
      case 'table':
        editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        break
      case 'database': {
        const uid = nanoid()
        const pageUid = (editor.options as any)?.editorProps?.attributes?.['data-page-uid'] || ''
        db.databases.add({ uid, pageUid, name: 'Untitled Database', createdAt: new Date().toISOString() }).then(async () => {
          const colUids = [nanoid(), nanoid(), nanoid()]
          await db.databaseColumns.bulkAdd([
            { uid: colUids[0], databaseUid: uid, name: 'Name', type: 'text' as const, order: 0, options: null },
            { uid: colUids[1], databaseUid: uid, name: 'Value', type: 'number' as const, order: 1, options: null },
            { uid: colUids[2], databaseUid: uid, name: 'Date', type: 'date' as const, order: 2, options: null },
          ])
          await db.databaseRows.bulkAdd([
            { uid: nanoid(), databaseUid: uid, order: 0, createdAt: new Date().toISOString() },
            { uid: nanoid(), databaseUid: uid, order: 1, createdAt: new Date().toISOString() },
            { uid: nanoid(), databaseUid: uid, order: 2, createdAt: new Date().toISOString() },
          ])
        })
        editor.chain().focus().deleteRange(range).insertContent({ type: 'database', attrs: { uid, pageUid } }).run()
        break
      }
      case 'toggle':
        editor.chain().focus().deleteRange(range).insertContent({
          type: 'toggle',
          attrs: { open: false },
          content: [{ type: 'paragraph' }],
        }).run()
        break
      default:
        editor.chain().focus().deleteRange(range).setNode('paragraph').run()
        break
    }
  },
  items: ({ query }: { query: string }) => {
    const recent = getRecent()
    const filtered = query ? fuse.search(query).map(r => r.item) : commands
    const recentItems = filtered.filter(c => recent.includes(c.title))
    const otherItems = filtered.filter(c => !recent.includes(c.title))
    return [...recentItems, ...otherItems]
  },
  render: () => {
    let component: ReactRenderer | null = null
    let popup: Instance[] | null = null

    return {
      onStart: (props: SuggestionProps) => {
        component = new ReactRenderer(MenuList, {
          props,
          editor: props.editor,
        })
        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },
      onUpdate(props: SuggestionProps) {
        component?.updateProps(props)
        if (popup?.[0]) {
          popup[0].setProps({ getReferenceClientRect: props.clientRect as () => DOMRect })
        }
      },
      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide()
          return true
        }
        return (component?.ref as any)?.onKeyDown(props) ?? false
      },
      onExit() {
        popup?.[0]?.destroy()
        component?.destroy()
      },
    }
  },
}

const MenuList = forwardRef((props: any, ref) => {
  const { items, command } = props
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev: number) => (prev - 1 + items.length) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev: number) => (prev + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(items[selectedIndex])
        return true
      }
      return false
    },
  }))

  const selectItem = (item: SlashItem) => {
    if (!item) return
    addRecent(item.title)
    command({ type: item.command, attrs: item.attrs })
  }

  if (!items?.length) return null

  return (
    <div className="slash-menu">
      {items.map((item: SlashItem, idx: number) => (
        <div
          key={item.title}
          className={`slash-item ${idx === selectedIndex ? 'selected' : ''}`}
          onClick={() => selectItem(item)}
          onMouseEnter={() => setSelectedIndex(idx)}
        >
          <span className="slash-icon">{item.icon}</span>
          <span className="slash-title">{item.title}</span>
          {item.shortcut && <span className="slash-shortcut">{item.shortcut}</span>}
        </div>
      ))}
    </div>
  )
})

MenuList.displayName = 'MenuList'

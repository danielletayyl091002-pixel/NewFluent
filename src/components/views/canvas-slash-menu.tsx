'use client'
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { ReactRenderer } from '@tiptap/react'
import tippy, { Instance } from 'tippy.js'
import { Editor, Range } from '@tiptap/core'
import { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import Fuse from 'fuse.js'

// Lightweight slash menu for canvas text boxes.
// Reduced command list — only commands that work with the minimal
// StarterKit + TaskList/TaskItem + HorizontalRule setup we use in
// CanvasRichTextBox. No callout, database, table, toggle.

interface SlashItem {
  title: string
  command: string
  attrs?: Record<string, unknown>
  icon: string
}

const commands: SlashItem[] = [
  { title: 'Text', command: 'paragraph', icon: 'T' },
  { title: 'Heading 1', command: 'heading', attrs: { level: 1 }, icon: 'H1' },
  { title: 'Heading 2', command: 'heading', attrs: { level: 2 }, icon: 'H2' },
  { title: 'Heading 3', command: 'heading', attrs: { level: 3 }, icon: 'H3' },
  { title: 'Bullet List', command: 'bulletList', icon: '\u2022' },
  { title: 'Numbered List', command: 'orderedList', icon: '1.' },
  { title: 'To-do List', command: 'taskList', icon: '\u2610' },
  { title: 'Quote', command: 'blockquote', icon: '\u201C' },
  { title: 'Code Block', command: 'codeBlock', icon: '</>' },
  { title: 'Divider', command: 'horizontalRule', icon: '\u2014' },
]

const fuse = new Fuse(commands, { keys: ['title'], threshold: 0.3 })

export const canvasSuggestion: Omit<SuggestionOptions, 'editor'> = {
  char: '/',
  command: ({ editor, range, props }: { editor: Editor; range: Range; props: { type: string; attrs?: Record<string, unknown> } }) => {
    const { type, attrs } = props
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
      default:
        editor.chain().focus().deleteRange(range).setNode('paragraph').run()
        break
    }
  },
  items: ({ query }: { query: string }) => {
    return query ? fuse.search(query).map(r => r.item) : commands
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
        return (component?.ref as { onKeyDown?: (p: SuggestionKeyDownProps) => boolean } | null)?.onKeyDown?.(props) ?? false
      },
      onExit() {
        popup?.[0]?.destroy()
        component?.destroy()
      },
    }
  },
}

const MenuList = forwardRef((props: { items: SlashItem[]; command: (args: { type: string; attrs?: Record<string, unknown> }) => void }, ref) => {
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
        </div>
      ))}
    </div>
  )
})

MenuList.displayName = 'CanvasSlashMenuList'

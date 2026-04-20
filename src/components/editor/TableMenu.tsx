'use client'
import { useState, useEffect, useCallback } from 'react'
import { Editor } from '@tiptap/react'

interface TableMenuProps {
  editor: Editor
}

interface MenuPos {
  x: number
  y: number
}

export default function TableMenu({ editor }: TableMenuProps) {
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)

  const handleContextMenu = useCallback((e: MouseEvent) => {
    if (!editor.isActive('table')) return
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
  }, [editor])

  const close = useCallback(() => setMenuPos(null), [])

  useEffect(() => {
    const dom = editor.view.dom
    dom.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('click', close)
    document.addEventListener('scroll', close, true)
    return () => {
      dom.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('click', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [editor, handleContextMenu, close])

  if (!menuPos) return null

  const items = [
    { label: 'Insert row above', action: () => editor.chain().focus().addRowBefore().run() },
    { label: 'Insert row below', action: () => editor.chain().focus().addRowAfter().run() },
    { type: 'separator' as const },
    { label: 'Insert column left', action: () => editor.chain().focus().addColumnBefore().run() },
    { label: 'Insert column right', action: () => editor.chain().focus().addColumnAfter().run() },
    { type: 'separator' as const },
    { label: 'Delete row', action: () => editor.chain().focus().deleteRow().run(), danger: true },
    { label: 'Delete column', action: () => editor.chain().focus().deleteColumn().run(), danger: true },
    { label: 'Delete table', action: () => editor.chain().focus().deleteTable().run(), danger: true },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        top: menuPos.y,
        left: menuPos.x,
        zIndex: 1000,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        padding: '4px 0',
        minWidth: '180px',
      }}
      onClick={close}
    >
      {items.map((item, i) =>
        item.type === 'separator' ? (
          <div key={i} style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
        ) : (
          <div
            key={item.label}
            onClick={() => { item.action!(); close() }}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              cursor: 'pointer',
              color: (item as any).danger ? '#EF4444' : 'var(--text-primary)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            {item.label}
          </div>
        )
      )}
    </div>
  )
}

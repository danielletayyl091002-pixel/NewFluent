'use client'
import { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'

interface FloatingToolbarProps {
  editor: Editor
}

export default function FloatingToolbar({ editor }: FloatingToolbarProps) {
  const buttons = [
    { label: 'B', command: () => editor.chain().focus().toggleBold().run(), active: () => editor.isActive('bold'), title: 'Bold' },
    { label: 'I', command: () => editor.chain().focus().toggleItalic().run(), active: () => editor.isActive('italic'), title: 'Italic' },
    { label: 'S', command: () => editor.chain().focus().toggleStrike().run(), active: () => editor.isActive('strike'), title: 'Strikethrough' },
    { label: '<>', command: () => editor.chain().focus().toggleCode().run(), active: () => editor.isActive('code'), title: 'Inline code' },
    { label: 'H1', command: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: () => editor.isActive('heading', { level: 1 }), title: 'Heading 1' },
    { label: 'H2', command: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: () => editor.isActive('heading', { level: 2 }), title: 'Heading 2' },
    { label: '\u201C', command: () => editor.chain().focus().toggleBlockquote().run(), active: () => editor.isActive('blockquote'), title: 'Quote' },
  ]

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top',
        offset: 8,
      }}
    >
      <div style={{
        display: 'flex',
        gap: '2px',
        padding: '4px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      }}>
        {buttons.map(btn => (
          <button
            key={btn.label}
            onClick={btn.command}
            title={btn.title}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              background: btn.active() ? 'var(--accent-light)' : 'transparent',
              color: btn.active() ? 'var(--accent)' : 'var(--text-secondary)',
              lineHeight: 1.2,
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </BubbleMenu>
  )
}

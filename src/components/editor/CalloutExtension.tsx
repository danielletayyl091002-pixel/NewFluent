'use client'
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { useState, useRef, useEffect } from 'react'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: () => ReturnType
      toggleCallout: () => ReturnType
    }
  }
}

const EMOJIS = ['💡','📝','⚠️','✅','❌','🔥','⭐','📌','💬','🎯','📎','🔔','💭','🚀','💪','🎉','📊','🔍','💰','⏰']

function CalloutComponent({ node, updateAttributes }: any) {
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showPicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as globalThis.Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPicker])

  return (
    <NodeViewWrapper className="callout-node" data-type="callout">
      <span
        className="callout-emoji"
        contentEditable={false}
        onClick={() => setShowPicker(!showPicker)}
        style={{ position: 'relative' }}
      >
        {node.attrs.emoji}

        {showPicker && (
          <div
            ref={pickerRef}
            contentEditable={false}
            style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 9999,
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-base, 8px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              padding: '12px', width: '240px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px',
            }}>
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    updateAttributes({ emoji })
                    setShowPicker(false)
                  }}
                  style={{
                    width: '36px', height: '36px', fontSize: '18px',
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    borderRadius: '6px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </span>
      <NodeViewContent className="callout-content" />
    </NodeViewWrapper>
  )
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: '💡',
        parseHTML: element => element.getAttribute('data-emoji') || '💡',
        renderHTML: attributes => ({ 'data-emoji': attributes.emoji }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'callout', class: 'callout-node' }),
      ['span', { class: 'callout-emoji', contenteditable: 'false' }],
      ['div', { class: 'callout-content' }, 0],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutComponent)
  },

  addCommands() {
    return {
      setCallout:
        () =>
        ({ commands }) => {
          return commands.wrapIn(this.name)
        },
      toggleCallout:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.toggleCallout(),
    }
  },
})

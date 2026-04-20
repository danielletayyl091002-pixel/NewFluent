'use client'
import { useEffect, useRef, useState } from 'react'
import { Block } from '@/db/schema'

const COMMANDS: {
  label: string
  description: string
  type: Block['type']
  icon: string
  group: string
}[] = [
  { group: 'Basic', icon: '¶', label: 'Text', description: 'Plain paragraph', type: 'text' },
  { group: 'Basic', icon: 'H1', label: 'Heading 1', description: 'Large heading', type: 'heading1' },
  { group: 'Basic', icon: 'H2', label: 'Heading 2', description: 'Medium heading', type: 'heading2' },
  { group: 'Basic', icon: 'H3', label: 'Heading 3', description: 'Small heading', type: 'heading3' },
  { group: 'Basic', icon: '"', label: 'Quote', description: 'Callout quote', type: 'quote' },
  { group: 'Basic', icon: '—', label: 'Divider', description: 'Horizontal rule', type: 'divider' },
  { group: 'Lists', icon: '•', label: 'Bullet List', description: 'Unordered list', type: 'bullet' },
  { group: 'Lists', icon: '1.', label: 'Numbered List', description: 'Ordered list', type: 'numbered' },
  { group: 'Lists', icon: '☐', label: 'To-do', description: 'Checkbox item', type: 'todo' },
  { group: 'Code', icon: '</>', label: 'Code', description: 'Code block', type: 'code' },
  { group: 'Basic', icon: '⊞', label: 'Table', description: 'Insert a table', type: 'table' },
  { group: 'Basic', icon: '!', label: 'Callout', description: 'Highlighted callout box', type: 'callout' },
]

interface Props {
  query: string
  onSelect: (type: Block['type']) => void
  onClose: () => void
  position: { top: number; left: number }
}

export default function SlashMenu({ query, onSelect, onClose, position }: Props) {
  const [selected, setSelected] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = COMMANDS.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.description.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => { setSelected(0) }, [query])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter') { e.preventDefault(); if (filtered[selected]) onSelect(filtered[selected].type) }
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [filtered, selected, onSelect, onClose])

  useEffect(() => {
    const el = ref.current?.children[selected] as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (filtered.length === 0) return null

  const groups = Array.from(new Set(filtered.map(c => c.group)))

  return (
    <div style={{
      position: 'fixed', top: position.top, left: position.left, zIndex: 1000,
      background: 'var(--bg-primary)', border: '1px solid var(--border)',
      borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      width: '260px', maxHeight: '320px', overflowY: 'auto', padding: '6px'
    }}>
      <div ref={ref}>
        {groups.map(group => (
          <div key={group}>
            <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '6px 8px 2px' }}>
              {group}
            </div>
            {filtered.filter(c => c.group === group).map(cmd => {
              const globalIndex = filtered.indexOf(cmd)
              return (
                <div key={cmd.type} onClick={() => onSelect(cmd.type)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', background: globalIndex === selected ? 'var(--accent-light)' : 'transparent' }}
                  onMouseEnter={() => setSelected(globalIndex)}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {cmd.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{cmd.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{cmd.description}</div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

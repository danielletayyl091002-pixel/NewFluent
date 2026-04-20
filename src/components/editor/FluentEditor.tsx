'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { suggestion } from './slash-menu'
import { Callout } from './CalloutExtension'
import { Table, TableCell, TableHeader } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'

const FormulaCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      formula: { default: null, parseHTML: el => el.getAttribute('data-formula'), renderHTML: attrs => attrs.formula ? { 'data-formula': attrs.formula } : {} },
    }
  },
})
const FormulaHeader = TableHeader.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: { spellcheck: 'false' },
    }
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      formula: { default: null, parseHTML: el => el.getAttribute('data-formula'), renderHTML: attrs => attrs.formula ? { 'data-formula': attrs.formula } : {} },
    }
  },
})
import FloatingToolbar from './FloatingToolbar'
import TableMenu from './TableMenu'
import TableFormulas from './TableFormulas'
import { DragHandle } from '@tiptap/extension-drag-handle'
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import DatabaseBlock from './DatabaseBlock'
import { db, Block } from '@/db/schema'

const DatabaseNodeComponent = ({ node }: any) => (
  <NodeViewWrapper>
    <DatabaseBlock databaseUid={node.attrs.uid} pageUid={node.attrs.pageUid} />
  </NodeViewWrapper>
)

const DatabaseNode = TiptapNode.create({
  name: 'database',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      uid: { default: null },
      pageUid: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="database"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'database' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(DatabaseNodeComponent)
  },
})

function ToggleView({ node, updateAttributes }: any) {
  const [open, setOpen] = useState(node.attrs.open || false)
  const [title, setTitle] = useState(node.attrs.title || '')
  const toggle = (e: React.MouseEvent) => { e.stopPropagation(); const next = !open; setOpen(next); updateAttributes({ open: next }) }
  return (
    <NodeViewWrapper>
      <div style={{
        margin: '8px 0', padding: '12px 16px',
        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-base, 10px)',
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        {/* Title row — arrow flush left, title indented */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span
            contentEditable={false}
            onClick={toggle}
            style={{
              cursor: 'pointer', userSelect: 'none', fontSize: '11px',
              color: 'var(--text-tertiary)', flexShrink: 0, width: '36px', height: '24px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: 0, paddingLeft: 0,
            }}
          >{open ? '\u25BC' : '\u25B6'}</span>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); updateAttributes({ title: e.target.value }) }}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            placeholder="Toggle title..."
            className="toggle-title-input"
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)',
              cursor: 'text', fontFamily: 'inherit', padding: '10px 16px 10px 20px',
            }}
          />
        </div>
        {/* Collapsible body — NodeViewContent MUST be here */}
        <div style={{
          display: open ? 'block' : 'none',
          paddingLeft: '28px', marginTop: '8px', paddingTop: '8px',
          borderTop: '1px solid var(--border)',
        }}>
          <NodeViewContent />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

const ToggleNode = TiptapNode.create({
  name: 'toggle',
  group: 'block',
  content: 'block+',
  addAttributes() { return { open: { default: false }, title: { default: '' } } },
  parseHTML() { return [{ tag: 'div[data-type="toggle"]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toggle' }), 0] },
  addNodeView() { return ReactNodeViewRenderer(ToggleView) },
})

const SlashCommand = Extension.create({
  name: 'slashCommand',
  addOptions() {
    return { suggestion }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})

interface FluentEditorProps {
  pageUid: string
  initialContent: Record<string, unknown> | null
}

export default function FluentEditor({ pageUid, initialContent }: FluentEditorProps) {
  const lastSavedRef = useRef<string>('')
  const hasUnsavedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const saveContent = useCallback(async (json: Record<string, unknown>) => {
    const content = JSON.stringify(json)
    if (content === lastSavedRef.current) return
    const existing = await db.blocks.where('pageUid').equals(pageUid).filter(b => b.type === 'document').first()
    if (existing?.id) {
      await db.blocks.update(existing.id, { content, updatedAt: new Date().toISOString() })
    } else {
      await db.blocks.add({
        uid: pageUid + '_doc',
        pageUid,
        type: 'document' as Block['type'],
        content,
        checked: false,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }
    lastSavedRef.current = content
    hasUnsavedRef.current = false
  }, [pageUid])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: '' } },
        horizontalRule: false,
        dropcursor: { color: '#3B82F6', width: 2 },
      }),
      HorizontalRule.configure({ HTMLAttributes: { class: 'horizontal-rule' } }),
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({
        placeholder: "Type '/' for commands...",
      }),
      SlashCommand,
      Callout,
      DatabaseNode,
      ToggleNode,
      Table.configure({ resizable: true }),
      TableRow,
      FormulaCell,
      FormulaHeader,
      DragHandle.configure({
        render() {
          const el = document.createElement('div')
          el.className = 'drag-handle'
          el.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="5" cy="2.5" r="1.3" fill="currentColor"/>
            <circle cx="9" cy="2.5" r="1.3" fill="currentColor"/>
            <circle cx="5" cy="7" r="1.3" fill="currentColor"/>
            <circle cx="9" cy="7" r="1.3" fill="currentColor"/>
            <circle cx="5" cy="11.5" r="1.3" fill="currentColor"/>
            <circle cx="9" cy="11.5" r="1.3" fill="currentColor"/>
          </svg>`
          return el
        },
      }),
    ],
    content: initialContent || { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON()
      const content = JSON.stringify(json)
      if (content === lastSavedRef.current) return
      hasUnsavedRef.current = true
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => saveContent(json), 400)
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        const { state } = view
        const { $from } = state.selection

        // Arrow keys in table: move between cells
        if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !event.shiftKey) {
          let inTable = false
          for (let d = $from.depth; d >= 0; d--) {
            if ($from.node(d).type.name === 'table') { inTable = true; break }
          }
          if (inTable) {
            if (event.key === 'ArrowDown') {
              // goToNextCell with direction simulates moving down
              const moved = editor?.commands.goToNextCell()
              if (moved) return true
            }
            if (event.key === 'ArrowUp') {
              const moved = editor?.commands.goToPreviousCell()
              if (moved) return true
            }
          }
        }

        // Enter in table: evaluate formula if cell starts with =, then move to next cell
        if (event.key === 'Enter' && !event.shiftKey) {
          let inTable = false
          for (let d = $from.depth; d >= 0; d--) {
            if ($from.node(d).type.name === 'table') { inTable = true; break }
          }
          if (inTable) {
            // Check if current cell text is a formula
            let cellDepth = -1
            for (let d = $from.depth; d >= 0; d--) {
              const n = $from.node(d)
              if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') {
                cellDepth = d
                break
              }
            }
            if (cellDepth >= 0) {
              const cellNode = $from.node(cellDepth)
              const cellText = cellNode.textContent.trim()
              if (cellText.startsWith('=')) {
                // Find the table node to read data
                let tableNode = null
                let tableRow = -1, tableCol = -1
                for (let d = $from.depth; d >= 0; d--) {
                  const n = $from.node(d)
                  if (n.type.name === 'table') tableNode = n
                  if (n.type.name === 'tableRow') tableRow = $from.index(d - 1)
                  if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') tableCol = $from.index(d - 1)
                }
                if (tableNode) {
                  // Build data array from table, skipping header row (row 0)
                  // so A1 = first data row, A2 = second data row, etc.
                  const data: number[][] = []
                  let ri = 0
                  // Adjust tableRow to be relative to data rows (skip header)
                  const dataRow = tableRow - 1
                  tableNode.forEach((row: any) => {
                    if (ri === 0) { ri++; return } // skip header row
                    const rowData: number[] = []
                    let ci = 0
                    row.forEach((cell: any) => {
                      if ((ri - 1) === dataRow && ci === tableCol) {
                        rowData.push(0) // skip self
                      } else {
                        const num = parseFloat(cell.textContent.trim().replace(/[,$%]/g, ''))
                        rowData.push(isNaN(num) ? 0 : num)
                      }
                      ci++
                    })
                    data.push(rowData)
                    ri++
                  })
                  // Evaluate
                  const f = cellText.toUpperCase()
                  let result: number | null = null
                  const single = f.slice(1).match(/^([A-Z])(\d+)$/)
                  if (single) {
                    const c = single[1].charCodeAt(0) - 65, r = +single[2] - 1
                    result = data[r]?.[c] ?? 0
                  } else {
                    const fm = f.slice(1).match(/^(SUM|AVG|AVERAGE|MIN|MAX|COUNT)\(([A-Z]\d+:[A-Z]\d+)\)$/)
                    if (fm) {
                      const rm = fm[2].match(/^([A-Z])(\d+):([A-Z])(\d+)$/)
                      if (rm) {
                        const sc = rm[1].charCodeAt(0)-65, sr = +rm[2]-1, ec = rm[3].charCodeAt(0)-65, er = +rm[4]-1
                        const vals: number[] = []
                        for (let r = sr; r <= er; r++)
                          for (let c = sc; c <= ec; c++)
                            vals.push(data[r]?.[c] ?? 0)
                        if (vals.length) {
                          switch (fm[1]) {
                            case 'SUM': result = Math.round(vals.reduce((a,b) => a+b, 0)*100)/100; break
                            case 'AVG': case 'AVERAGE': result = Math.round(vals.reduce((a,b) => a+b, 0)/vals.length*100)/100; break
                            case 'MIN': result = Math.min(...vals); break
                            case 'MAX': result = Math.max(...vals); break
                            case 'COUNT': result = vals.filter(v => v !== 0).length; break
                          }
                        }
                      }
                    }
                  }
                  if (result !== null) {
                    // Store formula and write result using editor.chain()
                    const rawFormula = cellText
                    const resultStr = String(result)
                    const pos = $from.before(cellDepth)
                    event.preventDefault()

                    editor?.chain().focus().command(({ tr, state: s }) => {
                      const cell = s.doc.nodeAt(pos)
                      if (!cell) return false
                      // Set formula attribute
                      tr.setNodeMarkup(pos, undefined, { ...cell.attrs, formula: rawFormula })
                      // Replace cell content with result text
                      const from = pos + 1
                      const to = from + cell.content.size
                      const text = s.schema.text(resultStr)
                      tr.replaceWith(from, to, text)
                      return true
                    }).goToNextCell().run()
                    return true
                  }
                }
              }
            }
            // Normal Enter: just move to next cell
            const moved = editor?.commands.goToNextCell()
            if (moved) { event.preventDefault(); return true }
          }
        }

        // Tab inside blockquote: nest deeper
        if (event.key === 'Tab' && !event.metaKey && !event.ctrlKey) {
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type.name === 'blockquote') {
              event.preventDefault()
              if (event.shiftKey) {
                editor?.commands.lift('blockquote')
              } else {
                editor?.commands.wrapIn('blockquote')
              }
              return true
            }
          }
          return false
        }
        return false
      },
      attributes: {
        style: 'outline: none;',
        'data-page-uid': pageUid,
      },
    },
  })

  // Set initial saved content reference
  useEffect(() => {
    if (initialContent) {
      lastSavedRef.current = JSON.stringify(initialContent)
    }
  }, [initialContent])


  // Cmd+S save
  useEffect(() => {
    const handleSave = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (editor) saveContent(editor.getJSON())
      }
    }
    window.addEventListener('keydown', handleSave)
    return () => window.removeEventListener('keydown', handleSave)
  }, [editor, saveContent])

  // Before unload warning
  useEffect(() => {
    const handleUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [])

  if (!editor) return null

  return (
    <div style={{ position: 'relative', overflow: 'visible' }}>
      <FloatingToolbar editor={editor} />
      <TableMenu editor={editor} />
      <EditorContent editor={editor} />
      <TableFormulas editor={editor} />
    </div>
  )
}

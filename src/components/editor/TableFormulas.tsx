'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { Node as PmNode } from '@tiptap/pm/model'

function getCellRef(row: number, col: number): string {
  return String.fromCharCode(65 + col) + (row + 1)
}

function parseRange(s: string): { sr: number; sc: number; er: number; ec: number } | null {
  const m = s.match(/^([A-Z])(\d+):([A-Z])(\d+)$/)
  if (!m) return null
  return { sc: m[1].charCodeAt(0) - 65, sr: +m[2] - 1, ec: m[3].charCodeAt(0) - 65, er: +m[4] - 1 }
}

function readTable(tableNode: PmNode): number[][] {
  const out: number[][] = []
  let ri = 0
  tableNode.forEach(row => {
    if (ri === 0) { ri++; return }
    const r: number[] = []
    row.forEach(cell => {
      const n = parseFloat(cell.textContent.trim().replace(/[,$%]/g, ''))
      r.push(isNaN(n) ? 0 : n)
    })
    out.push(r)
    ri++
  })
  return out
}

function evalFormula(
  formula: string, data: number[][], ownRow: number, ownCol: number,
): { val: number | null; err: string | null } {
  const f = formula.trim().toUpperCase()
  if (!f.startsWith('=')) return { val: null, err: 'Not a formula' }
  const single = f.slice(1).match(/^([A-Z])(\d+)$/)
  if (single) {
    const c = single[1].charCodeAt(0) - 65, r = +single[2] - 1
    if (r === ownRow && c === ownCol) return { val: null, err: '#CIRC!' }
    return { val: data[r]?.[c] ?? 0, err: null }
  }
  const fm = f.slice(1).match(/^(SUM|AVG|AVERAGE|MIN|MAX|COUNT)\((.+)\)$/)
  if (!fm) return { val: null, err: 'Unknown formula' }
  const range = parseRange(fm[2].trim())
  if (!range) return { val: null, err: 'Bad range' }
  if (ownRow >= range.sr && ownRow <= range.er && ownCol >= range.sc && ownCol <= range.ec)
    return { val: null, err: '#CIRC!' }
  const vals: number[] = []
  for (let r = range.sr; r <= range.er; r++)
    for (let c = range.sc; c <= range.ec; c++)
      vals.push(data[r]?.[c] ?? 0)
  if (!vals.length) return { val: 0, err: null }
  switch (fm[1]) {
    case 'SUM': return { val: Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100, err: null }
    case 'AVG': case 'AVERAGE': return { val: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100, err: null }
    case 'MIN': return { val: Math.min(...vals), err: null }
    case 'MAX': return { val: Math.max(...vals), err: null }
    case 'COUNT': return { val: vals.filter(v => v !== 0).length, err: null }
    default: return { val: null, err: 'Unknown fn' }
  }
}

// Recalc all formula cells in all tables
function recalcAll(editor: Editor) {
  editor.chain().focus().command(({ tr, state }) => {
    let changed = false
    state.doc.descendants((tableNode, tablePos) => {
      if (tableNode.type.name !== 'table') return true
      const data = readTable(tableNode)
      let tableRowIdx = 0
      let offset = tablePos + 1
      tableNode.forEach(row => {
        if (tableRowIdx === 0) { offset += row.nodeSize; tableRowIdx++; return }
        const dataRowIdx = tableRowIdx - 1
        let colIdx = 0
        let cellOffset = offset + 1
        row.forEach(cell => {
          const formula = cell.attrs?.formula
          if (formula && typeof formula === 'string' && formula.startsWith('=')) {
            const { val, err } = evalFormula(formula, data, dataRowIdx, colIdx)
            const displayText = err ?? String(val ?? 0)
            if (cell.textContent.trim() !== displayText) {
              const from = cellOffset + 1
              const to = from + cell.content.size
              const text = state.schema.text(displayText)
              tr.replaceWith(tr.mapping.map(from), tr.mapping.map(to), text)
              changed = true
            }
          }
          cellOffset += cell.nodeSize
          colIdx++
        })
        offset += row.nodeSize
        tableRowIdx++
      })
      return false
    })
    return changed
  }).run()
}

interface TableFormulasProps { editor: Editor }

export default function TableFormulas({ editor }: TableFormulasProps) {
  const [cellRef, setCellRef] = useState<string | null>(null)
  const [storedFormula, setStoredFormula] = useState<string | null>(null)
  const [tableRect, setTableRect] = useState<DOMRect | null>(null)
  const [isInTable, setIsInTable] = useState(false)
  const recalcScheduled = useRef(false)

  const updateCellInfo = useCallback(() => {
    const { $from } = editor.state.selection
    let found = false
    for (let d = $from.depth; d >= 0; d--) {
      if ($from.node(d).type.name === 'table') {
        found = true
        const tablePos = $from.before(d)
        const dom = editor.view.nodeDOM(tablePos) as HTMLElement | null
        if (dom) setTableRect(dom.getBoundingClientRect())
        let row = -1, col = -1, cellNode: PmNode | null = null
        for (let dd = $from.depth; dd > d; dd--) {
          const n = $from.node(dd)
          if (n.type.name === 'tableRow') row = $from.index(dd - 1)
          if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') {
            col = $from.index(dd - 1)
            cellNode = n
          }
        }
        if (row >= 0 && col >= 0) {
          const dataRow = Math.max(0, row - 1)
          setCellRef(getCellRef(dataRow, col))
          // Show stored formula if cell has one
          const formula = cellNode?.attrs?.formula
          setStoredFormula(formula || null)
        }
        break
      }
    }
    setIsInTable(found)
    if (!found) { setTableRect(null); setStoredFormula(null) }
  }, [editor])

  useEffect(() => {
    const onUpdate = () => {
      if (recalcScheduled.current) return
      recalcScheduled.current = true
      requestAnimationFrame(() => {
        recalcScheduled.current = false
        // Check if any formula cells exist before recalcing
        let hasFormulas = false
        editor.state.doc.descendants(node => {
          if ((node.type.name === 'tableCell' || node.type.name === 'tableHeader') && node.attrs?.formula) {
            hasFormulas = true
            return false
          }
        })
        if (hasFormulas) recalcAll(editor)
      })
    }
    editor.on('update', onUpdate)
    editor.on('selectionUpdate', updateCellInfo)
    return () => {
      editor.off('update', onUpdate)
      editor.off('selectionUpdate', updateCellInfo)
    }
  }, [editor, updateCellInfo])

  if (!isInTable || !tableRect) return null

  return createPortal(
    <div style={{
      position: 'fixed', top: tableRect.bottom + 4, left: tableRect.left,
      width: Math.max(tableRect.width, 300), zIndex: 50,
      display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px',
      background: 'var(--bg-primary)', border: '1px solid var(--border)',
      borderRadius: '6px', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}>
      {cellRef && (
        <span style={{
          padding: '2px 8px', background: 'var(--bg-hover)', borderRadius: '4px',
          fontWeight: 700, color: 'var(--accent)', minWidth: '32px', textAlign: 'center', fontSize: '11px',
        }}>{cellRef}</span>
      )}
      <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '13px' }}>fx</span>
      {storedFormula ? (
        <span style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600, fontSize: '12px', flex: 1 }}>
          {storedFormula}
        </span>
      ) : (
        <span style={{ flex: 1 }} />
      )}
      <div style={{ display: 'flex', gap: '2px', borderLeft: '1px solid var(--border)', paddingLeft: '8px' }}>
        {['SUM', 'AVG', 'MIN', 'MAX'].map(fn => (
          <span key={fn} style={{
            padding: '2px 6px', fontSize: '10px', fontWeight: 700,
            color: 'var(--text-tertiary)', cursor: 'default',
          }}>{fn}</span>
        ))}
      </div>
    </div>,
    document.body
  )
}

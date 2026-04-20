'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { db, DatabaseDef, DatabaseColumn, DatabaseRow, DatabaseCell } from '@/db/schema'
import { nanoid } from 'nanoid'

interface DatabaseBlockProps {
  databaseUid: string
  pageUid: string
}

type AggType = null | 'sum' | 'avg' | 'min' | 'max' | 'count' | 'earliest' | 'latest' | 'checked'

const AGG_CYCLE: Record<string, AggType[]> = {
  number: [null, 'sum', 'avg', 'min', 'max', 'count'],
  date: [null, 'earliest', 'latest', 'count'],
  text: [null, 'count'],
  checkbox: [null, 'checked', 'count'],
  select: [null, 'count'],
}

const TYPE_ICONS: Record<string, string> = {
  text: 'Aa', number: '#', date: 'D', checkbox: '\u2611', select: '\u2630',
}

const cellInputStyle: React.CSSProperties = {
  border: 'none', background: 'transparent', borderRadius: 0, boxShadow: 'none',
  padding: '6px 12px', width: '100%', outline: 'none',
  color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box',
}

export default function DatabaseBlock({ databaseUid, pageUid }: DatabaseBlockProps) {
  const [columns, setColumns] = useState<DatabaseColumn[]>([])
  const [rows, setRows] = useState<DatabaseRow[]>([])
  const [cells, setCells] = useState<DatabaseCell[]>([])
  const [dbName, setDbName] = useState('Untitled Database')
  const [search, setSearch] = useState('')
  const [editingCol, setEditingCol] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ uid: string; x: number; y: number } | null>(null)
  const [aggs, setAggs] = useState<Record<string, AggType>>({})
  const [typePickerCol, setTypePickerCol] = useState<string | null>(null)
  const [hoveredCol, setHoveredCol] = useState<string | null>(null)
  const typePickerRef = useRef<HTMLDivElement>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Close type picker on outside click
  useEffect(() => {
    if (!typePickerCol) return
    const handler = (e: MouseEvent) => {
      if (typePickerRef.current && !typePickerRef.current.contains(e.target as globalThis.Node)) {
        setTypePickerCol(null)
      }
    }
    // Delay to avoid immediate close from the same click
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [typePickerCol])

  const COLUMN_TYPES = [
    { value: 'text' as const, icon: 'Aa', label: 'Text' },
    { value: 'number' as const, icon: '#', label: 'Number' },
    { value: 'date' as const, icon: 'D', label: 'Date' },
    { value: 'checkbox' as const, icon: '\u2611', label: 'Checkbox' },
    { value: 'select' as const, icon: '\u2630', label: 'Select' },
  ]

  useEffect(() => {
    async function load() {
      const def = await db.databases.where('uid').equals(databaseUid).first()
      if (def) setDbName(def.name)
      const cols = await db.databaseColumns.where('databaseUid').equals(databaseUid).sortBy('order')
      setColumns(cols)
      const rws = await db.databaseRows.where('databaseUid').equals(databaseUid).sortBy('order')
      setRows(rws)
      if (rws.length > 0) {
        const allCells = await db.databaseCells.where('rowUid').anyOf(rws.map(r => r.uid)).toArray()
        setCells(allCells)
      }
      const stored: Record<string, AggType> = {}
      cols.forEach(c => {
        const v = localStorage.getItem(`db_agg_${databaseUid}_${c.uid}`)
        if (v) stored[c.uid] = v as AggType
      })
      setAggs(stored)
    }
    load()
  }, [databaseUid])

  const getCellValue = useCallback((rowUid: string, columnUid: string): string => {
    return cells.find(c => c.rowUid === rowUid && c.columnUid === columnUid)?.value || ''
  }, [cells])

  const setCellValue = useCallback((rowUid: string, columnUid: string, value: string) => {
    setCells(prev => {
      const existing = prev.find(c => c.rowUid === rowUid && c.columnUid === columnUid)
      if (existing) return prev.map(c => c.rowUid === rowUid && c.columnUid === columnUid ? { ...c, value } : c)
      return [...prev, { uid: nanoid(), rowUid, columnUid, value }]
    })
    const key = `${rowUid}-${columnUid}`
    clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(async () => {
      const existing = await db.databaseCells.where({ rowUid, columnUid }).first()
      if (existing?.id) await db.databaseCells.update(existing.id, { value })
      else await db.databaseCells.add({ uid: nanoid(), rowUid, columnUid, value })
    }, 300)
  }, [])

  const addColumn = useCallback(async () => {
    const col: DatabaseColumn = { uid: nanoid(), databaseUid, name: 'Column', type: 'text', order: columns.length, options: null }
    await db.databaseColumns.add(col)
    setColumns(prev => [...prev, col])
  }, [databaseUid, columns.length])

  const addRow = useCallback(async () => {
    const row: DatabaseRow = { uid: nanoid(), databaseUid, order: rows.length, createdAt: new Date().toISOString() }
    await db.databaseRows.add(row)
    setRows(prev => [...prev, row])
  }, [databaseUid, rows.length])

  const deleteRow = useCallback(async (uid: string) => {
    const row = rows.find(r => r.uid === uid)
    if (row?.id) await db.databaseRows.delete(row.id)
    await db.databaseCells.where('rowUid').equals(uid).delete()
    setRows(prev => prev.filter(r => r.uid !== uid))
    setCells(prev => prev.filter(c => c.rowUid !== uid))
  }, [rows])

  const deleteColumn = useCallback(async (uid: string) => {
    const col = columns.find(c => c.uid === uid)
    if (col?.id) await db.databaseColumns.delete(col.id)
    await db.databaseCells.where('columnUid').equals(uid).delete()
    setColumns(prev => prev.filter(c => c.uid !== uid))
    setCells(prev => prev.filter(c => c.columnUid !== uid))
    setContextMenu(null)
  }, [columns])

  const renameColumn = useCallback(async (uid: string, name: string) => {
    const col = columns.find(c => c.uid === uid)
    if (col?.id) await db.databaseColumns.update(col.id, { name })
    setColumns(prev => prev.map(c => c.uid === uid ? { ...c, name } : c))
  }, [columns])

  const changeColumnType = useCallback(async (uid: string, type: DatabaseColumn['type']) => {
    const col = columns.find(c => c.uid === uid)
    if (col?.id) await db.databaseColumns.update(col.id, { type })
    // Convert existing cell values
    const colCells = cells.filter(c => c.columnUid === uid && c.value !== '')
    for (const cell of colCells) {
      let newVal = cell.value
      if (type === 'checkbox') newVal = cell.value === 'true' ? 'true' : 'false'
      else if (type === 'number') { const n = parseFloat(cell.value); newVal = isNaN(n) ? '' : String(n) }
      else if (type === 'text') newVal = String(cell.value)
      if (newVal !== cell.value && cell.id) {
        await db.databaseCells.update(cell.id, { value: newVal })
      }
    }
    setCells(prev => prev.map(c => {
      if (c.columnUid !== uid || c.value === '') return c
      let v = c.value
      if (type === 'checkbox') v = c.value === 'true' ? 'true' : 'false'
      else if (type === 'number') { const n = parseFloat(c.value); v = isNaN(n) ? '' : String(n) }
      return { ...c, value: v }
    }))
    setColumns(prev => prev.map(c => c.uid === uid ? { ...c, type } : c))
    setContextMenu(null)
    setTypePickerCol(null)
  }, [columns, cells])

  const updateDbName = useCallback(async (name: string) => {
    setDbName(name)
    const def = await db.databases.where('uid').equals(databaseUid).first()
    if (def?.id) await db.databases.update(def.id, { name })
  }, [databaseUid])

  const cycleAggregate = useCallback((colUid: string, colType: string) => {
    const cycle = AGG_CYCLE[colType] || [null]
    const current = aggs[colUid] || null
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length]
    setAggs(prev => ({ ...prev, [colUid]: next }))
    if (next) localStorage.setItem(`db_agg_${databaseUid}_${colUid}`, next)
    else localStorage.removeItem(`db_agg_${databaseUid}_${colUid}`)
  }, [aggs, databaseUid])

  const computeAggregate = useCallback((colUid: string, colType: string, agg: AggType): string => {
    if (!agg) return ''
    const values = rows.map(r => getCellValue(r.uid, colUid)).filter(v => v !== '')
    if (values.length === 0) return '\u2014'
    if (agg === 'count') return String(values.length)
    if (colType === 'number') {
      const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n))
      if (nums.length === 0) return '\u2014'
      switch (agg) {
        case 'sum': return String(Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100)
        case 'avg': return String(Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 100) / 100)
        case 'min': return String(Math.min(...nums))
        case 'max': return String(Math.max(...nums))
        default: return ''
      }
    }
    if (colType === 'date') {
      const dates = values.filter(v => v).sort()
      if (agg === 'earliest') return dates[0] || '\u2014'
      if (agg === 'latest') return dates[dates.length - 1] || '\u2014'
    }
    if (colType === 'checkbox' && agg === 'checked') return String(values.filter(v => v === 'true').length)
    return ''
  }, [rows, getCellValue])

  const filteredRows = search
    ? rows.filter(r => columns.some(c => getCellValue(r.uid, c.uid).toLowerCase().includes(search.toLowerCase())))
    : rows

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius-card, 10px)',
      overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      background: 'var(--bg-primary)', margin: '8px 0', width: '100%',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}>
        <input value={dbName} onChange={e => setDbName(e.target.value)} onBlur={e => updateDbName(e.target.value)}
          style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', flex: 1, padding: '2px 0' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
          style={{ padding: '5px 10px', borderRadius: 'var(--radius-base, 6px)', border: '1px solid var(--border)', background: 'var(--bg-primary)', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', width: '160px' }} />
        <button onClick={addColumn} style={{ padding: '5px 12px', borderRadius: 'var(--radius-base, 6px)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>+ Column</button>
        <button onClick={() => {
          const header = columns.map(c => c.name).join(',')
          const dataRows = rows.map(r => columns.map(c => { const v = getCellValue(r.uid, c.uid); return v.includes(',') ? `"${v}"` : v }).join(','))
          const csv = [header, ...dataRows].join('\n')
          const blob = new Blob([csv], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a'); a.href = url; a.download = `${dbName}.csv`; a.click()
          URL.revokeObjectURL(url)
        }} style={{ padding: '5px 12px', borderRadius: 'var(--radius-base, 6px)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Export CSV</button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.uid}
                  onContextMenu={e => { e.preventDefault(); setContextMenu({ uid: col.uid, x: e.clientX, y: e.clientY }) }}
                  onMouseEnter={() => setHoveredCol(col.uid)}
                  onMouseLeave={() => setHoveredCol(null)}
                  style={{
                    background: hoveredCol === col.uid ? 'var(--bg-hover)' : 'var(--bg-secondary)',
                    borderBottom: '2px solid var(--border)',
                    borderRight: '1px solid var(--border)', padding: '8px 12px',
                    fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)',
                    textAlign: 'left', minWidth: '120px', textTransform: 'uppercase', letterSpacing: '0.06em',
                    position: 'relative',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      onClick={e => { e.stopPropagation(); setTypePickerCol(prev => prev === col.uid ? null : col.uid) }}
                      style={{
                        fontSize: '11px', color: typePickerCol === col.uid ? 'var(--accent)' : 'var(--text-tertiary)',
                        cursor: 'pointer', padding: '2px 4px', borderRadius: '4px',
                        background: typePickerCol === col.uid ? 'var(--accent-light)' : 'transparent',
                      }}
                    >{COLUMN_TYPES.find(t => t.value === col.type)?.icon || 'Aa'}</span>
                    {editingCol === col.uid ? (
                      <input autoFocus defaultValue={col.name}
                        onBlur={e => { renameColumn(col.uid, e.target.value); setEditingCol(null) }}
                        onKeyDown={e => { if (e.key === 'Enter') { renameColumn(col.uid, (e.target as HTMLInputElement).value); setEditingCol(null) } }}
                        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', width: '100%', textTransform: 'uppercase', letterSpacing: '0.06em' }} />
                    ) : (
                      <span onClick={() => setEditingCol(col.uid)} style={{ cursor: 'text', flex: 1 }}>{col.name}</span>
                    )}
                    {hoveredCol === col.uid && columns.length > 1 && (
                      <button onClick={e => { e.stopPropagation(); if (confirm(`Delete column "${col.name}"?`)) deleteColumn(col.uid) }}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '12px', padding: '2px 4px', borderRadius: '4px', lineHeight: 1 }}
                        onMouseEnter={e => { (e.currentTarget).style.color = '#EF4444' }}
                        onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-tertiary)' }}
                      >&times;</button>
                    )}
                  </div>
                  {/* Type picker dropdown */}
                  {typePickerCol === col.uid && (
                    <div ref={typePickerRef} onClick={e => e.stopPropagation()} style={{
                      position: 'absolute', top: '100%', left: 0, zIndex: 1000,
                      background: 'var(--bg-primary)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-base, 8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      minWidth: '140px', overflow: 'hidden', marginTop: '2px',
                    }}>
                      {COLUMN_TYPES.map(t => (
                        <div key={t.value} onClick={() => changeColumnType(col.uid, t.value)}
                          style={{
                            padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px',
                            cursor: 'pointer', fontSize: '13px', textTransform: 'none', letterSpacing: 'normal',
                            background: col.type === t.value ? 'var(--accent-light)' : 'transparent',
                            color: col.type === t.value ? 'var(--accent)' : 'var(--text-primary)',
                          }}
                          onMouseEnter={e => { if (col.type !== t.value) (e.currentTarget).style.background = 'var(--bg-hover)' }}
                          onMouseLeave={e => { if (col.type !== t.value) (e.currentTarget).style.background = 'transparent' }}
                        >
                          <span style={{ fontSize: '11px', fontWeight: 700, color: col.type === t.value ? 'var(--accent)' : 'var(--text-tertiary)', width: '16px' }}>{t.icon}</span>
                          {t.label}
                          {col.type === t.value && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: '11px' }}>{'\u2713'}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </th>
              ))}
              <th style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)', width: '32px', minWidth: '32px' }} />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => (
              <tr key={row.uid} className="db-row" style={{ minHeight: '36px', position: 'relative' }}
                onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bg-hover)'; const btn = e.currentTarget.querySelector('.db-row-del') as HTMLElement; if (btn) btn.style.opacity = '1' }}
                onMouseLeave={e => { (e.currentTarget).style.background = 'transparent'; const btn = e.currentTarget.querySelector('.db-row-del') as HTMLElement; if (btn) btn.style.opacity = '0' }}>
                {columns.map(col => (
                  <td key={col.uid} style={{ borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: 0, minWidth: '120px' }}>
                    {col.type === 'checkbox' ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 12px' }}>
                        <input type="checkbox" checked={getCellValue(row.uid, col.uid) === 'true'}
                          onChange={e => setCellValue(row.uid, col.uid, e.target.checked ? 'true' : 'false')}
                          style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: '15px', height: '15px' }} />
                      </div>
                    ) : col.type === 'select' ? (
                      <select value={getCellValue(row.uid, col.uid)} onChange={e => setCellValue(row.uid, col.uid, e.target.value)}
                        style={{ ...cellInputStyle, cursor: 'pointer' }}>
                        <option value="">\u2014</option>
                        {(col.options ? JSON.parse(col.options) : []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                        value={getCellValue(row.uid, col.uid)} onChange={e => setCellValue(row.uid, col.uid, e.target.value)}
                        style={{ ...cellInputStyle, textAlign: col.type === 'number' ? 'right' as const : 'left' as const }} />
                    )}
                  </td>
                ))}
                <td style={{ borderBottom: '1px solid var(--border)', padding: 0, textAlign: 'center', position: 'relative' }}>
                  <button className="db-row-del" onClick={() => { if (confirm('Delete this row?')) deleteRow(row.uid) }}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '12px', padding: '4px', opacity: 0, transition: 'opacity 0.1s' }}
                    onMouseEnter={e => { (e.currentTarget).style.color = '#EF4444' }}
                    onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-tertiary)' }}>&times;</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              {columns.map(col => {
                const agg = aggs[col.uid] || null
                const val = computeAggregate(col.uid, col.type, agg)
                return (
                  <td key={col.uid} onClick={() => cycleAggregate(col.uid, col.type)} title="Click to cycle aggregate"
                    style={{
                      background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', borderTop: '2px solid var(--border)',
                      padding: '6px 12px', fontSize: '11px', cursor: 'pointer', userSelect: 'none',
                      color: agg ? 'var(--accent)' : 'var(--text-tertiary)', fontWeight: agg ? 600 : 400,
                    }}>
                    {agg ? <span><span style={{ textTransform: 'uppercase', fontSize: '9px', opacity: 0.7 }}>{agg} </span>{val}</span>
                         : <span style={{ opacity: 0.4 }}>Calculate</span>}
                  </td>
                )
              })}
              <td style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* + New row */}
      <button onClick={addRow} style={{
        width: '100%', padding: '8px 16px', background: 'transparent', border: 'none',
        borderTop: '1px solid var(--border)', color: 'var(--text-tertiary)', fontSize: '12px',
        cursor: 'pointer', textAlign: 'left',
      }}
      onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bg-hover)'; (e.currentTarget).style.color = 'var(--accent)' }}
      onMouseLeave={e => { (e.currentTarget).style.background = 'transparent'; (e.currentTarget).style.color = 'var(--text-tertiary)' }}
      >+ New row</button>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div onClick={() => setContextMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
          <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 1000, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-base, 8px)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: '4px 0', minWidth: '160px' }}>
            <div onClick={() => { setEditingCol(contextMenu.uid); setContextMenu(null) }} style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }} onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bg-hover)' }} onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}>Rename</div>
            <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
            <div style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Change type</div>
            {(['text', 'number', 'date', 'checkbox', 'select'] as const).map(t => (
              <div key={t} onClick={() => changeColumnType(contextMenu.uid, t)} style={{ padding: '6px 12px 6px 20px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'center' }} onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bg-hover)' }} onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}>
                <span style={{ fontSize: '10px', opacity: 0.6, width: '16px' }}>{TYPE_ICONS[t]}</span>
                <span style={{ textTransform: 'capitalize' }}>{t}</span>
              </div>
            ))}
            <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
            {(() => {
              const idx = columns.findIndex(c => c.uid === contextMenu.uid)
              return <>
                {idx > 0 && <div onClick={async () => { const prev = columns[idx-1], curr = columns[idx]; if (prev.id) await db.databaseColumns.update(prev.id, { order: idx }); if (curr.id) await db.databaseColumns.update(curr.id, { order: idx-1 }); setColumns(p => { const n = [...p]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n }); setContextMenu(null) }} style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }} onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bg-hover)' }} onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}>Move left</div>}
                {idx < columns.length-1 && <div onClick={async () => { const next = columns[idx+1], curr = columns[idx]; if (next.id) await db.databaseColumns.update(next.id, { order: idx }); if (curr.id) await db.databaseColumns.update(curr.id, { order: idx+1 }); setColumns(p => { const n = [...p]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n }); setContextMenu(null) }} style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }} onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bg-hover)' }} onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}>Move right</div>}
              </>
            })()}
            <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
            <div onClick={() => deleteColumn(contextMenu.uid)} style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', color: '#EF4444' }} onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bg-hover)' }} onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}>Delete column</div>
          </div>
        </>
      )}
    </div>
  )
}

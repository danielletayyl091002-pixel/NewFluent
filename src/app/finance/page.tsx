'use client'
import { useEffect, useState, useMemo } from 'react'
import { db, FinanceEntry, FinanceCategory } from '@/db/schema'
import { safeDbWrite } from '@/lib/dbError'
import MonthDetail from '@/components/finance/MonthDetail'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec']


export default function FinancePage() {
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [currency, setCurrency] = useState('$')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addType, setAddType] = useState<'income' | 'expense'>('expense')
  const [showCatManager, setShowCatManager] = useState(false)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()])
  const [showYearMenu, setShowYearMenu] = useState(false)

  useEffect(() => {
    const now = new Date()
    setCurrentYear(now.getFullYear())
    setCurrentMonth(now.getMonth())

    async function load() {
      const e = await db.financeEntries.toArray()
      const c = await db.financeCategories.toArray()
      const s = await db.settings
        .where('key').equals('currency').first()
      setEntries(e)
      // Compute available years
      const yrs = [...new Set(e.map(en => new Date(en.date).getFullYear()))]
      const thisYr = new Date().getFullYear()
      if (!yrs.includes(thisYr)) yrs.push(thisYr)
      yrs.sort((a, b) => b - a)
      setAvailableYears(yrs)
      if (c.length === 0) {
        const defaults: FinanceCategory[] = [
          { name: 'Salary', color: '#10B981', type: 'income', isDefault: true },
          { name: 'Freelance', color: '#3B82F6', type: 'income', isDefault: true },
          { name: 'Investment', color: '#8B5CF6', type: 'income', isDefault: true },
          { name: 'Dining Out', color: '#60A5FA', type: 'expense', isDefault: true },
          { name: 'Groceries', color: '#34D399', type: 'expense', isDefault: true },
          { name: 'Transport', color: '#FBBF24', type: 'expense', isDefault: true },
          { name: 'Utilities', color: '#F87171', type: 'expense', isDefault: true },
          { name: 'Healthcare', color: '#FB923C', type: 'expense', isDefault: true },
          { name: 'Entertainment', color: '#E879F9', type: 'expense', isDefault: true },
          { name: 'Retail', color: '#94A3B8', type: 'expense', isDefault: true },
        ]
        await safeDbWrite(
          () => db.financeCategories.bulkAdd(defaults),
          'Failed to save category. Please try again.'
        )
        const withIds = await db.financeCategories.toArray()
        setCategories(withIds)
      } else {
        setCategories(c)
      }
      setCurrency(s?.value || '$')
    }
    load()
  }, [])

  // Close year menu on outside click
  useEffect(() => {
    if (!showYearMenu) return
    const handler = () => setShowYearMenu(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showYearMenu])

  const monthlyData = useMemo(() => {
    return MONTHS.map((month, i) => {
      const monthEntries = entries.filter(e => {
        const d = new Date(e.date)
        return d.getFullYear() === currentYear &&
               d.getMonth() === i
      })
      const income = monthEntries
        .filter(e => e.type === 'income')
        .reduce((sum, e) => sum + e.amount, 0)
      const expenses = monthEntries
        .filter(e => e.type === 'expense')
        .reduce((sum, e) => sum + e.amount, 0)
      return { month, income, expenses, net: income - expenses }
    })
  }, [entries, currentYear])

  const incomeEntries = entries.filter(e => e.type === 'income')
    .sort((a, b) => b.date.localeCompare(a.date))
  const expenseEntries = entries.filter(e => e.type === 'expense')
    .sort((a, b) => b.date.localeCompare(a.date))

  const totalIncome = incomeEntries.reduce((s, e) => s + e.amount, 0)
  const totalExpenses = expenseEntries.reduce((s, e) => s + e.amount, 0)

  return (
    <div style={{
      height: '100vh', overflowY: 'auto',
      background: 'var(--bg-secondary)',
      backgroundImage: 'var(--bg_finance, none)',
      backgroundSize: 'cover', backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      padding: '32px 40px'
    }}>

      {/* HEADER */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700,
            color: 'var(--text-primary)', margin: 0 }}>
            Finance
          </h1>
          <div data-flat style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 0' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={e => { e.stopPropagation(); setShowYearMenu(p => !p) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-base, 8px)', padding: '6px 12px',
                  fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer',
                }}
              >
                {currentYear} Overview
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {showYearMenu && (
                <div onClick={e => e.stopPropagation()} style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 1000,
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-base, 8px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  minWidth: '180px', overflow: 'hidden',
                }}>
                  {availableYears.map(y => (
                    <div key={y} onClick={() => { setCurrentYear(y); setShowYearMenu(false) }}
                      style={{
                        padding: '8px 14px', cursor: 'pointer', fontSize: '13px',
                        background: y === currentYear ? 'var(--accent-light)' : 'transparent',
                        color: y === currentYear ? 'var(--accent)' : 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                      onMouseEnter={e => { if (y !== currentYear) (e.currentTarget).style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { if (y !== currentYear) (e.currentTarget).style.background = 'transparent' }}
                    >
                      {y}
                      {y === currentYear && <span style={{ fontSize: '10px', color: 'var(--accent)' }}>{'\u2713'}</span>}
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border)', padding: '4px' }}>
                    {!availableYears.includes(new Date().getFullYear() + 1) && (
                      <div onClick={() => { const n = new Date().getFullYear() + 1; setAvailableYears(p => [...p, n].sort((a, b) => b - a)); setCurrentYear(n); setShowYearMenu(false) }}
                        style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '12px', color: 'var(--accent)' }}
                        onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}
                      >+ Add {new Date().getFullYear() + 1}</div>
                    )}
                    <div onClick={() => { const y = parseInt(prompt('Enter year:') || ''); if (!isNaN(y) && y > 2000 && y < 2100) { setAvailableYears(p => [...new Set([...p, y])].sort((a, b) => b - a)); setCurrentYear(y) } setShowYearMenu(false) }}
                      style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-tertiary)' }}
                      onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}
                    >+ Custom year</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div data-flat style={{ display: 'flex', gap: '8px' }}>
          <select
            value={currency}
            onChange={async e => {
              const val = e.target.value
              setCurrency(val)
              const existing = await db.settings
                .where('key').equals('currency').first()
              if (existing?.id) {
                await safeDbWrite(
                  () => db.settings.update(existing.id!, { value: val }),
                  'Failed to save setting. Please try again.'
                )
              } else {
                await safeDbWrite(
                  () => db.settings.add({ key: 'currency', value: val }),
                  'Failed to save setting. Please try again.'
                )
              }
            }}
            style={{
              padding: '6px 12px', borderRadius: 'var(--radius-base, 8px)',
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px', cursor: 'pointer'
            }}
          >
            {['$', 'S$', '\u00A3', '\u20AC', 'RM', '\u0E3F', '\u00A5'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={() => setShowCatManager(true)}
            style={{
              padding: '6px 16px', borderRadius: 'var(--radius-base, 8px)',
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              fontSize: '13px', cursor: 'pointer'
            }}>
            Manage Categories
          </button>
          <button onClick={() => { setAddType('income'); setShowAddModal(true) }}
            style={{
              padding: '6px 16px', borderRadius: 'var(--radius-base, 8px)',
              background: '#10B981', color: 'white',
              border: 'none', fontSize: '13px',
              fontWeight: 600, cursor: 'pointer'
            }}>
            + Income
          </button>
          <button onClick={() => { setAddType('expense'); setShowAddModal(true) }}
            style={{
              padding: '6px 16px', borderRadius: 'var(--radius-base, 8px)',
              background: '#EF4444', color: 'white',
              border: 'none', fontSize: '13px',
              fontWeight: 600, cursor: 'pointer'
            }}>
            + Expense
          </button>
        </div>
      </div>

      {/* MONTHLY SUMMARY GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        marginBottom: '32px'
      }}>
        {monthlyData.map((m, i) => {
          const isCurrentMonth = i === currentMonth
          return (
            <div key={m.month}
              onClick={() => setSelectedMonth(selectedMonth === i ? null : i)}
              style={{
              background: selectedMonth === i ? 'var(--accent-light)' : 'var(--bg-primary)',
              borderRadius: 'var(--radius-card, 12px)',
              padding: '16px',
              border: selectedMonth === i
                ? '2px solid var(--accent)'
                : isCurrentMonth
                  ? '2px solid var(--accent)'
                  : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '8px'
              }}>
                <span style={{ fontSize: '13px', fontWeight: 600,
                  color: 'var(--text-primary)' }}>{m.month}</span>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: m.net > 0 ? '#10B981'
                    : m.net < 0 ? '#EF4444' : '#6B7280'
                }} />
              </div>
              <div style={{ fontSize: '11px',
                color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                &uarr; {currency}{m.income.toFixed(2)}
              </div>
              <div style={{ fontSize: '11px',
                color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                &darr; {currency}{m.expenses.toFixed(2)}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700,
                color: m.net >= 0 ? '#10B981' : '#EF4444' }}>
                = {currency}{m.net.toFixed(2)}
              </div>
            </div>
          )
        })}
      </div>

      {/* MONTHLY DETAIL PANEL */}
      {selectedMonth !== null && (
        <MonthDetail
          selectedMonth={selectedMonth}
          monthlyData={monthlyData}
          entries={entries}
          categories={categories}
          currency={currency}
          monthNames={MONTHS}
          currentYear={currentYear}
          onClose={() => setSelectedMonth(null)}
        />
      )}

      {/* TWO COLUMN TABLES */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px'
      }}>
        <FinanceTable
          title="Income"
          entries={incomeEntries}
          categories={categories}
          total={totalIncome}
          currency={currency}
          type="income"
          onAdd={() => { setAddType('income'); setShowAddModal(true) }}
          onDelete={async (id) => {
            await safeDbWrite(
              () => db.financeEntries.delete(id),
              'Failed to delete entry. Please try again.'
            )
            setEntries(prev => prev.filter(e => e.id !== id))
          }}
          onEdit={(id, note, amount, category) => {
            setEntries(prev => prev.map(e =>
              e.id === id ? { ...e, note, amount, category } : e
            ))
          }}
        />
        <FinanceTable
          title="Expenses"
          entries={expenseEntries}
          categories={categories}
          total={totalExpenses}
          currency={currency}
          type="expense"
          onAdd={() => { setAddType('expense'); setShowAddModal(true) }}
          onDelete={async (id) => {
            await safeDbWrite(
              () => db.financeEntries.delete(id),
              'Failed to delete entry. Please try again.'
            )
            setEntries(prev => prev.filter(e => e.id !== id))
          }}
          onEdit={(id, note, amount, category) => {
            setEntries(prev => prev.map(e =>
              e.id === id ? { ...e, note, amount, category } : e
            ))
          }}
        />
      </div>

      {/* ADD MODAL */}
      {showAddModal && (
        <AddEntryModal
          type={addType}
          categories={categories}
          currency={currency}
          onClose={() => setShowAddModal(false)}
          onSave={async (entry) => {
            const full = { ...entry, createdAt: new Date().toISOString() }
            const id = await safeDbWrite(
              () => db.financeEntries.add(full),
              'Failed to save entry. Please try again.'
            )
            // Leave the modal open on failure so the user can retry.
            if (id == null) return
            setEntries(prev => [...prev, { ...full, id: id as number }])
            setShowAddModal(false)
          }}
        />
      )}

      {showCatManager && (
        <CategoryManager
          categories={categories}
          onClose={() => setShowCatManager(false)}
          onUpdate={(updated) => setCategories(updated)}
        />
      )}
    </div>
  )
}

function FinanceTable({ title, entries, categories, total, currency, type, onAdd, onDelete, onEdit }: {
  title: string
  entries: FinanceEntry[]
  categories: FinanceCategory[]
  total: number
  currency: string
  type: 'income' | 'expense'
  onAdd: () => void
  onDelete: (id: number) => void
  onEdit: (id: number, note: string, amount: number, category: string) => void
}) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ note: '', amount: '', category: '' })
  const [focusedField, setFocusedField] = useState<'source' | 'amount' | 'category' | null>(null)

  const getCat = (catName: string) =>
    categories.find(c => c.name === catName)

  return (
    <div style={{
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius-card, 12px)',
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)'
      }}>
        <span style={{ fontWeight: 600, fontSize: '14px',
          color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ fontSize: '12px',
          color: 'var(--text-tertiary)' }}>
          Total: {currency}{total.toFixed(2)}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(80px, 2fr) 1fr 1.5fr 1fr 30px',
        padding: '8px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-hover)',
        gap: '8px',
        alignItems: 'center',
      }}>
        {['Source', 'Amount', 'Category', 'Date', ''].map(h => (
          <span key={h || 'empty'} style={{ fontSize: '10px',
            fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-tertiary)' }}>
            {h}
          </span>
        ))}
      </div>

      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {entries.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center',
            color: 'var(--text-tertiary)', fontSize: '13px' }}>
            No {title.toLowerCase()} recorded yet
          </div>
        ) : entries.map(entry => {
          const cat = getCat(entry.category)
          const isEditing = editingId === entry.id
          return (
            <div key={entry.id} style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(80px, 2fr) 1fr 1.5fr 1fr 30px',
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center',
              cursor: isEditing ? 'default' : 'pointer',
              gap: '8px',
              // Force transparent while editing — overrides any background
              // set by the onMouseEnter DOM mutation before edit kicked in,
              // which otherwise left a stuck dark bar on the edit row.
              background: isEditing ? 'transparent' : undefined,
            }}
            onClick={() => {
              if (isEditing) return
              setEditingId(entry.id ?? null)
              setEditForm({ note: entry.note, amount: entry.amount.toString(), category: entry.category || '' })
            }}
            onMouseEnter={e => {
              if (isEditing) return
              (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'
            }}
            onMouseLeave={e => {
              if (isEditing) return
              (e.currentTarget as HTMLDivElement).style.background = 'transparent'
            }}
            >
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.note}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                  onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
                  onFocus={() => setFocusedField('source')}
                  onBlur={() => setFocusedField(null)}
                  autoFocus
                  placeholder="Source..."
                  className="finance-edit-input"
                  style={{
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    boxShadow: focusedField === 'source'
                      ? 'inset 0 0 0 2px var(--accent)'
                      : 'none',
                  }}
                />
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  {entry.note}
                </span>
              )}
              {isEditing ? (
                <input
                  type="number"
                  value={editForm.amount}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                  onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                  onFocus={() => setFocusedField('amount')}
                  onBlur={() => setFocusedField(null)}
                  className="finance-edit-input"
                  style={{
                    color: type === 'income' ? '#10B981' : '#EF4444',
                    fontSize: '13px',
                    boxShadow: focusedField === 'amount'
                      ? 'inset 0 0 0 2px var(--accent)'
                      : 'none',
                  }}
                />
              ) : (
                <span style={{ fontSize: '13px', fontWeight: 600,
                  color: type === 'income' ? '#10B981' : '#EF4444' }}>
                  {currency}{entry.amount.toFixed(2)}
                </span>
              )}
              {isEditing ? (() => {
                const editCat = categories.find(c => c.name === editForm.category)
                return (
                  <select
                    value={editForm.category}
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                    onFocus={() => setFocusedField('category')}
                    onBlur={() => setFocusedField(null)}
                    className="finance-edit-input"
                    style={{
                      width: '100%',
                      borderColor: editCat?.color || 'var(--border)',
                      background: editCat ? editCat.color + '15' : 'var(--bg-secondary)',
                      color: editCat?.color || 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      boxShadow: focusedField === 'category'
                        ? 'inset 0 0 0 2px var(--accent)'
                        : 'none',
                    }}
                  >
                    <option value="">No category</option>
                    {categories
                      .filter(c => c.type === type || c.type === 'both')
                      .map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                  </select>
                )
              })() : cat ? (
                <span title={cat.name} style={{
                  display: 'inline-block',
                  padding: '2px 8px', borderRadius: 'var(--radius-card, 12px)',
                  fontSize: '11px', fontWeight: 500,
                  background: cat.color + '25',
                  color: cat.color,
                  border: `1px solid ${cat.color}40`,
                  maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {cat.name}
                </span>
              ) : (
                <span style={{ fontSize: '11px',
                  color: 'var(--text-tertiary)' }}>
                  {entry.category}
                </span>
              )}
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center', flexShrink: 0 }}
                  onClick={e => e.stopPropagation()}>
                  <button data-no-sculpt onClick={async () => {
                    if (!entry.id) return
                    const newAmount = parseFloat(editForm.amount)
                    await safeDbWrite(
                      () => db.financeEntries.update(entry.id!, {
                        note: editForm.note,
                        amount: newAmount,
                        category: editForm.category
                      }),
                      'Failed to update entry. Please try again.'
                    )
                    onEdit(entry.id, editForm.note, newAmount, editForm.category)
                    setEditingId(null)
                  }} style={{
                    background: '#10B981', color: 'white',
                    border: 'none', borderRadius: '6px',
                    fontSize: '11px', padding: '4px 10px',
                    cursor: 'pointer', fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>Save</button>
                  <button data-no-sculpt onClick={() => setEditingId(null)} style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-secondary)',
                    border: 'none', borderRadius: '6px',
                    fontSize: '11px', padding: '4px 10px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}>Cancel</button>
                </div>
              ) : (
                <span style={{ fontSize: '11px',
                  color: 'var(--text-tertiary)' }}>
                  {new Date(entry.date).toLocaleDateString('en-US',
                    { month: 'short', day: 'numeric' })}
                </span>
              )}
              <button
                onClick={e => {
                  e.stopPropagation()
                  if (entry.id && confirm('Delete this entry?')) {
                    // If the deleted row is currently being edited,
                    // clear local editingId so no stale edit UI lingers.
                    if (editingId === entry.id) setEditingId(null)
                    onDelete(entry.id)
                  }
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', fontSize: '14px', padding: '2px',
                  opacity: 0.4, transition: 'opacity 0.1s, color 0.1s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => { (e.currentTarget).style.opacity = '1'; (e.currentTarget).style.color = '#EF4444' }}
                onMouseLeave={e => { (e.currentTarget).style.opacity = '0.4'; (e.currentTarget).style.color = 'var(--text-tertiary)' }}
              >&times;</button>
            </div>
          )
        })}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px', borderTop: '1px solid var(--border)', marginTop: '8px',
        gap: '8px',
      }}>
        <button onClick={onAdd} style={{
          background: 'transparent',
          border: 'none', color: 'var(--accent)',
          fontSize: '13px', cursor: 'pointer',
          fontWeight: 600
        }}>
          + Add entry
        </button>
        <span style={{ fontSize: '13px', fontWeight: 700,
          color: 'var(--text-primary)',
          padding: '12px 20px', borderTop: '2px solid var(--border)' }}>
          SUM: {currency}{total.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

function AddEntryModal({ type, categories, currency, onClose, onSave }: {
  type: 'income' | 'expense'
  categories: FinanceCategory[]
  currency: string
  onClose: () => void
  onSave: (entry: Omit<FinanceEntry, 'id' | 'createdAt'>) => void
}) {
  const [form, setForm] = useState({
    type,
    note: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0]
  })

  const filteredCats = categories.filter(c =>
    c.type === type || c.type === 'both'
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '16px',
        padding: '24px',
        width: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px',
          fontSize: '16px', fontWeight: 700,
          color: 'var(--text-primary)' }}>
          Add {type === 'income' ? 'Income' : 'Expense'}
        </h3>

        <div style={{ display: 'flex', gap: '8px',
          marginBottom: '16px' }}>
          {(['income', 'expense'] as const).map(t => (
            <button key={t}
              onClick={() => setForm(f => ({ ...f, type: t }))}
              style={{
                flex: 1, padding: '8px',
                borderRadius: 'var(--radius-base, 8px)', border: 'none',
                background: form.type === t
                  ? t === 'income' ? '#10B981' : '#EF4444'
                  : 'var(--bg-hover)',
                color: form.type === t ? 'white'
                  : 'var(--text-secondary)',
                fontWeight: 600, fontSize: '13px',
                cursor: 'pointer', textTransform: 'capitalize'
              }}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600,
            color: 'var(--text-tertiary)', display: 'block',
            marginBottom: '4px', textTransform: 'uppercase' }}>
            Description
          </label>
          <input
            type="text"
            placeholder="e.g. Salary, Coffee..."
            value={form.note}
            onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
            style={{
              width: '100%', padding: '8px 12px',
              borderRadius: 'var(--radius-base, 8px)',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '13px', boxSizing: 'border-box'
            }}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600,
            color: 'var(--text-tertiary)', display: 'block',
            marginBottom: '4px', textTransform: 'uppercase' }}>
            Amount
          </label>
          <div style={{ display: 'flex', alignItems: 'center',
            gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)',
              fontSize: '14px' }}>{currency}</span>
            <input type="number" min="0" step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              style={{
                flex: 1, padding: '8px 12px',
                borderRadius: 'var(--radius-base, 8px)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '13px'
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600,
            color: 'var(--text-tertiary)', display: 'block',
            marginBottom: '4px', textTransform: 'uppercase' }}>
            Category
          </label>
          <select
            value={form.category}
            onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            style={{
              width: '100%', padding: '8px 12px',
              borderRadius: 'var(--radius-base, 8px)',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '13px'
            }}
          >
            <option value="">Select category</option>
            {filteredCats.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600,
            color: 'var(--text-tertiary)', display: 'block',
            marginBottom: '4px', textTransform: 'uppercase' }}>
            Date
          </label>
          <input type="date"
            value={form.date}
            onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
            style={{
              width: '100%', padding: '8px 12px',
              borderRadius: 'var(--radius-base, 8px)',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '13px', boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px',
          justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-base, 8px)',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '13px', cursor: 'pointer'
          }}>Cancel</button>
          <button onClick={() => {
            if (!form.note || !form.amount) return
            onSave({
              type: form.type as 'income' | 'expense',
              note: form.note,
              amount: parseFloat(form.amount),
              category: form.category,
              date: form.date
            })
          }} style={{
            padding: '8px 20px', borderRadius: 'var(--radius-base, 8px)',
            border: 'none',
            background: 'var(--accent)',
            color: 'white', fontSize: '13px',
            fontWeight: 600, cursor: 'pointer'
          }}>Save Entry</button>
        </div>
      </div>
    </div>
  )
}

function CategoryManager({
  categories,
  onClose,
  onUpdate
}: {
  categories: FinanceCategory[]
  onClose: () => void
  onUpdate: (cats: FinanceCategory[]) => void
}) {
  const [cats, setCats] = useState(categories)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#3B82F6')
  const [newType, setNewType] = useState<'income' | 'expense' | 'both'>('expense')
  const [editingColorId, setEditingColorId] = useState<number | null>(null)
  const [editingNameId, setEditingNameId] = useState<number | null>(null)
  const [editNameValue, setEditNameValue] = useState('')

  const PRESET_COLORS = [
    '#EF4444', '#F97316', '#EAB308', '#22C55E',
    '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6',
    '#EC4899', '#6B7280', '#1E293B', '#14B8A6'
  ]

  async function addCategory() {
    if (!newName.trim()) return
    const newCat: FinanceCategory = {
      name: newName.trim(),
      color: newColor,
      type: newType,
      isDefault: false
    }
    const id = await safeDbWrite(
      () => db.financeCategories.add(newCat),
      'Failed to save category. Please try again.'
    )
    if (id == null) return
    const updated = [...cats, { ...newCat, id: id as number }]
    setCats(updated)
    onUpdate(updated)
    setNewName('')
  }

  async function deleteCategory(id: number) {
    await safeDbWrite(
      () => db.financeCategories.delete(id),
      'Failed to delete category. Please try again.'
    )
    const updated = cats.filter(c => c.id !== id)
    setCats(updated)
    onUpdate(updated)
  }

  async function updateCategory(id: number, changes: Partial<FinanceCategory>) {
    await safeDbWrite(
      () => db.financeCategories.update(id, changes),
      'Failed to update category. Please try again.'
    )
    const updated = cats.map(c =>
      c.id === id ? { ...c, ...changes } : c
    )
    setCats(updated)
    onUpdate(updated)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '16px',
        padding: '24px',
        width: '480px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700,
            color: 'var(--text-primary)' }}>
            Manage Categories
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            color: 'var(--text-tertiary)', cursor: 'pointer',
            fontSize: '18px'
          }}>x</button>
        </div>

        {/* Existing categories */}
        <div style={{ marginBottom: '24px' }}>
          {cats.map(cat => (
            <div key={cat.id ?? cat.name} style={{
              display: 'flex', alignItems: 'center',
              gap: '10px', padding: '8px 0',
              borderBottom: '1px solid var(--border)'
            }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: '20px', height: '20px',
                  borderRadius: '50%',
                  background: cat.color,
                  cursor: 'pointer',
                  flexShrink: 0
                }} onClick={() => setEditingColorId(
                  editingColorId === cat.id ? null : cat.id ?? null
                )} />
                {editingColorId === cat.id && (
                  <div style={{
                    position: 'absolute', top: '24px', left: 0,
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-base, 8px)', padding: '8px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: '4px', zIndex: 10,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
                  }}>
                    {PRESET_COLORS.map(color => (
                      <div key={color} style={{
                        width: '20px', height: '20px',
                        borderRadius: '50%',
                        background: color,
                        cursor: 'pointer',
                        border: cat.color === color
                          ? '2px solid var(--text-primary)'
                          : '2px solid transparent'
                      }} onClick={() => {
                        if (cat.id) updateCategory(cat.id, { color })
                        setEditingColorId(null)
                      }} />
                    ))}
                  </div>
                )}
              </div>

              {editingNameId === cat.id ? (
                <input
                  className="inline-input"
                  value={editNameValue}
                  onChange={e => setEditNameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && editNameValue.trim() && cat.id) {
                      updateCategory(cat.id, { name: editNameValue.trim() })
                      setEditingNameId(null)
                    }
                    if (e.key === 'Escape') setEditingNameId(null)
                  }}
                  onBlur={() => {
                    if (editNameValue.trim() && cat.id) {
                      updateCategory(cat.id, { name: editNameValue.trim() })
                    }
                    setEditingNameId(null)
                  }}
                  autoFocus
                  style={{
                    flex: 1, fontSize: '13px', color: 'var(--text-primary)',
                    border: 'none', borderBottom: '1px solid var(--accent)',
                    background: 'transparent', outline: 'none', padding: '2px 0',
                    borderRadius: 0, minHeight: 'unset',
                  }}
                />
              ) : (
                <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cat.name}
                </span>
              )}

              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: 'var(--radius-base, 8px)', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                {cat.type}
              </span>

              <button onClick={() => {
                if (cat.id) {
                  setEditingNameId(cat.id)
                  setEditNameValue(cat.name)
                }
              }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', padding: '2px 8px', fontWeight: 500 }}
              >Edit</button>

              <button onClick={() => { if (cat.id && confirm(`Delete "${cat.name}"?`)) deleteCategory(cat.id) }}
                style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '11px', padding: '2px 8px', fontWeight: 500 }}
              >Delete</button>
            </div>
          ))}
        </div>

        {/* Add new */}
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '16px'
        }}>
          <p style={{ fontSize: '12px', fontWeight: 600,
            color: 'var(--text-tertiary)', marginBottom: '12px',
            textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Add Category
          </p>
          <div style={{ display: 'flex', gap: '8px',
            marginBottom: '8px' }}>
            <input
              placeholder="Category name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px',
                borderRadius: 'var(--radius-base, 8px)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '13px'
              }}
            />
            <select value={newType}
              onChange={e => setNewType(
                e.target.value as 'income' | 'expense' | 'both'
              )}
              style={{
                padding: '8px', borderRadius: 'var(--radius-base, 8px)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '13px'
              }}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '6px',
            marginBottom: '12px', flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(color => (
              <div key={color} style={{
                width: '24px', height: '24px',
                borderRadius: '50%', background: color,
                cursor: 'pointer',
                border: newColor === color
                  ? '3px solid var(--text-primary)'
                  : '3px solid transparent'
              }} onClick={() => setNewColor(color)} />
            ))}
          </div>

          <button onClick={addCategory} style={{
            width: '100%', padding: '8px',
            borderRadius: 'var(--radius-base, 8px)', border: 'none',
            background: 'var(--accent)', color: 'white',
            fontSize: '13px', fontWeight: 600,
            cursor: 'pointer'
          }}>
            Add Category
          </button>
        </div>
      </div>
    </div>
  )
}

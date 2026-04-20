'use client'
import { FinanceEntry, FinanceCategory } from '@/db/schema'

export interface MonthlyDatum {
  income: number
  expenses: number
  net: number
}

export default function MonthDetail({
  selectedMonth,
  monthlyData,
  entries,
  categories,
  currency,
  monthNames,
  currentYear,
  onClose,
}: {
  selectedMonth: number
  monthlyData: MonthlyDatum[]
  entries: FinanceEntry[]
  categories: FinanceCategory[]
  currency: string
  monthNames: string[]
  currentYear: number
  onClose: () => void
}) {
  const m = monthlyData[selectedMonth]
  const monthEntries = entries.filter(e => {
    const d = new Date(e.date)
    return d.getFullYear() === currentYear && d.getMonth() === selectedMonth
  })
  const expenseEntries = monthEntries.filter(e => e.type === 'expense')
  const catBreakdown = expenseEntries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount
    return acc
  }, {})
  const totalExp = expenseEntries.reduce((s, e) => s + e.amount, 0)
  const incomeEntries2 = monthEntries.filter(e => e.type === 'income')
  const incomeCatBreakdown = incomeEntries2.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount
    return acc
  }, {})
  const totalInc = incomeEntries2.reduce((s, e) => s + e.amount, 0)

  return (
    <div style={{
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius-card, 12px)',
      border: '2px solid var(--accent)',
      padding: '24px',
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {monthNames[selectedMonth]} Overview
        </h3>
        <button onClick={onClose} style={{
          background: 'none', border: 'none',
          color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '16px'
        }}>x</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Income', value: m.income, color: '#10B981' },
          { label: 'Expenses', value: m.expenses, color: '#EF4444' },
          { label: 'Net', value: m.net, color: m.net >= 0 ? '#10B981' : '#EF4444' }
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-base, 8px)', padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: stat.color }}>
              {currency}{Math.abs(stat.value).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <CategoryBreakdown
        title="Spending by Category"
        breakdown={catBreakdown}
        total={totalExp}
        categories={categories}
        currency={currency}
        emptyText={`No expenses for ${monthNames[selectedMonth]}`}
        defaultColor="#6B7280"
      />

      <CategoryBreakdown
        title="Income by Category"
        breakdown={incomeCatBreakdown}
        total={totalInc}
        categories={categories}
        currency={currency}
        emptyText={`No income for ${monthNames[selectedMonth]}`}
        defaultColor="#10B981"
        topMargin
      />
    </div>
  )
}

function CategoryBreakdown({
  title,
  breakdown,
  total,
  categories,
  currency,
  emptyText,
  defaultColor,
  topMargin = false,
}: {
  title: string
  breakdown: Record<string, number>
  total: number
  categories: FinanceCategory[]
  currency: string
  emptyText: string
  defaultColor: string
  topMargin?: boolean
}) {
  return (
    <>
      <div style={{
        fontSize: '11px', fontWeight: 600,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: '12px',
        marginTop: topMargin ? '24px' : 0,
      }}>
        {title}
      </div>
      {Object.keys(breakdown).length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', padding: '16px' }}>
          {emptyText}
        </div>
      ) : Object.entries(breakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([catName, amount]) => {
            const cat = categories.find(c => c.name === catName)
            const pct = total > 0 ? (amount / total * 100) : 0
            return (
              <div key={catName} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '10px', height: '10px',
                      borderRadius: '50%',
                      background: cat?.color || defaultColor,
                      flexShrink: 0
                    }}/>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{catName}</span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {currency}{amount.toFixed(2)} ({pct.toFixed(1)}%)
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: cat?.color || defaultColor,
                    borderRadius: '3px',
                    transition: 'width 0.5s ease'
                  }}/>
                </div>
              </div>
            )
          })}
    </>
  )
}

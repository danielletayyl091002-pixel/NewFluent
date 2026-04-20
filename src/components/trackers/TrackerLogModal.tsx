'use client'
import { useState } from 'react'
import { TrackerDefinition } from '@/db/schema'

interface Props {
  tracker: TrackerDefinition
  currentValue: number
  onLog: (value: number, note?: string, date?: string, startTime?: string, endTime?: string) => void
  onClose: () => void
}

export default function TrackerLogModal({ tracker, currentValue, onLog, onClose }: Props) {
  const [value, setValue] = useState(tracker.type === 'counter' ? 1 : 0)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [showTime, setShowTime] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const options: string[] = tracker.options ? JSON.parse(tracker.options) : []

  function handleLog(val: number) {
    onLog(
      val,
      note || undefined,
      date,
      showTime && startTime ? startTime : undefined,
      showTime && endTime ? endTime : undefined
    )
    onClose()
  }

  const dateTimeSection = (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <label style={{
            fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            display: 'block', marginBottom: '4px'
          }}>Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg-hover)',
              color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>
      <button
        onClick={() => setShowTime(p => !p)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '11px', color: 'var(--accent)',
          padding: 0, marginBottom: showTime ? '10px' : 0
        }}
      >
        {showTime ? '- Remove time slot' : '+ Add time slot'}
      </button>
      {showTime && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={{
              fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              display: 'block', marginBottom: '4px'
            }}>Start</label>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--bg-hover)',
                color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{
              fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              display: 'block', marginBottom: '4px'
            }}>End</label>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--bg-hover)',
                color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-primary)', borderRadius: '14px',
        padding: '24px', width: '340px', maxWidth: '90vw',
        boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
        border: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ color: tracker.color, display: 'flex' }}>
            {tracker.icon}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--text-primary)' }}>
              {tracker.name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              Today: {currentValue}{tracker.unit ? ` ${tracker.unit}` : ''} / {tracker.target}{tracker.unit ? ` ${tracker.unit}` : ''}
            </div>
          </div>
        </div>

        {tracker.type === 'select' && options.length > 0 ? (
          <>
            {dateTimeSection}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
              {options.map((opt, i) => (
                <button key={i} onClick={() => handleLog(i + 1)} style={{
                  fontSize: '32px', background: 'var(--bg-hover)', border: 'none',
                  borderRadius: '12px', width: '52px', height: '52px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform 0.1s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >{opt}</button>
              ))}
            </div>
          </>
        ) : tracker.type === 'habit' ? (
          <>
            {dateTimeSection}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
              <button onClick={() => handleLog(1)} style={{
                padding: '10px 28px', borderRadius: '10px', border: 'none',
                background: tracker.color, color: '#fff', fontWeight: 600,
                fontSize: '14px', cursor: 'pointer'
              }}>Done</button>
              <button onClick={onClose} style={{
                padding: '10px 28px', borderRadius: '10px', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-secondary)',
                fontWeight: 500, fontSize: '14px', cursor: 'pointer'
              }}>Skip</button>
            </div>
          </>
        ) : (
          <>
            {dateTimeSection}
            {tracker.type === 'counter' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', marginBottom: '16px' }}>
                <button onClick={() => setValue(Math.max(1, value - 1))} style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  border: '1px solid var(--border)', background: 'var(--bg-hover)',
                  cursor: 'pointer', fontSize: '18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-primary)'
                }}>-</button>
                <span style={{
                  fontSize: '28px', fontWeight: 700,
                  color: 'var(--text-primary)', minWidth: '40px', textAlign: 'center'
                }}>{value}</span>
                <button onClick={() => setValue(value + 1)} style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  border: '1px solid var(--border)', background: 'var(--bg-hover)',
                  cursor: 'pointer', fontSize: '18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-primary)'
                }}>+</button>
              </div>
            )}
            {tracker.type === 'value' && (
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="number"
                  value={value || ''}
                  onChange={e => setValue(Number(e.target.value))}
                  placeholder={`Enter ${tracker.unit || 'value'}`}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '1px solid var(--border)', background: 'var(--bg-hover)',
                    color: 'var(--text-primary)', fontSize: '16px', textAlign: 'center',
                    outline: 'none'
                  }}
                  autoFocus
                />
              </div>
            )}
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Note (optional)"
              style={{
                width: '100%', padding: '8px 14px', borderRadius: '10px',
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px',
                outline: 'none'
              }}
            />
            <button onClick={() => handleLog(value)} style={{
              width: '100%', padding: '10px', borderRadius: '10px', border: 'none',
              background: tracker.color, color: '#fff', fontWeight: 600,
              fontSize: '14px', cursor: 'pointer'
            }}>
              Log {value} {tracker.unit}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

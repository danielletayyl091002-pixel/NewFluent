// .ics (iCalendar) export for the calendar. RFC 5545-conformant enough for
// Google Calendar / Apple Calendar / Outlook to import recurring + single
// events. We export only items with itemType === 'event' (tasks aren't
// schedulable in iCal terms in the same way).

import { Task } from '@/db/schema'

function pad(n: number) { return String(n).padStart(2, '0') }

// Format a date+time as ICS DTSTART/DTEND (local time, no Z suffix).
function fmt(dateStr: string, timeStr: string | null | undefined): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!timeStr) {
    // All-day → DATE value (no time)
    return `${y}${pad(m)}${pad(d)}`
  }
  const [hh, mm] = timeStr.split(':').map(Number)
  return `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function foldLine(line: string): string {
  // RFC 5545: lines must be ≤ 75 octets; longer lines folded with CRLF + space.
  if (line.length <= 75) return line
  const out: string[] = []
  let i = 0
  while (i < line.length) {
    out.push((i === 0 ? '' : ' ') + line.slice(i, i + 73))
    i += 73
  }
  return out.join('\r\n')
}

export function tasksToIcs(tasks: Task[], calendarName = 'Fluent'): string {
  const events = tasks.filter(t => t.itemType === 'event' && (t.scheduledDate || t.dueDate))
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fluent//Local-First//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ]

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  for (const e of events) {
    const date = (e.scheduledDate || e.dueDate)!
    const allDay = !e.startTime
    const dtstart = fmt(date, e.startTime)
    const dtend = e.endTime ? fmt(date, e.endTime) : (allDay ? fmt(date, null) : dtstart)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.uid}@fluent.local`)
    lines.push(`DTSTAMP:${stamp}`)
    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dtstart}`)
      lines.push(`DTEND;VALUE=DATE:${dtend}`)
    } else {
      lines.push(`DTSTART:${dtstart}`)
      lines.push(`DTEND:${dtend}`)
    }
    lines.push(foldLine(`SUMMARY:${escapeText(e.title || 'Untitled')}`))
    if (e.description) lines.push(foldLine(`DESCRIPTION:${escapeText(e.description)}`))
    if (e.location) lines.push(foldLine(`LOCATION:${escapeText(e.location)}`))
    // RRULE — Fluent stores e.recurrence already in iCal form (FREQ=DAILY etc).
    if (e.recurrence) lines.push(`RRULE:${e.recurrence}`)
    if (e.recurrenceException) {
      try {
        const dates: string[] = JSON.parse(e.recurrenceException)
        for (const ex of dates) {
          // RFC 5545: EXDATE must be either YYYYMMDD (DATE) or
          // YYYYMMDDTHHMMSS (DATE-TIME). Detect on 'T' separator and
          // strip non-digit chars from each side; fall back to all-day.
          if (ex.includes('T')) {
            const [d, t] = ex.split('T')
            const datePart = d.replace(/-/g, '')
            const timePart = t.replace(/[:.]/g, '').slice(0, 6)
            lines.push(`EXDATE:${datePart}T${timePart}`)
          } else {
            lines.push(`EXDATE;VALUE=DATE:${ex.replace(/-/g, '')}`)
          }
        }
      } catch { /* noop */ }
    }
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(ics: string, filename = 'fluent-calendar.ics') {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

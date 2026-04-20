// Single source of truth for the user's 12h/24h preference.
// Stored in localStorage under 'time_format' (set by Settings page).

export function use24Hour(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem('time_format') === '24h'
}

// Format an hour (decimal, e.g. 13.5 = 1:30 PM) for display.
// 24h: "13:30"  |  12h: "1:30 PM"
export function formatHourDecimal(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (use24Hour()) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  }
  const period = hrs >= 12 ? 'PM' : 'AM'
  const display = hrs > 12 ? hrs - 12 : hrs === 0 ? 12 : hrs
  return `${display}:${String(mins).padStart(2, '0')} ${period}`
}

// Format a whole hour for axis labels.
// 24h: "13:00"  |  12h: "1 PM" (or "12 AM"/"12 PM")
export function formatHourLabel(h: number): string {
  if (use24Hour()) {
    return `${String(h).padStart(2, '0')}:00`
  }
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  if (h > 12) return `${h - 12} PM`
  return `${h} AM`
}

// Format a "HH:MM" string for display, respecting the user's preference.
export function formatTimeString(time: string): string {
  if (use24Hour()) return time
  const [hStr, mStr] = time.split(':')
  const h = Number(hStr)
  const m = mStr ?? '00'
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${display}:${m} ${period}`
}

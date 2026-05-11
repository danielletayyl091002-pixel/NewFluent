// Google Calendar-style recurrence helpers — preset detection, custom rule
// builder, and human-readable formatting. RRULE strings are stored without
// the leading "RRULE:" prefix (matches the existing expandRecurring contract).

export const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const
export type WeekdayCode = typeof WEEKDAY_CODES[number]

export const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
]

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth']

// Convert a Date's day-of-week to a 2-letter rrule code.
export function dayCodeFromDate(date: Date): WeekdayCode {
  return WEEKDAY_CODES[date.getDay()]
}

// 1..5 = which occurrence of this weekday this date is in its month.
// (e.g., May 11 2026 is the 2nd Monday of May.)
export function nthWeekdayOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7)
}

export function weekdayName(date: Date): string {
  return WEEKDAY_NAMES[date.getDay()]
}

export function ordinalLabel(n: number): string {
  return ORDINALS[n - 1] || `${n}th`
}

// Parse a YYYY-MM-DD date string into a local Date (no timezone shift).
export function parseDateLocal(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

// ── Preset list ────────────────────────────────────────────────────────────
// Mirrors Google Calendar's recurrence dropdown. Labels are computed from
// the event's start date so the user sees, e.g., "Weekly on Monday" rather
// than a generic "Weekly".

export interface RecurrencePreset {
  key: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'weekday' | 'custom'
  label: string
  /** RRULE string without leading "RRULE:". null = no recurrence,
   *  'CUSTOM' = open the custom builder modal. */
  value: string | null
}

export function getPresetOptions(dateStr: string): RecurrencePreset[] {
  const date = parseDateLocal(dateStr)
  const dayCode = dayCodeFromDate(date)
  const dayName = weekdayName(date)
  const nth = nthWeekdayOfMonth(date)
  const ord = ordinalLabel(nth)
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  return [
    { key: 'none',    label: 'Does not repeat',                       value: null },
    { key: 'daily',   label: 'Daily',                                  value: 'FREQ=DAILY' },
    { key: 'weekly',  label: `Weekly on ${dayName}`,                   value: `FREQ=WEEKLY;BYDAY=${dayCode}` },
    { key: 'monthly', label: `Monthly on the ${ord} ${dayName}`,       value: `FREQ=MONTHLY;BYDAY=${nth}${dayCode}` },
    { key: 'yearly',  label: `Annually on ${monthDay}`,                value: 'FREQ=YEARLY' },
    { key: 'weekday', label: 'Every weekday (Mon–Fri)',                value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
    { key: 'custom',  label: 'Custom…',                                value: 'CUSTOM' },
  ]
}

// Normalise an RRULE string for comparison: split on ';', sort, rejoin.
// (BYDAY=MO,TU,WE order matters in some places but for preset matching
// we only care about the set.)
function normaliseRule(rule: string): string {
  return rule.split(';').sort().join(';')
}

// Returns the matching preset key, or 'custom' if no preset matches.
export function detectPresetKey(rrule: string | null | undefined, dateStr: string): RecurrencePreset['key'] {
  if (!rrule) return 'none'
  const normalised = normaliseRule(rrule)
  const presets = getPresetOptions(dateStr)
  for (const p of presets) {
    if (!p.value || p.value === 'CUSTOM') continue
    if (normaliseRule(p.value) === normalised) return p.key
  }
  return 'custom'
}

// ── Parser & serializer for the Custom builder ────────────────────────────

export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export interface ParsedRrule {
  freq: Freq
  interval: number
  /** For WEEKLY: list of days. For MONTHLY: empty (use bydayWithPos). */
  byday: WeekdayCode[]
  /** For MONTHLY "on the 2nd Monday" — pos = 1..5 or -1, day = 'MO'. */
  bydayWithPos: { pos: number; day: WeekdayCode } | null
  /** For MONTHLY "on day N" — 1..31. */
  bymonthday: number | null
  /** End conditions — at most one is set. */
  until: string | null   // YYYYMMDD
  count: number | null
}

export function parseRrule(rrule: string): ParsedRrule {
  const out: ParsedRrule = {
    freq: 'WEEKLY',
    interval: 1,
    byday: [],
    bydayWithPos: null,
    bymonthday: null,
    until: null,
    count: null,
  }
  for (const part of rrule.split(';')) {
    const [k, v] = part.split('=')
    if (!k || !v) continue
    switch (k) {
      case 'FREQ':
        if (v === 'DAILY' || v === 'WEEKLY' || v === 'MONTHLY' || v === 'YEARLY') {
          out.freq = v
        }
        break
      case 'INTERVAL':
        out.interval = Math.max(1, parseInt(v, 10) || 1)
        break
      case 'BYDAY': {
        const days = v.split(',')
        // If single token has a numeric prefix (e.g., '2MO', '-1FR'), treat
        // as "nth weekday of the month" rather than a simple day list.
        if (days.length === 1) {
          const m = days[0].match(/^(-?\d+)([A-Z]{2})$/)
          if (m) {
            out.bydayWithPos = {
              pos: parseInt(m[1], 10),
              day: m[2] as WeekdayCode,
            }
            break
          }
        }
        out.byday = days.filter(d => (WEEKDAY_CODES as readonly string[]).includes(d)) as WeekdayCode[]
        break
      }
      case 'BYMONTHDAY':
        out.bymonthday = parseInt(v, 10) || null
        break
      case 'UNTIL':
        out.until = v
        break
      case 'COUNT':
        out.count = parseInt(v, 10) || null
        break
    }
  }
  return out
}

export function serializeRrule(opts: ParsedRrule): string {
  const parts: string[] = [`FREQ=${opts.freq}`]
  if (opts.interval > 1) parts.push(`INTERVAL=${opts.interval}`)
  if (opts.bydayWithPos) {
    parts.push(`BYDAY=${opts.bydayWithPos.pos}${opts.bydayWithPos.day}`)
  } else if (opts.byday.length > 0) {
    // Sort days in week order for consistent output.
    const sorted = [...opts.byday].sort(
      (a, b) => WEEKDAY_CODES.indexOf(a) - WEEKDAY_CODES.indexOf(b)
    )
    parts.push(`BYDAY=${sorted.join(',')}`)
  }
  if (opts.bymonthday) parts.push(`BYMONTHDAY=${opts.bymonthday}`)
  if (opts.until) parts.push(`UNTIL=${opts.until}`)
  if (opts.count) parts.push(`COUNT=${opts.count}`)
  return parts.join(';')
}

// Default ParsedRrule for opening the Custom modal on a fresh event.
export function defaultParsedRrule(dateStr: string): ParsedRrule {
  const date = parseDateLocal(dateStr)
  return {
    freq: 'WEEKLY',
    interval: 1,
    byday: [dayCodeFromDate(date)],
    bydayWithPos: null,
    bymonthday: null,
    until: null,
    count: null,
  }
}

// ── Human-readable summary ────────────────────────────────────────────────
// Used to label the dropdown when the rule is too custom to match a preset.
// e.g., "Every 2 weeks on Mon, Wed until Jun 30" or "Every 3 months, 12 times"

export function formatRruleSummary(rrule: string, dateStr: string): string {
  const opts = parseRrule(rrule)
  const date = parseDateLocal(dateStr)
  const unit = opts.freq === 'DAILY' ? 'day'
    : opts.freq === 'WEEKLY' ? 'week'
    : opts.freq === 'MONTHLY' ? 'month'
    : 'year'

  let s = opts.interval === 1
    ? `Every ${unit}`
    : `Every ${opts.interval} ${unit}s`

  if (opts.freq === 'WEEKLY' && opts.byday.length > 0 && opts.byday.length < 7) {
    const days = opts.byday
      .map(d => WEEKDAY_SHORT[WEEKDAY_CODES.indexOf(d)])
      .join(', ')
    s += ` on ${days}`
  } else if (opts.freq === 'MONTHLY') {
    if (opts.bydayWithPos) {
      const dayName = WEEKDAY_NAMES[WEEKDAY_CODES.indexOf(opts.bydayWithPos.day)]
      const ord = opts.bydayWithPos.pos === -1
        ? 'last' : ordinalLabel(opts.bydayWithPos.pos)
      s += ` on the ${ord} ${dayName}`
    } else if (opts.bymonthday) {
      s += ` on day ${opts.bymonthday}`
    } else {
      s += ` on day ${date.getDate()}`
    }
  } else if (opts.freq === 'YEARLY') {
    s += ` on ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
  }

  if (opts.until) {
    const y = opts.until.slice(0, 4), m = opts.until.slice(4, 6), d = opts.until.slice(6, 8)
    const untilDate = new Date(`${y}-${m}-${d}T00:00:00`)
    s += ` until ${untilDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  } else if (opts.count) {
    s += `, ${opts.count} times`
  }

  return s
}

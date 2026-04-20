import { Task } from '@/db/schema'
import { RRule } from 'rrule'

// Expand recurring events into occurrences for a date range
export function expandRecurring(tasks: Task[], startDate: Date, endDate: Date): Task[] {
  const result: Task[] = []
  for (const task of tasks) {
    // Parse deleted-occurrence exceptions for this recurring task
    const exceptions: string[] = task.recurrenceException
      ? (() => { try { return JSON.parse(task.recurrenceException!) } catch { return [] } })()
      : []
    if (task.recurrence && task.scheduledDate) {
      try {
        const masterDate = new Date(task.scheduledDate + 'T00:00:00')
        const rule = RRule.fromString(`DTSTART:${task.scheduledDate.replace(/-/g, '')}T000000Z\n${task.recurrence}`)
        const occurrences = rule.between(startDate, endDate, true)
        for (const occ of occurrences) {
          const occDateStr = occ.toISOString().split('T')[0]
          // Skip the master date — it's already in the list as a regular task
          if (occDateStr === task.scheduledDate) continue
          // Skip any dates the user has deleted as "this occurrence only"
          if (exceptions.includes(occDateStr)) continue
          result.push({
            ...task,
            id: undefined, // mark as virtual
            uid: `${task.uid}_${occDateStr}`,
            scheduledDate: occDateStr,
            dueDate: occDateStr,
          })
        }
      } catch { /* invalid rrule, skip */ }
    }
    // Push the master task itself, unless its own date was deleted as an exception
    if (!task.scheduledDate || !exceptions.includes(task.scheduledDate)) {
      result.push(task)
    }
  }
  return result
}

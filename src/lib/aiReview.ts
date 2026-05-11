// Bring-your-own-key Claude API call for the weekly review.
// API key lives in localStorage under 'anthropic_api_key' — we never
// proxy it through a server (this app is local-first).
//
// The call uses the public Anthropic Messages API directly from the
// browser. Anthropic supports CORS for direct browser calls when the
// `anthropic-dangerous-direct-browser-access` header is set; users
// understand the tradeoff because they pasted their own key.

import { Task, TrackerDefinition, TrackerLog, FinanceEntry } from '@/db/schema'

export interface ReviewInput {
  weekStart: string                    // YYYY-MM-DD (Monday or Sunday)
  weekEnd: string                      // YYYY-MM-DD
  tasks: Task[]                        // tasks scheduled or due in window
  trackers: TrackerDefinition[]
  trackerLogs: TrackerLog[]            // logs in the window
  financeEntries: FinanceEntry[]       // entries in the window
}

export interface ReviewOutput {
  summary: string                      // Markdown summary, 4-6 sentences
  highlights: string[]                 // bullet wins / patterns
  suggestions: string[]                // 1-3 next-week nudges
}

function buildPrompt(input: ReviewInput): string {
  const tasksDone = input.tasks.filter(t => t.status === 'done').length
  const tasksOpen = input.tasks.filter(t => t.status !== 'done').length
  const events = input.tasks.filter(t => t.itemType === 'event').length

  const trackerSummaries = input.trackers.map(tr => {
    const logs = input.trackerLogs.filter(l => l.trackerUid === tr.uid && l.value > 0)
    const days = new Set(logs.map(l => l.date)).size
    const total = logs.reduce((s, l) => s + l.value, 0)
    return `- ${tr.name} (${tr.type}${tr.unit ? ' ' + tr.unit : ''}): logged ${days}/7 days, total ${total}${tr.target > 0 ? ` (target ${tr.target}/day)` : ''}`
  }).join('\n')

  const financeSummary = (() => {
    const income = input.financeEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
    const expense = input.financeEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
    return `Income: ${income.toFixed(2)} · Expenses: ${expense.toFixed(2)} · Net: ${(income - expense).toFixed(2)}`
  })()

  return `You are reviewing a productivity workspace's data for the week of ${input.weekStart} to ${input.weekEnd}.

## Tasks
- Done: ${tasksDone}
- Open: ${tasksOpen}
- Events scheduled: ${events}

## Trackers
${trackerSummaries || '- (none)'}

## Finance
${financeSummary}

Respond with a JSON object:
{
  "summary": "4-6 sentence narrative summary in plain language",
  "highlights": ["bullet wins, patterns, streaks — 3-5 items"],
  "suggestions": ["1-3 specific, kind nudges for next week — concrete, not generic"]
}

Tone: warm, observational, never preachy. Don't moralise. If data is sparse, say so.
Return ONLY the JSON, no prose around it.`
}

export async function generateReview(
  input: ReviewInput,
  apiKey: string,
): Promise<ReviewOutput> {
  const prompt = buildPrompt(input)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data?.content?.[0]?.text ?? ''
  // Defensive parsing — strip markdown code fences if the model wrapped it.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned) as ReviewOutput
  } catch {
    throw new Error('Could not parse model response as JSON: ' + cleaned.slice(0, 200))
  }
}

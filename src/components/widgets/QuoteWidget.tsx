'use client'
import { useMemo } from 'react'
import { WidgetShell } from './ClockWidget'
import { getDailyQuote } from '@/lib/widgets/quotes'

// One quote per local day, rotated through a fixed bank. Stable for the
// whole day so the user doesn't see flicker on re-render.
export default function QuoteWidget() {
  const quote = useMemo(() => getDailyQuote(), [])
  return (
    <WidgetShell label="QUOTE">
      <div style={{
        fontSize: '13px', fontStyle: 'italic',
        color: 'var(--text-primary)', lineHeight: 1.4,
        // Truncate at 3 lines so a long quote doesn't blow up the card.
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        “{quote.text}”
      </div>
      <div style={{
        fontSize: '11px', color: 'var(--text-tertiary)',
        marginTop: '8px', textAlign: 'right',
      }}>
        — {quote.author}
      </div>
    </WidgetShell>
  )
}

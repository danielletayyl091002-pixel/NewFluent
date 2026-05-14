'use client'
import { useWidgets } from '@/hooks/useWidgets'
import ClockWidget from './ClockWidget'
import CountdownWidget from './CountdownWidget'
import QuoteWidget from './QuoteWidget'
import PomodoroWidget from './PomodoroWidget'
import WeatherWidget from './WeatherWidget'

// Renders the user's enabled widgets in a horizontally-scrolling row.
// Returns null when nothing is enabled so the dashboard collapses cleanly.
export default function WidgetsRow() {
  const { widgets, loaded } = useWidgets()
  if (!loaded) return null
  const enabled = widgets.filter(w => w.enabled)
  if (enabled.length === 0) return null

  return (
    <section
      aria-label="Widgets"
      style={{
        display: 'flex', gap: '12px',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '4px',  // room for scrollbar without clipping shadow
      }}
    >
      {enabled.map(w => {
        switch (w.id) {
          case 'clock':     return <ClockWidget key={w.id} />
          case 'countdown': return <CountdownWidget key={w.id} config={w.config} />
          case 'quote':     return <QuoteWidget key={w.id} />
          case 'pomodoro':  return <PomodoroWidget key={w.id} config={w.config} />
          case 'weather':   return <WeatherWidget key={w.id} config={w.config} />
          default:          return null
        }
      })}
    </section>
  )
}

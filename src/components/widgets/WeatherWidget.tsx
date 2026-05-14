'use client'
import { useEffect, useState } from 'react'
import { WidgetShell } from './ClockWidget'
import { updateWidgetConfig, useWidgets } from '@/hooks/useWidgets'

interface Cache {
  temp?: number
  code?: number
  city?: string
  fetchedAt?: number
}

interface Props {
  config: Cache & {
    unit?: 'C' | 'F'
  }
}

// WMO weather-code → short label + emoji. Subset that covers what
// Open-Meteo returns most often.
function describe(code: number | undefined): { label: string; emoji: string } {
  if (code == null) return { label: '—', emoji: '🌤' }
  if (code === 0) return { label: 'Clear', emoji: '☀️' }
  if (code <= 3) return { label: 'Partly cloudy', emoji: '⛅' }
  if (code === 45 || code === 48) return { label: 'Fog', emoji: '🌫' }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', emoji: '🌦' }
  if (code >= 61 && code <= 67) return { label: 'Rain', emoji: '🌧' }
  if (code >= 71 && code <= 77) return { label: 'Snow', emoji: '❄️' }
  if (code >= 80 && code <= 82) return { label: 'Showers', emoji: '🌦' }
  if (code >= 85 && code <= 86) return { label: 'Snow showers', emoji: '🌨' }
  if (code >= 95) return { label: 'Thunder', emoji: '⛈' }
  return { label: 'Cloudy', emoji: '☁️' }
}

// 30-minute cache so we don't hammer Open-Meteo. Refetch on mount if
// stale; otherwise display the cached value instantly.
const STALE_MS = 30 * 60 * 1000

export default function WeatherWidget({ config }: Props) {
  const { widgets } = useWidgets()
  const [status, setStatus] = useState<'idle' | 'loading' | 'denied' | 'error'>('idle')

  useEffect(() => {
    const fresh = config.fetchedAt && (Date.now() - config.fetchedAt) < STALE_MS
    if (fresh) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('denied'); return
    }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { latitude, longitude } = pos.coords
          // Open-Meteo: free, no API key, CORS-friendly.
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=celsius`
          const resp = await fetch(url)
          if (!resp.ok) throw new Error('fetch failed')
          const data = await resp.json()
          const temp = data?.current?.temperature_2m
          const code = data?.current?.weather_code
          await updateWidgetConfig('weather', {
            temp, code,
            fetchedAt: Date.now(),
          }, widgets)
          setStatus('idle')
        } catch (err) {
          console.warn('weather fetch failed', err)
          setStatus('error')
        }
      },
      (err) => {
        console.warn('geolocation denied', err)
        setStatus('denied')
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { label, emoji } = describe(config.code)
  const unit = config.unit ?? 'C'
  let tempDisplay = '—'
  if (config.temp != null) {
    const t = unit === 'F' ? (config.temp * 9 / 5) + 32 : config.temp
    tempDisplay = `${Math.round(t)}°${unit}`
  }

  // Empty / denied / error states all fall back to a soft message so the
  // card never looks broken.
  if (config.temp == null && status === 'loading') {
    return <WidgetShell label="WEATHER"><div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Locating…</div></WidgetShell>
  }
  if (config.temp == null && (status === 'denied' || status === 'error')) {
    return (
      <WidgetShell label="WEATHER">
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
          {status === 'denied' ? 'Location permission needed' : 'Could not load weather'}
        </div>
      </WidgetShell>
    )
  }

  return (
    <WidgetShell label="WEATHER">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <div style={{ fontSize: '32px', lineHeight: 1 }}>{emoji}</div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{tempDisplay}</div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{label}</div>
    </WidgetShell>
  )
}

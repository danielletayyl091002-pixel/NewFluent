'use client'
import { useEffect, useState } from 'react'
import { db } from '@/db/schema'

const PALETTES: {
  name: string
  colors: [string, string, string]
  vars: Record<string, string>
  darkVars: Record<string, string>
}[] = [
  { name: 'Default', colors: ['#3B82F6', '#60A5FA', '#EFF6FF'],
    vars: { '--accent': '#3B82F6', '--accent-light': '#EFF6FF' },
    darkVars: { '--accent': '#60A5FA', '--accent-light': '#1E3A5F' } },
  { name: 'Ocean', colors: ['#0EA5E9', '#38BDF8', '#F0F9FF'],
    vars: { '--accent': '#0EA5E9', '--accent-light': '#F0F9FF' },
    darkVars: { '--accent': '#38BDF8', '--accent-light': '#0C4A6E' } },
  { name: 'Midnight', colors: ['#1E40AF', '#3B82F6', '#EFF6FF'],
    vars: { '--accent': '#1E40AF', '--accent-light': '#EFF6FF' },
    darkVars: { '--accent': '#3B82F6', '--accent-light': '#172554' } },
  { name: 'Lavender', colors: ['#8B5CF6', '#A78BFA', '#F5F3FF'],
    vars: { '--accent': '#8B5CF6', '--accent-light': '#F5F3FF' },
    darkVars: { '--accent': '#A78BFA', '--accent-light': '#3B0764' } },
  { name: 'Periwinkle', colors: ['#6B7FD4', '#8B9FE8', '#F0F2FD'],
    vars: { '--accent': '#6B7FD4', '--accent-light': '#F0F2FD' },
    darkVars: { '--accent': '#8B9FE8', '--accent-light': '#0A0E3D' } },
  { name: 'Rose', colors: ['#E11D48', '#FB7185', '#FFF1F2'],
    vars: { '--accent': '#E11D48', '--accent-light': '#FFF1F2' },
    darkVars: { '--accent': '#FB7185', '--accent-light': '#4C0519' } },
  { name: 'Sakura', colors: ['#D4859A', '#E8A0B0', '#FDF0F3'],
    vars: { '--accent': '#D4859A', '--accent-light': '#FDF0F3' },
    darkVars: { '--accent': '#E8A0B0', '--accent-light': '#3D1A22' } },
  { name: 'Dusty Rose', colors: ['#B07080', '#C99AAA', '#FAF0F2'],
    vars: { '--accent': '#B07080', '--accent-light': '#FAF0F2' },
    darkVars: { '--accent': '#C99AAA', '--accent-light': '#2E1018' } },
  { name: 'Lychee', colors: ['#E8607A', '#F08090', '#FEF0F2'],
    vars: { '--accent': '#E8607A', '--accent-light': '#FEF0F2' },
    darkVars: { '--accent': '#F08090', '--accent-light': '#3D0510' } },
  { name: 'Milkshake', colors: ['#E8A0C0', '#F0C0D8', '#FDF5FA'],
    vars: { '--accent': '#E8A0C0', '--accent-light': '#FDF5FA' },
    darkVars: { '--accent': '#F0C0D8', '--accent-light': '#3D0A22' } },
  { name: 'Sunset', colors: ['#F97316', '#FB923C', '#FFF7ED'],
    vars: { '--accent': '#F97316', '--accent-light': '#FFF7ED' },
    darkVars: { '--accent': '#FB923C', '--accent-light': '#7C2D12' } },
  { name: 'Cheesecake', colors: ['#C4A265', '#D4B885', '#FDF8EF'],
    vars: { '--accent': '#C4A265', '--accent-light': '#FDF8EF' },
    darkVars: { '--accent': '#D4B885', '--accent-light': '#2E200A' } },
  { name: 'Oat Milk', colors: ['#C8A882', '#D8C0A0', '#FAF6F0'],
    vars: { '--accent': '#C8A882', '--accent-light': '#FAF6F0' },
    darkVars: { '--accent': '#D8C0A0', '--accent-light': '#2E1E08' } },
  { name: 'Mocha', colors: ['#8B5E3C', '#A87850', '#FBF5F0'],
    vars: { '--accent': '#8B5E3C', '--accent-light': '#FBF5F0' },
    darkVars: { '--accent': '#A87850', '--accent-light': '#1E0E05' } },
  { name: 'Matcha', colors: ['#5C7A5C', '#8FAF8F', '#F0F5F0'],
    vars: { '--accent': '#5C7A5C', '--accent-light': '#F0F5F0' },
    darkVars: { '--accent': '#8FAF8F', '--accent-light': '#1A2E1A' } },
  { name: 'Eucalyptus', colors: ['#4A8C7F', '#6BB5A6', '#EDF5F4'],
    vars: { '--accent': '#4A8C7F', '--accent-light': '#EDF5F4' },
    darkVars: { '--accent': '#6BB5A6', '--accent-light': '#0F2926' } },
  { name: 'Pistachio', colors: ['#8DB870', '#ADDC90', '#F4FAF0'],
    vars: { '--accent': '#8DB870', '--accent-light': '#F4FAF0' },
    darkVars: { '--accent': '#ADDC90', '--accent-light': '#142A08' } },
  { name: 'Fern', colors: ['#15803D', '#22C55E', '#F0FDF4'],
    vars: { '--accent': '#15803D', '--accent-light': '#F0FDF4' },
    darkVars: { '--accent': '#22C55E', '--accent-light': '#14532D' } },
  { name: 'Pastel Pink', colors: ['#F9A8D4', '#FBCFE8', '#FDF2F8'],
    vars: { '--accent': '#EC4899', '--accent-light': '#FDF2F8' },
    darkVars: { '--accent': '#F9A8D4', '--accent-light': '#500724' } },
  { name: 'Pastel Green', colors: ['#86EFAC', '#BBF7D0', '#F0FDF4'],
    vars: { '--accent': '#4ADE80', '--accent-light': '#F0FDF4' },
    darkVars: { '--accent': '#86EFAC', '--accent-light': '#14532D' } },
  { name: 'Pastel Lilac', colors: ['#C4B5FD', '#DDD6FE', '#F5F3FF'],
    vars: { '--accent': '#A78BFA', '--accent-light': '#F5F3FF' },
    darkVars: { '--accent': '#C4B5FD', '--accent-light': '#3B0764' } },
  { name: 'Slate', colors: ['#475569', '#94A3B8', '#F8FAFC'], vars: { '--accent': '#475569', '--accent-light': '#F8FAFC' }, darkVars: { '--accent': '#94A3B8', '--accent-light': '#1E293B' } },
]

const FONT_GROUPS: { group: string; fonts: { name: string; family: string }[] }[] = [
  { group: 'Sans-serif', fonts: [
    { name: 'System Default', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    { name: 'Inter', family: '"Inter", sans-serif' },
    { name: 'Poppins', family: '"Poppins", sans-serif' },
    { name: 'DM Sans', family: '"DM Sans", sans-serif' },
    { name: 'Lexend', family: '"Lexend", sans-serif' },
    { name: 'Lato', family: '"Lato", sans-serif' },
    { name: 'Source Sans Pro', family: '"Source Sans 3", sans-serif' },
    { name: 'IBM Plex Sans', family: '"IBM Plex Sans", sans-serif' },
    { name: 'Raleway', family: '"Raleway", sans-serif' },
    { name: 'Outfit', family: '"Outfit", sans-serif' },
    { name: 'Space Grotesk', family: '"Space Grotesk", sans-serif' },
    { name: 'Nunito', family: '"Nunito", sans-serif' },
    { name: 'Quicksand', family: '"Quicksand", sans-serif' },
    { name: 'Plus Jakarta Sans', family: '"Plus Jakarta Sans", sans-serif' },
    { name: 'Manrope', family: '"Manrope", sans-serif' },
    { name: 'Sora', family: '"Sora", sans-serif' },
  ]},
  { group: 'Serif', fonts: [
    { name: 'Georgia', family: 'Georgia, "Times New Roman", serif' },
    { name: 'Playfair Display', family: '"Playfair Display", serif' },
    { name: 'Merriweather', family: '"Merriweather", serif' },
    { name: 'Lora', family: '"Lora", serif' },
    { name: 'Fraunces', family: '"Fraunces", serif' },
    { name: 'Cormorant Garamond', family: '"Cormorant Garamond", serif' },
  ]},
  { group: 'Monospace', fonts: [
    { name: 'JetBrains Mono', family: '"JetBrains Mono", monospace' },
    { name: 'Fira Code', family: '"Fira Code", monospace' },
    { name: 'Source Code Pro', family: '"Source Code Pro", monospace' },
    { name: 'Geist Mono', family: '"Geist Mono", monospace' },
    { name: 'Inconsolata', family: '"Inconsolata", monospace' },
  ]},
]

// Google Fonts URL for all the fonts we use
const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=Lexend:wght@400;500;600;700&family=Lato:wght@400;700&family=Source+Sans+3:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&family=Merriweather:wght@400;700&family=Lora:wght@400;600;700&family=JetBrains+Mono:wght@400;500;700&family=Fira+Code:wght@400;500;700&family=Source+Code+Pro:wght@400;600;700&family=Nunito:wght@400;600;700&family=Quicksand:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Sora:wght@400;500;600;700&family=Fraunces:wght@400;600;700&family=Cormorant+Garamond:wght@400;600;700&family=Inconsolata:wght@400;500;700&display=swap'

export default function SettingsPage() {
  const [currentPalette, setCurrentPalette] = useState('Default')
  const [currentFont, setCurrentFont] = useState('System Default')
  const [fontsLoaded, setFontsLoaded] = useState(false)
  const [weekStart, setWeekStart] = useState('sunday')
  const [tintStrength, setTintStrength] = useState(8)
  const [bgImages, setBgImages] = useState<Record<string, string>>({})
  const [bgOpacities, setBgOpacities] = useState<Record<string, number>>({})
  const [interfaceStyle, setInterfaceStyle] = useState<'flat' | 'sculpt'>('flat')
  const [radiusStyle, setRadiusStyle] = useState('rounded')
  const [borderStrength, setBorderStrength] = useState(1)
  const [fontBrowseOpen, setFontBrowseOpen] = useState(false)
  const [shadowDepth, setShadowDepth] = useState(50)
  const [layoutDensity, setLayoutDensity] = useState<'compact' | 'comfortable' | 'relaxed'>('comfortable')
  const [fontSize, setFontSize] = useState<'xs' | 's' | 'm' | 'l' | 'xl'>('m')
  const [calEventStyle, setCalEventStyle] = useState<'soft' | 'solid' | 'outline'>('soft')
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')

  useEffect(() => {
    // Load saved settings
    async function loadSettings() {
      const palette = await db.settings.where('key').equals('palette').first()
      const font = await db.settings.where('key').equals('font').first()
      if (palette?.value) setCurrentPalette(palette.value)
      if (font?.value) setCurrentFont(font.value)
      const tint = await db.settings.where('key').equals('tint_strength').first()
      if (tint?.value) setTintStrength(Number(tint.value))
      const bgImgKeys = ['bg_trackers', 'bg_finance', 'bg_board']
      const imgs: Record<string, string> = {}
      for (const key of bgImgKeys) {
        const setting = await db.settings.where('key').equals(key).first()
        if (setting?.value) imgs[key] = setting.value
      }
      setBgImages(imgs)
      const opacities: Record<string, number> = {}
      for (const key of bgImgKeys) {
        const opSetting = await db.settings.where('key').equals(`${key}_opacity`).first()
        if (opSetting?.value) opacities[key] = Number(opSetting.value)
      }
      setBgOpacities(opacities)
      const styleS = await db.settings.where('key').equals('interface_style').first()
      if (styleS?.value) {
        setInterfaceStyle(styleS.value as 'flat' | 'sculpt')
        document.documentElement.setAttribute('data-style', styleS.value)
      }
      const radiusS = await db.settings.where('key').equals('radius_style').first()
      if (radiusS?.value) {
        setRadiusStyle(radiusS.value)
        document.documentElement.setAttribute('data-corners', radiusS.value)
      }
      const borderS = await db.settings.where('key').equals('border_strength').first()
      if (borderS?.value) {
        const v = Number(borderS.value)
        setBorderStrength(v)
        document.documentElement.style.setProperty('--border-opacity', String(v / 3))
        document.documentElement.style.setProperty('--border-width', v === 0 ? '0px' : v <= 1 ? '1px' : '2px')
      }
      const shadowS = await db.settings.where('key').equals('shadow_depth').first()
      if (shadowS?.value) {
        const v = Number(shadowS.value)
        setShadowDepth(v)
        document.documentElement.style.setProperty('--shadow-intensity', String(v / 100))
      }
      const densityS = await db.settings.where('key').equals('layout_density').first()
      if (densityS?.value) {
        setLayoutDensity(densityS.value as 'compact' | 'comfortable' | 'relaxed')
        document.documentElement.setAttribute('data-density', densityS.value)
      }
      const fontSizeS = await db.settings.where('key').equals('font_size').first()
      if (fontSizeS?.value) {
        setFontSize(fontSizeS.value as 'xs' | 's' | 'm' | 'l' | 'xl')
        const sizeMap: Record<string, string> = { xs: '12px', s: '13px', m: '14px', l: '16px', xl: '18px' }
        document.documentElement.style.setProperty('font-size', sizeMap[fontSizeS.value] || '14px')
      }
      const calStyleS = await db.settings.where('key').equals('calendar_event_style').first()
      if (calStyleS?.value) {
        setCalEventStyle(calStyleS.value as 'soft' | 'solid' | 'outline')
        document.documentElement.setAttribute('data-cal-style', calStyleS.value)
      }
    }
    loadSettings()

    // Load week start preference
    const savedWeekStart = localStorage.getItem('week_start')
    if (savedWeekStart) setWeekStart(savedWeekStart)
    const savedTimeFormat = localStorage.getItem('time_format')
    if (savedTimeFormat) setTimeFormat(savedTimeFormat as '12h' | '24h')

    // Load Google Fonts
    if (!document.querySelector('link[data-fluent-fonts]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = GOOGLE_FONTS_URL
      link.setAttribute('data-fluent-fonts', 'true')
      link.onload = () => setFontsLoaded(true)
      document.head.appendChild(link)
    } else {
      setFontsLoaded(true)
    }
  }, [])

  async function applyPalette(paletteName: string) {
    const palette = PALETTES.find(p => p.name === paletteName)
    if (!palette) return
    const theme = document.documentElement.getAttribute('data-theme') || 'light'
    const vars = theme === 'dark' ? palette.darkVars : palette.vars
    for (const [key, value] of Object.entries(vars)) {
      document.documentElement.style.setProperty(key, value)
    }
    setCurrentPalette(paletteName)
    // Save palette name
    const existing = await db.settings.where('key').equals('palette').first()
    if (existing?.id) {
      await db.settings.update(existing.id, { value: paletteName })
    } else {
      await db.settings.add({ key: 'palette', value: paletteName })
    }
    // Save accent vars for restore on load
    const accentVal = vars['--accent'] || ''
    const accentLightVal = vars['--accent-light'] || ''
    const accentExist = await db.settings.where('key').equals('palette_accent').first()
    if (accentExist?.id) { await db.settings.update(accentExist.id, { value: accentVal }) }
    else { await db.settings.add({ key: 'palette_accent', value: accentVal }) }
    const accentLightExist = await db.settings.where('key').equals('palette_accent_light').first()
    if (accentLightExist?.id) { await db.settings.update(accentLightExist.id, { value: accentLightVal }) }
    else { await db.settings.add({ key: 'palette_accent_light', value: accentLightVal }) }

    // Tint backgrounds in light mode
    const accent = vars['--accent'] || ''
    if (theme === 'light' && accent.startsWith('#')) {
      const r = parseInt(accent.slice(1,3), 16)
      const g = parseInt(accent.slice(3,5), 16)
      const b = parseInt(accent.slice(5,7), 16)
      const t = tintStrength / 100
      const ts = (tintStrength * 1.6) / 100
      const tm = (tintStrength * 1.25) / 100
      const bgPrimary = `rgb(${Math.round(r*t + 255*(1-t))}, ${Math.round(g*t + 255*(1-t))}, ${Math.round(b*t + 255*(1-t))})`
      const bgSecondary = `rgb(${Math.round(r*ts + 255*(1-ts))}, ${Math.round(g*ts + 255*(1-ts))}, ${Math.round(b*ts + 255*(1-ts))})`
      const bgSidebar = `rgb(${Math.round(r*tm + 255*(1-tm))}, ${Math.round(g*tm + 255*(1-tm))}, ${Math.round(b*tm + 255*(1-tm))})`
      document.documentElement.style.setProperty('--bg-primary', bgPrimary)
      document.documentElement.style.setProperty('--bg-secondary', bgSecondary)
      document.documentElement.style.setProperty('--bg-sidebar', bgSidebar)

      const bgPrimaryExist = await db.settings.where('key').equals('palette_bg_primary').first()
      if (bgPrimaryExist?.id) await db.settings.update(bgPrimaryExist.id, { value: bgPrimary })
      else await db.settings.add({ key: 'palette_bg_primary', value: bgPrimary })

      const bgSecondaryExist = await db.settings.where('key').equals('palette_bg_secondary').first()
      if (bgSecondaryExist?.id) await db.settings.update(bgSecondaryExist.id, { value: bgSecondary })
      else await db.settings.add({ key: 'palette_bg_secondary', value: bgSecondary })

      const bgSidebarExist = await db.settings.where('key').equals('palette_bg_sidebar').first()
      if (bgSidebarExist?.id) await db.settings.update(bgSidebarExist.id, { value: bgSidebar })
      else await db.settings.add({ key: 'palette_bg_sidebar', value: bgSidebar })
    }
  }

  async function applyFont(fontName: string) {
    const allFonts = FONT_GROUPS.flatMap(g => g.fonts)
    const font = allFonts.find(f => f.name === fontName)
    if (!font) return
    document.body.style.fontFamily = font.family
    setCurrentFont(fontName)
    window.dispatchEvent(new CustomEvent('font-changed', { detail: { fontFamily: font.family } }))
    const existing = await db.settings.where('key').equals('font').first()
    if (existing?.id) {
      await db.settings.update(existing.id, { value: fontName })
    } else {
      await db.settings.add({ key: 'font', value: fontName })
    }
  }

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 40px 120px' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Settings</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '40px' }}>Customize your workspace.</p>

        {/* Interface Style */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Interface Style</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>Choose how your workspace feels.</p>
          <div style={{ display: 'flex', gap: '16px' }}>
            {(['flat', 'sculpt'] as const).map(style => (
              <button
                key={style}
                onClick={() => {
                  setInterfaceStyle(style)
                  document.documentElement.setAttribute('data-style', style)
                  db.settings.where('key').equals('interface_style').first().then(ex => {
                    if (ex?.id) db.settings.update(ex.id, { value: style })
                    else db.settings.add({ key: 'interface_style', value: style })
                  })
                }}
                style={{
                  flex: '1 1 0', padding: '24px', borderRadius: 'var(--radius-card, 14px)',
                  minHeight: '160px',
                  border: interfaceStyle === style ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: interfaceStyle === style ? 'var(--accent-light)' : 'var(--bg-secondary)',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {style === 'flat' ? 'Flat' : 'Sculpt'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  {style === 'flat' ? 'Clean, minimal 2D interface' : 'Tactile 3D neumorphic surfaces'}
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                  {style === 'flat' ? (
                    <>
                      <div style={{ height: '28px', flex: 1, borderRadius: 'var(--radius-sm, 6px)', background: 'var(--accent)', opacity: 0.8 }} />
                      <div style={{ height: '28px', flex: 1, borderRadius: 'var(--radius-sm, 6px)', background: 'var(--bg-hover)' }} />
                    </>
                  ) : (
                    <>
                      <div style={{ height: '28px', flex: 1, borderRadius: '9999px', background: 'var(--accent)', boxShadow: '0 4px 8px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -1px 1px rgba(0,0,0,0.1)' }} />
                      <div style={{ height: '28px', flex: 1, borderRadius: '9999px', background: 'var(--bg-secondary)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), inset 0 -1px 2px rgba(255,255,255,0.5)' }} />
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Appearance */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Appearance</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>Fine-tune the look and feel of your workspace.</p>

          {/* Corner Style */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Corner Style</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>How rounded corners are across the interface</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {([
                { key: 'sharp', label: 'Sharp', val: '2px' },
                { key: 'subtle', label: 'Subtle', val: '6px' },
                { key: 'rounded', label: 'Rounded', val: '10px' },
                { key: 'soft', label: 'Soft', val: '16px' },
                { key: 'pill', label: 'Pill', val: '9999px' },
              ] as const).map(opt => (
                <div key={opt.key} style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => {
                  setRadiusStyle(opt.key)
                  document.documentElement.setAttribute('data-corners', opt.key)
                  db.settings.where('key').equals('radius_style').first().then(ex => {
                    if (ex?.id) db.settings.update(ex.id, { value: opt.key })
                    else db.settings.add({ key: 'radius_style', value: opt.key })
                  })
                }}>
                  <div style={{
                    width: '48px', height: '32px', background: 'var(--accent)',
                    borderRadius: opt.val === '9999px' ? '16px' : opt.val,
                    border: radiusStyle === opt.key ? '2px solid var(--accent)' : '2px solid transparent',
                    boxShadow: radiusStyle === opt.key ? '0 0 0 2px var(--accent-light)' : 'none',
                  }} />
                  <div style={{ fontSize: '10px', color: radiusStyle === opt.key ? 'var(--accent)' : 'var(--text-tertiary)', marginTop: '4px', fontWeight: 500 }}>
                    {opt.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Border Weight */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px', marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Border Weight</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>Visibility of borders and dividers</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', minWidth: '32px' }}>None</span>
              <input
                type="range" min="0" max="3" step="1" value={borderStrength}
                onChange={e => {
                  const v = Number(e.target.value)
                  setBorderStrength(v)
                  const opacities = [0, 0.10, 0.25, 0.45]
                  const widths = ['0px', '1px', '1px', '2px']
                  document.documentElement.style.setProperty('--border-color', `rgba(0,0,0,${opacities[v]})`)
                  document.documentElement.style.setProperty('--border-width', widths[v])
                  db.settings.where('key').equals('border_strength').first().then(ex => {
                    if (ex?.id) db.settings.update(ex.id, { value: String(v) })
                    else db.settings.add({ key: 'border_strength', value: String(v) })
                  })
                }}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', minWidth: '40px', textAlign: 'right' }}>Strong</span>
            </div>
            <div style={{
              marginTop: '12px', padding: '12px 16px',
              borderRadius: 'var(--radius-base, 8px)',
              border: `${borderStrength === 0 ? '0px' : borderStrength <= 1 ? '1px' : '2px'} solid rgba(0,0,0,${[0, 0.10, 0.25, 0.45][borderStrength] || 0.12})`,
              background: 'var(--bg-secondary)', fontSize: '12px', color: 'var(--text-tertiary)',
            }}>Border preview</div>
          </div>

          {/* Shadow Depth */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px', marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Shadow Depth</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>Controls elevation and depth of shadows</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', minWidth: '24px' }}>Flat</span>
              <input
                type="range" min="0" max="100" step="10" value={shadowDepth}
                onChange={e => {
                  const v = Number(e.target.value)
                  setShadowDepth(v)
                  document.documentElement.style.setProperty('--shadow-intensity', String(v / 100))
                  db.settings.where('key').equals('shadow_depth').first().then(ex => {
                    if (ex?.id) db.settings.update(ex.id, { value: String(v) })
                    else db.settings.add({ key: 'shadow_depth', value: String(v) })
                  })
                }}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', minWidth: '32px', textAlign: 'right' }}>Deep</span>
            </div>
            <div style={{
              marginTop: '12px', width: '80px', height: '48px',
              background: 'var(--bg-secondary)', borderRadius: 'var(--radius-base, 8px)',
              boxShadow: shadowDepth === 0 ? 'none' : `0 ${Math.round(shadowDepth / 10)}px ${Math.round(shadowDepth / 5)}px rgba(0,0,0,${shadowDepth / 400})`,
              border: '1px solid var(--border)', transition: 'box-shadow 0.2s',
            }} />
          </div>

          {/* Layout Density */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px', marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Layout Density</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>Spacing between elements</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([
                { key: 'compact' as const, gap: 3 },
                { key: 'comfortable' as const, gap: 6 },
                { key: 'relaxed' as const, gap: 10 },
              ]).map(d => (
                <button
                  key={d.key}
                  onClick={() => {
                    setLayoutDensity(d.key)
                    document.documentElement.setAttribute('data-density', d.key)
                    db.settings.where('key').equals('layout_density').first().then(ex => {
                      if (ex?.id) db.settings.update(ex.id, { value: d.key })
                      else db.settings.add({ key: 'layout_density', value: d.key })
                    })
                  }}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 'var(--radius-base, 8px)',
                    border: layoutDensity === d.key ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: layoutDensity === d.key ? 'var(--accent-light)' : 'transparent',
                    cursor: 'pointer', textAlign: 'center',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: `${d.gap}px`, marginBottom: '6px', alignItems: 'center' }}>
                    {[1,2,3].map(i => <div key={i} style={{ height: '3px', width: '80%', borderRadius: '2px', background: layoutDensity === d.key ? 'var(--accent)' : 'var(--text-tertiary)', opacity: 0.5 }} />)}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: layoutDensity === d.key ? 'var(--accent)' : 'var(--text-secondary)', textTransform: 'capitalize' }}>{d.key}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Font</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>Typeface for your workspace</div>
            <select
              value={currentFont}
              onChange={e => applyFont(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-base, 8px)',
                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                fontFamily: fontsLoaded ? FONT_GROUPS.flatMap(g => g.fonts).find(f => f.name === currentFont)?.family : undefined,
                appearance: 'none', cursor: 'pointer',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239CA3AF\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
              }}
            >
              {FONT_GROUPS.flatMap(g => g.fonts).map(f => (
                <option key={f.name} value={f.name} style={{ fontFamily: fontsLoaded ? f.family : undefined }}>
                  {f.name}
                </option>
              ))}
            </select>
            <div
              onClick={() => setFontBrowseOpen(!fontBrowseOpen)}
              style={{ fontSize: '12px', color: 'var(--accent)', cursor: 'pointer', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span style={{ transform: fontBrowseOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>&rsaquo;</span>
              Browse fonts
            </div>
            {fontBrowseOpen && (
              <div style={{ maxHeight: '240px', overflowY: 'auto', marginTop: '8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-base, 8px)' }}>
                {FONT_GROUPS.map(group => (
                  <div key={group.group}>
                    <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '8px 14px 4px' }}>
                      {group.group}
                    </div>
                    {group.fonts.map(f => (
                      <div
                        key={f.name}
                        onClick={() => applyFont(f.name)}
                        style={{
                          padding: '8px 14px', fontFamily: fontsLoaded ? f.family : undefined,
                          fontSize: '13px', cursor: 'pointer',
                          background: currentFont === f.name ? 'var(--accent-light)' : 'transparent',
                          color: currentFont === f.name ? 'var(--accent)' : 'var(--text-primary)',
                        }}
                        onMouseEnter={e => { if (currentFont !== f.name) (e.currentTarget).style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => { if (currentFont !== f.name) (e.currentTarget).style.background = 'transparent' }}
                      >{f.name}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Font Size */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Font Size</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>Base text size across the interface</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {([
                { key: 'xs' as const, label: 'XS', size: '12px' },
                { key: 's' as const, label: 'S', size: '13px' },
                { key: 'm' as const, label: 'M', size: '14px' },
                { key: 'l' as const, label: 'L', size: '16px' },
                { key: 'xl' as const, label: 'XL', size: '18px' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setFontSize(opt.key)
                    document.documentElement.style.setProperty('font-size', opt.size)
                    db.settings.where('key').equals('font_size').first().then(ex => {
                      if (ex?.id) db.settings.update(ex.id, { value: opt.key })
                      else db.settings.add({ key: 'font_size', value: opt.key })
                    })
                  }}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 'var(--radius-base, 8px)',
                    border: fontSize === opt.key ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: fontSize === opt.key ? 'var(--accent-light)' : 'transparent',
                    color: fontSize === opt.key ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: opt.size, fontWeight: 700, cursor: 'pointer',
                  }}
                >{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Calendar Events */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Calendar Events</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>How events appear on your calendar</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([
                { key: 'soft' as const, label: 'Soft' },
                { key: 'solid' as const, label: 'Solid' },
                { key: 'outline' as const, label: 'Outline' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setCalEventStyle(opt.key)
                    document.documentElement.setAttribute('data-cal-style', opt.key)
                    db.settings.where('key').equals('calendar_event_style').first().then(ex => {
                      if (ex?.id) db.settings.update(ex.id, { value: opt.key })
                      else db.settings.add({ key: 'calendar_event_style', value: opt.key })
                    })
                  }}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 'var(--radius-base, 8px)',
                    border: calEventStyle === opt.key ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: calEventStyle === opt.key ? 'var(--accent-light)' : 'transparent',
                    cursor: 'pointer', textAlign: 'center',
                  }}
                >
                  {/* Mini preview */}
                  <div style={{
                    width: '100%', height: '20px', borderRadius: '4px', marginBottom: '6px',
                    ...(opt.key === 'soft' ? { background: '#8B5CF620', borderLeft: '3px solid #8B5CF6' } :
                        opt.key === 'solid' ? { background: '#8B5CF6' } :
                        { background: 'transparent', border: '2px solid #8B5CF6' })
                  }} />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: calEventStyle === opt.key ? 'var(--accent)' : 'var(--text-secondary)' }}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Color Palettes */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Accent Color</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>Choose a palette for links, buttons, and highlights.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
            {PALETTES.map(p => (
              <button key={p.name} onClick={() => applyPalette(p.name)} style={{
                padding: '12px',
                borderRadius: '10px',
                border: currentPalette === p.name ? `2px solid ${p.colors[0]}` : `1px solid ${p.colors[1]}40`,
                background: currentPalette === p.name ? p.colors[2] : p.colors[2] + '80',
                cursor: 'pointer',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                  {p.colors.map((c, i) => (
                    <div key={i} style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: c, border: '1px solid rgba(0,0,0,0.08)'
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Custom color
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="color"
                defaultValue="#3B82F6"
                onChange={e => {
                  const hex = e.target.value
                  const r = parseInt(hex.slice(1,3), 16)
                  const g = parseInt(hex.slice(3,5), 16)
                  const b = parseInt(hex.slice(5,7), 16)
                  const light = `rgba(${r},${g},${b},0.12)`
                  document.documentElement.style.setProperty('--accent', hex)
                  document.documentElement.style.setProperty('--accent-light', light)
                  setCurrentPalette('Custom')
                  db.settings.where('key').equals('palette_accent').first().then(ex => {
                    if (ex?.id) db.settings.update(ex.id, { value: hex })
                    else db.settings.add({ key: 'palette_accent', value: hex })
                  })
                  db.settings.where('key').equals('palette_accent_light').first().then(ex => {
                    if (ex?.id) db.settings.update(ex.id, { value: light })
                    else db.settings.add({ key: 'palette_accent_light', value: light })
                  })
                }}
                style={{
                  width: '36px', height: '36px',
                  borderRadius: 'var(--radius-base, 8px)', border: '1px solid var(--border)',
                  padding: '2px', cursor: 'pointer',
                  background: 'none'
                }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Pick any accent color
              </span>
            </div>
          </div>
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Background tint strength
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range"
                min="0"
                max="30"
                value={tintStrength}
                onChange={async e => {
                  const val = Number(e.target.value)
                  setTintStrength(val)
                  await applyPalette(currentPalette)
                  const exist = await db.settings.where('key').equals('tint_strength').first()
                  if (exist?.id) await db.settings.update(exist.id, { value: String(val) })
                  else await db.settings.add({ key: 'tint_strength', value: String(val) })
                }}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', minWidth: '32px' }}>
                {tintStrength}%
              </span>
            </div>
          </div>
        </section>

        {/* Week starts on */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Week starts on</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['sunday', 'monday'].map(day => (
              <button
                key={day}
                onClick={() => {
                  localStorage.setItem('week_start', day)
                  setWeekStart(day)
                }}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-base, 8px)',
                  border: '1px solid var(--border)',
                  background: weekStart === day ? 'var(--accent)' : 'transparent',
                  color: weekStart === day ? 'white' : 'var(--text-secondary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {day}
              </button>
            ))}
          </div>
          <div style={{ marginTop: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Time format</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['12h', '24h'] as const).map(tf => (
                <button key={tf} onClick={() => { setTimeFormat(tf); localStorage.setItem('time_format', tf) }} style={{
                  padding: '6px 16px', borderRadius: 'var(--radius-base, 8px)', border: '1px solid var(--border)',
                  background: timeFormat === tf ? 'var(--accent)' : 'transparent',
                  color: timeFormat === tf ? 'white' : 'var(--text-secondary)',
                  fontSize: '13px', cursor: 'pointer',
                }}>{tf === '12h' ? '12-hour (3:00 PM)' : '24-hour (15:00)'}</button>
              ))}
            </div>
          </div>
        </section>


        <section style={{ marginTop: '40px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Page Backgrounds
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
            Set a custom background image for Trackers, Finance, and Kanban pages.
          </p>
          {[
            { key: 'bg_trackers', label: 'Trackers' },
            { key: 'bg_finance', label: 'Finance' },
            { key: 'bg_board', label: 'Board' },
          ].map(({ key, label }) => (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              marginBottom: '12px', padding: '12px',
              borderRadius: '10px', border: '1px solid var(--border)',
              background: 'var(--bg-secondary)'
            }}>
              <div style={{
                width: '56px', height: '40px', borderRadius: 'var(--radius-sm, 6px)',
                background: bgImages[key] ? `url(${bgImages[key]}) center/cover` : 'var(--bg-hover)',
                border: '1px solid var(--border)', flexShrink: 0
              }} />
              <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                {label}
              </span>
              <label style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm, 6px)',
                border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-secondary)',
                fontSize: '12px', cursor: 'pointer'
              }}>
                {bgImages[key] ? 'Change' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = async ev => {
                      const dataUrl = ev.target?.result as string
                      const img = new Image()
                      img.onload = async () => {
                        const canvas = document.createElement('canvas')
                        const maxW = 1920
                        const scale = Math.min(1, maxW / img.width)
                        canvas.width = img.width * scale
                        canvas.height = img.height * scale
                        const ctx = canvas.getContext('2d')!
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                        const compressed = canvas.toDataURL('image/jpeg', 0.7)
                        setBgImages(p => ({ ...p, [key]: compressed }))
                        const exist = await db.settings.where('key').equals(key).first()
                        if (exist?.id) await db.settings.update(exist.id, { value: compressed })
                        else await db.settings.add({ key, value: compressed })
                        document.documentElement.style.setProperty(`--${key}`, `url(${compressed})`)
                      }
                      img.src = dataUrl
                    }
                    reader.readAsDataURL(file)
                  }}
                />
              </label>
              {bgImages[key] && (
                <button
                  onClick={async () => {
                    setBgImages(p => ({ ...p, [key]: '' }))
                    const exist = await db.settings.where('key').equals(key).first()
                    if (exist?.id) await db.settings.update(exist.id, { value: '' })
                    document.documentElement.style.removeProperty(`--${key}`)
                  }}
                  style={{
                    padding: '5px 10px', borderRadius: 'var(--radius-sm, 6px)',
                    border: '1px solid #EF4444',
                    background: 'none', color: '#EF4444',
                    fontSize: '12px', cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              )}
              {bgImages[key] && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', width: '100%' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>Opacity</span>
                  <input
                    type="range" min="0" max="60" value={bgOpacities[key] ?? 0}
                    onChange={async e => {
                      const val = Number(e.target.value)
                      setBgOpacities(p => ({ ...p, [key]: val }))
                      document.documentElement.style.setProperty('--bg-overlay-opacity', String(val / 100))
                      const exist = await db.settings.where('key').equals(`${key}_opacity`).first()
                      if (exist?.id) await db.settings.update(exist.id, { value: String(val) })
                      else await db.settings.add({ key: `${key}_opacity`, value: String(val) })
                    }}
                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', minWidth: '28px' }}>{bgOpacities[key] ?? 0}%</span>
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Keyboard Shortcuts */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>Keyboard Shortcuts</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {[
              ['Cmd+S', 'Save page'],
              ['Cmd+K', 'Command palette'],
              ['Cmd+Shift+C', 'Toggle callout'],
              ['/', 'Slash commands'],
              ['Tab', 'Indent / Next cell'],
              ['Shift+Tab', 'Outdent / Prev cell'],
              ['Cmd+B', 'Bold'],
              ['Cmd+I', 'Italic'],
              ['Cmd+Enter', 'Save modal'],
              ['Esc', 'Close modal'],
            ].map(([key, desc]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{desc}</span>
                <kbd style={{ fontSize: '11px', fontFamily: 'monospace', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-tertiary)' }}>{key}</kbd>
              </div>
            ))}
          </div>
        </section>

        {/* Export / Import Settings */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>Data</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={async () => {
              const settings = await db.settings.toArray()
              const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href = url; a.download = 'fluent-settings.json'; a.click()
              URL.revokeObjectURL(url)
            }} style={{
              padding: '8px 16px', borderRadius: 'var(--radius-base, 8px)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
            }}>Export Settings</button>
            <label style={{
              padding: '8px 16px', borderRadius: 'var(--radius-base, 8px)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center',
            }}>
              Import Settings
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                const text = await file.text()
                try {
                  const settings = JSON.parse(text)
                  for (const s of settings) {
                    const existing = await db.settings.where('key').equals(s.key).first()
                    if (existing?.id) await db.settings.update(existing.id, { value: s.value })
                    else await db.settings.add({ key: s.key, value: s.value })
                  }
                  window.location.reload()
                } catch { alert('Invalid settings file') }
              }} />
            </label>
          </div>
        </section>

      </div>
    </div>
  )
}

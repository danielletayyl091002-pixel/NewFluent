'use client'
import { useEffect, useState } from 'react'
import { db } from '@/db/schema'
import { ChevronLeft, Menu } from 'lucide-react'
import LeftSidebar from '@/components/layout/LeftSidebar'
import RightRail from '@/components/layout/RightRail'
import CmdK from '@/components/CmdK'
import ShortcutsModal from '@/components/ui/ShortcutsModal'
import QuickCapture from '@/components/ui/QuickCapture'
import OnboardingModal from '@/components/ui/OnboardingModal'
import ErrorToast from '@/components/ui/ErrorToast'
import { useSidebarVisibility } from '@/hooks/useSidebarVisibility'
import { useIsMobile } from '@/hooks/useIsMobile'
import { registerErrorHandler } from '@/lib/dbError'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { leftVisible, rightVisible, toggleLeft, toggleRight } = useSidebarVisibility()
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showQuickCapture, setShowQuickCapture] = useState(false)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const isMobile = useIsMobile()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)

  // Wire the global Dexie-error reporter to a toast in this layout.
  // Any call to reportDbError() / safeDbWrite() from anywhere in the
  // app will surface here.
  useEffect(() => {
    registerErrorHandler((msg) => setDbError(msg))
  }, [])

  // First-run onboarding check. Fires only when the user has no pages
  // AND has never completed onboarding. Existing users (page count > 0)
  // get the flag backfilled so they never see the modal.
  useEffect(() => {
    const checkOnboarding = async () => {
      const done = await db.settings
        .where('key').equals('onboarding_complete').first()
      if (done) return

      const pageCount = await db.pages.count()
      if (pageCount === 0) {
        setShowOnboarding(true)
      } else {
        await db.settings.add({ key: 'onboarding_complete', value: 'true' })
      }
    }
    checkOnboarding()
  }, [])

  // Global keydown — Cmd+? toggles shortcuts, Cmd+Shift+N opens quick capture
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '?') {
        e.preventDefault()
        setShowShortcuts(prev => !prev)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        setShowQuickCapture(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    async function loadSettings() {
      const font = await db.settings.where('key').equals('font').first()
      if (font?.value && font.value !== 'System Default') {
        // Load Google Fonts
        if (!document.querySelector('link[data-fluent-fonts]')) {
          if (!document.querySelector('link[href="https://fonts.googleapis.com"]')) {
            const pc1 = document.createElement('link')
            pc1.rel = 'preconnect'
            pc1.href = 'https://fonts.googleapis.com'
            document.head.appendChild(pc1)
          }
          if (!document.querySelector('link[href="https://fonts.gstatic.com"]')) {
            const pc2 = document.createElement('link')
            pc2.rel = 'preconnect'
            pc2.href = 'https://fonts.gstatic.com'
            pc2.crossOrigin = 'anonymous'
            document.head.appendChild(pc2)
          }
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=Lexend:wght@400;500;600;700&family=Lato:wght@400;700&family=Source+Sans+3:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&family=Merriweather:wght@400;700&family=Lora:wght@400;600;700&family=JetBrains+Mono:wght@400;500;700&family=Fira+Code:wght@400;500;700&family=Source+Code+Pro:wght@400;600;700&display=swap'
          link.setAttribute('data-fluent-fonts', 'true')
          document.head.appendChild(link)
        }
        const fontMap: Record<string, string> = {
          'Inter': '"Inter", sans-serif',
          'Poppins': '"Poppins", sans-serif',
          'DM Sans': '"DM Sans", sans-serif',
          'Lexend': '"Lexend", sans-serif',
          'Lato': '"Lato", sans-serif',
          'Source Sans Pro': '"Source Sans 3", sans-serif',
          'IBM Plex Sans': '"IBM Plex Sans", sans-serif',
          'Raleway': '"Raleway", sans-serif',
          'Outfit': '"Outfit", sans-serif',
          'Space Grotesk': '"Space Grotesk", sans-serif',
          'Georgia': 'Georgia, "Times New Roman", serif',
          'Playfair Display': '"Playfair Display", serif',
          'Merriweather': '"Merriweather", serif',
          'Lora': '"Lora", serif',
          'JetBrains Mono': '"JetBrains Mono", monospace',
          'Fira Code': '"Fira Code", monospace',
          'Source Code Pro': '"Source Code Pro", monospace',
          'Nunito': '"Nunito", sans-serif',
          'Quicksand': '"Quicksand", sans-serif',
          'Plus Jakarta Sans': '"Plus Jakarta Sans", sans-serif',
          'Manrope': '"Manrope", sans-serif',
          'Sora': '"Sora", sans-serif',
          'Fraunces': '"Fraunces", serif',
          'Cormorant Garamond': '"Cormorant Garamond", serif',
          'Geist Mono': '"Geist Mono", monospace',
          'Inconsolata': '"Inconsolata", monospace',
        }
        if (fontMap[font.value]) {
          document.body.style.fontFamily = fontMap[font.value]
        }
      }

      const palette = await db.settings.where('key').equals('palette').first()
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light'
      if (palette?.value && palette.value !== 'Default') {
        // Re-apply palette vars on load — import the palette list dynamically would be heavy,
        // so we store just accent + accent-light in settings
        const accentSetting = await db.settings.where('key').equals('palette_accent').first()
        const accentLightSetting = await db.settings.where('key').equals('palette_accent_light').first()
        if (accentSetting?.value) document.documentElement.style.setProperty('--accent', accentSetting.value)
        if (accentLightSetting?.value) document.documentElement.style.setProperty('--accent-light', accentLightSetting.value)

        // Only apply palette bg overrides in light mode — in dark mode the
        // [data-theme="dark"] CSS rule must win, not the saved light-palette values
        if (currentTheme !== 'dark') {
          const bgPrimary = await db.settings.where('key').equals('palette_bg_primary').first()
          const bgSecondary = await db.settings.where('key').equals('palette_bg_secondary').first()
          const bgSidebar = await db.settings.where('key').equals('palette_bg_sidebar').first()
          if (bgPrimary?.value) document.documentElement.style.setProperty('--bg-primary', bgPrimary.value)
          if (bgSecondary?.value) document.documentElement.style.setProperty('--bg-secondary', bgSecondary.value)
          if (bgSidebar?.value) document.documentElement.style.setProperty('--bg-sidebar', bgSidebar.value)
        }
      }

      const bgKeys = ['bg_trackers', 'bg_finance', 'bg_board']
      for (const key of bgKeys) {
        const setting = await db.settings.where('key').equals(key).first()
        if (setting?.value) {
          document.documentElement.style.setProperty(`--${key}`, `url(${setting.value})`)
          const opSetting = await db.settings.where('key').equals(`${key}_opacity`).first()
          if (opSetting?.value) {
            document.documentElement.style.setProperty('--bg-overlay-opacity', String(Number(opSetting.value) / 100))
          }
        }
      }
      // Load interface style
      const styleS = await db.settings.where('key').equals('interface_style').first()
      if (styleS?.value) {
        document.documentElement.setAttribute('data-style', styleS.value)
      }
      // Load radius style
      const radiusS = await db.settings.where('key').equals('radius_style').first()
      if (radiusS?.value) {
        document.documentElement.setAttribute('data-corners', radiusS.value)
      }
      // Load border strength
      const borderS = await db.settings.where('key').equals('border_strength').first()
      if (borderS?.value) {
        const v = Number(borderS.value)
        document.documentElement.style.setProperty('--border-opacity', String(v / 3))
        document.documentElement.style.setProperty('--border-width', v === 0 ? '0px' : v <= 1 ? '1px' : '2px')
      }
      // Load shadow depth
      const shadowS = await db.settings.where('key').equals('shadow_depth').first()
      if (shadowS?.value) {
        document.documentElement.style.setProperty('--shadow-intensity', String(Number(shadowS.value) / 100))
      }
      // Load layout density
      const densityS = await db.settings.where('key').equals('layout_density').first()
      if (densityS?.value) {
        document.documentElement.setAttribute('data-density', densityS.value)
      }
      // Load font size
      const fontSizeS = await db.settings.where('key').equals('font_size').first()
      if (fontSizeS?.value) {
        const sizeMap: Record<string, string> = { xs: '12px', s: '13px', m: '14px', l: '16px', xl: '18px' }
        document.documentElement.style.setProperty('font-size', sizeMap[fontSizeS.value] || '14px')
      }
      // Load calendar event style
      const calStyleS = await db.settings.where('key').equals('calendar_event_style').first()
      if (calStyleS?.value) document.documentElement.setAttribute('data-cal-style', calStyleS.value)
      // Load border strength
      const borderS2 = await db.settings.where('key').equals('border_strength').first()
      if (borderS2?.value) {
        const v = Number(borderS2.value)
        const opacities = [0, 0.10, 0.25, 0.45]
        const widths = ['0px', '1px', '1px', '2px']
        document.documentElement.style.setProperty('--border-color', `rgba(0,0,0,${opacities[v] ?? 0.12})`)
        document.documentElement.style.setProperty('--border-width', widths[v] ?? '1px')
      }
    }
    loadSettings()

    // When theme changes, ensure dark mode clears palette bg overrides
    const handleThemeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.theme === 'dark') {
        document.documentElement.style.removeProperty('--bg-primary')
        document.documentElement.style.removeProperty('--bg-secondary')
        document.documentElement.style.removeProperty('--bg-sidebar')
      } else if (detail?.theme === 'light') {
        loadSettings()
      }
    }
    window.addEventListener('fluent-theme-changed', handleThemeChange)

    // Listen for font changes from settings
    const handleFontChange = (e: Event) => {
      const { fontFamily } = (e as CustomEvent).detail
      if (fontFamily) document.body.style.fontFamily = fontFamily
    }
    window.addEventListener('font-changed', handleFontChange)

    return () => {
      window.removeEventListener('fluent-theme-changed', handleThemeChange)
      window.removeEventListener('font-changed', handleFontChange)
    }
  }, [])

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      position: 'relative',
      background: 'var(--bg-secondary)',
    }}>
      <CmdK onPageCreated={() => setSidebarRefreshKey(k => k + 1)} />

      {/* Left sidebar — inline on desktop, overlay on mobile */}
      {isMobile ? (
        mobileMenuOpen && (
          <>
            <div
              onClick={() => setMobileMenuOpen(false)}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.4)',
                zIndex: 200,
              }}
            />
            <div style={{
              position: 'fixed',
              top: 0, left: 0, bottom: 0,
              zIndex: 201,
              width: '220px',
            }}>
              <LeftSidebar
                collapsed={false}
                toggleLeft={() => setMobileMenuOpen(false)}
                refreshKey={sidebarRefreshKey}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </div>
          </>
        )
      ) : (
        <LeftSidebar
          collapsed={!leftVisible}
          toggleLeft={toggleLeft}
          refreshKey={sidebarRefreshKey}
        />
      )}

      <main style={{
        flex: 1,
        overflow: 'auto',
        minWidth: 0,
        width: isMobile ? '100%' : undefined,
        transition: 'all 200ms ease-in-out',
      }}>
        {isMobile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderBottom: '0.5px solid var(--border)',
            background: 'var(--bg-primary)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}>
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
            >
              <Menu size={20} />
            </button>
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              Fluent
            </span>
          </div>
        )}
        {children}
      </main>

      {/* Right rail — hidden entirely on mobile */}
      {!isMobile && rightVisible && <RightRail toggleRight={toggleRight} />}

      {!isMobile && !rightVisible && (
        <button
          onClick={toggleRight}
          aria-label="Show right sidebar"
          style={{
            position: 'fixed',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 100,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '6px',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={16} />
        </button>
      )}

      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {showQuickCapture && (
        <QuickCapture
          onClose={() => setShowQuickCapture(false)}
          onCreated={() => setSidebarRefreshKey(k => k + 1)}
        />
      )}

      {showOnboarding && (
        <OnboardingModal
          onComplete={() => {
            setShowOnboarding(false)
            // Bump sidebar so the new Getting Started page shows up
            // without needing a reload.
            setSidebarRefreshKey(k => k + 1)
          }}
        />
      )}

      {dbError && (
        <ErrorToast
          message={dbError}
          onDismiss={() => setDbError(null)}
        />
      )}
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { db } from '@/db/schema'
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import LeftSidebar from '@/components/layout/LeftSidebar'
import RightRail from '@/components/layout/RightRail'
import CmdK from '@/components/CmdK'
import ShortcutsModal from '@/components/ui/ShortcutsModal'
import QuickCapture from '@/components/ui/QuickCapture'
import Tour from '@/components/ui/Tour'
// OnboardingModal kept on disk for potential future use but not imported here.
import ErrorToast from '@/components/ui/ErrorToast'
import { applySidebarPattern, applyAccentGradient, SidebarPattern } from '@/lib/workspaceSkin'
import { useSidebarVisibility } from '@/hooks/useSidebarVisibility'
import { useIsMobile } from '@/hooks/useIsMobile'
import { registerErrorHandler } from '@/lib/dbError'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, DragStartEvent, DragEndEvent,
} from '@dnd-kit/core'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { leftVisible, rightVisible, toggleLeft, toggleRight } = useSidebarVisibility()
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showQuickCapture, setShowQuickCapture] = useState(false)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  // showOnboarding kept as a state hook for the gated tour effect; never
  // set true now that we silent-seed instead of showing the welcome modal.
  const showOnboarding = false
  const [showTour, setShowTour] = useState(false)
  const isMobile = useIsMobile()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  // Right rail page-awareness — auto-suppress on routes where the daily
  // timeline + tracker rings are noise. User can still toggle it back
  // via the edge tab. Dashboard, trackers, and per-page (which has its
  // own calendar tab) are the surfaces where the rail is contextual.
  const pathname = usePathname()
  const railIrrelevantHere = (() => {
    if (pathname === '/settings') return true
    if (pathname === '/finance') return true
    if (pathname === '/board') return true
    if (pathname === '/calendar') return true   // page already IS a calendar
    return false
  })()
  const effectiveRightVisible = rightVisible && !railIrrelevantHere
  // Cross-app drag (task → calendar slot). dnd-kit context lifted to the
  // layout so dashboard tasks can be dropped on the right rail timeline,
  // and board tasks can be dropped on the right rail too. Nested DndContext
  // inside BoardView still works for sortable card reordering — events
  // bubble correctly.
  const [activeDragTaskUid, setActiveDragTaskUid] = useState<string | null>(null)
  const [dragGhostTitle, setDragGhostTitle] = useState<string>('')
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } }),
  )
  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    if (!id.startsWith('task:')) return
    setActiveDragTaskUid(id.slice(5))
    setDragGhostTitle(String(e.active.data.current?.title || 'Task'))
  }
  async function handleDragEnd(e: DragEndEvent) {
    setActiveDragTaskUid(null); setDragGhostTitle('')
    const activeId = String(e.active.id)
    const overId = e.over ? String(e.over.id) : null
    if (!activeId.startsWith('task:') || !overId || !overId.startsWith('cal:')) return
    const taskUid = activeId.slice(5)
    // overId format: cal:YYYY-MM-DD:H  (H is integer hour)
    const [, dateStr, hourStr] = overId.split(':')
    const hour = Number(hourStr)
    if (isNaN(hour)) return
    const startTime = `${String(hour).padStart(2, '0')}:00`
    const endTime = `${String(Math.min(23, hour + 1)).padStart(2, '0')}:00`
    try {
      await db.tasks.where('uid').equals(taskUid).modify({
        scheduledDate: dateStr,
        dueDate: dateStr,
        startTime, endTime,
        itemType: 'event', // promote so it renders on the calendar
      })
    } catch (err) {
      console.error('Failed to schedule task via drag', err)
      setDbError(err instanceof Error ? err.message : 'Could not schedule task')
      return
    }
    // Notify any open calendar / right rail to refresh
    window.dispatchEvent(new CustomEvent('task-scheduled', {
      detail: { uid: taskUid, dateStr, startTime, endTime },
    }))
  }

  // Wire the global Dexie-error reporter to a toast in this layout.
  // Any call to reportDbError() / safeDbWrite() from anywhere in the
  // app will surface here.
  useEffect(() => {
    registerErrorHandler((msg) => setDbError(msg))
  }, [])

  // First-run onboarding — silently seed the Getting Started page in the
  // background and let the interactive Tour handle the welcome. The 3-step
  // welcome modal was redundant with the Tour (modal pitched the product;
  // Tour teaches with real UI highlights). Skipping it removes 4 clicks
  // from a new user's first session.
  useEffect(() => {
    const checkOnboarding = async () => {
      const done = await db.settings
        .where('key').equals('onboarding_complete').first()
      if (done) return

      const pageCount = await db.pages.count()
      if (pageCount === 0) {
        // Seed silently — no modal. Tour fires after this completes.
        try {
          const { GETTING_STARTED_BLOCKS } = await import('@/lib/gettingStarted')
          const { nanoid } = await import('nanoid')
          const uid = nanoid()
          const now = new Date().toISOString()
          await db.pages.add({
            uid, title: 'Getting Started', icon: '\u{1F44B}',
            parentUid: null, isFavorite: false, inTrash: false, order: 0,
            createdAt: now, updatedAt: now,
          })
          await db.blocks.bulkAdd(GETTING_STARTED_BLOCKS.map((b, i) => ({
            uid: nanoid(), pageUid: uid,
            type: b.type, content: b.content, checked: false, order: i,
            createdAt: now, updatedAt: now,
          })))
          await db.settings.add({ key: 'onboarding_complete', value: 'true' })
          setSidebarRefreshKey(k => k + 1)
        } catch (err) {
          console.error('Onboarding seed failed', err)
        }
      } else {
        await db.settings.add({ key: 'onboarding_complete', value: 'true' })
      }
    }
    checkOnboarding()
  }, [])

  // Tour: after onboarding completes (or for existing users who already
  // have onboarding_complete=true but never saw the tour), run the
  // interactive Tour once. Skipped if tour_complete is already set.
  useEffect(() => {
    if (showOnboarding) return  // wait until the welcome modal closes
    const check = async () => {
      const tourDone = await db.settings.where('key').equals('tour_complete').first()
      if (tourDone) return
      // Only show the tour on the dashboard — it points at dashboard elements.
      if (typeof window !== 'undefined' && window.location.pathname !== '/') return
      setShowTour(true)
    }
    // Slight delay so the dashboard has time to mount and the
    // [data-tour] anchors are in the DOM before the tour reads them.
    const t = setTimeout(check, 600)
    return () => clearTimeout(t)
  }, [showOnboarding])

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
      // Single read of all settings, then look up by key in memory.
      // Previously this fired ~14 sequential Dexie queries.
      const allSettings = await db.settings.toArray()
      const settingsMap = new Map(allSettings.map(s => [s.key, s.value]))
      const get = (k: string) => {
        const v = settingsMap.get(k)
        return v == null ? undefined : { value: v }
      }
      const font = get('font')
      if (font?.value && font.value !== 'System Default') {
        // Defer font-link injection to next frame so we don't block the
        // initial paint with synchronous DOM appends + an external stylesheet.
        if (!document.querySelector('link[data-fluent-fonts]')) {
          requestAnimationFrame(() => {
            const head = document.head
            const frag = document.createDocumentFragment()
            if (!document.querySelector('link[href="https://fonts.googleapis.com"]')) {
              const pc1 = document.createElement('link')
              pc1.rel = 'preconnect'
              pc1.href = 'https://fonts.googleapis.com'
              frag.appendChild(pc1)
            }
            if (!document.querySelector('link[href="https://fonts.gstatic.com"]')) {
              const pc2 = document.createElement('link')
              pc2.rel = 'preconnect'
              pc2.href = 'https://fonts.gstatic.com'
              pc2.crossOrigin = 'anonymous'
              frag.appendChild(pc2)
            }
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=Lexend:wght@400;500;600;700&family=Lato:wght@400;700&family=Source+Sans+3:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&family=Merriweather:wght@400;700&family=Lora:wght@400;600;700&family=JetBrains+Mono:wght@400;500;700&family=Fira+Code:wght@400;500;700&family=Source+Code+Pro:wght@400;600;700&display=swap'
            link.setAttribute('data-fluent-fonts', 'true')
            frag.appendChild(link)
            head.appendChild(frag)
          })
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

      // Workspace skin — sidebar pattern + accent gradient. Applied early
      // so the sidebar paints with the chosen pattern on first render.
      const sidebarPattern = get('sidebar_pattern')
      applySidebarPattern((sidebarPattern?.value as SidebarPattern) || 'none')
      const accentGradTo = get('accent_gradient_to')
      applyAccentGradient(accentGradTo?.value || null)

      const palette = get('palette')
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light'
      if (palette?.value && palette.value !== 'Default') {
        // Re-apply palette vars on load — import the palette list dynamically would be heavy,
        // so we store just accent + accent-light in settings
        const accentSetting = get('palette_accent')
        const accentLightSetting = get('palette_accent_light')
        if (accentSetting?.value) document.documentElement.style.setProperty('--accent', accentSetting.value)
        if (accentLightSetting?.value) document.documentElement.style.setProperty('--accent-light', accentLightSetting.value)

        // Only apply palette bg overrides in light mode — in dark mode the
        // [data-theme="dark"] CSS rule must win, not the saved light-palette values
        if (currentTheme !== 'dark') {
          const bgPrimary = get('palette_bg_primary')
          const bgSecondary = get('palette_bg_secondary')
          const bgSidebar = get('palette_bg_sidebar')
          if (bgPrimary?.value) document.documentElement.style.setProperty('--bg-primary', bgPrimary.value)
          if (bgSecondary?.value) document.documentElement.style.setProperty('--bg-secondary', bgSecondary.value)
          if (bgSidebar?.value) document.documentElement.style.setProperty('--bg-sidebar', bgSidebar.value)
        }
      }

      const bgKeys = ['bg_trackers', 'bg_finance', 'bg_board']
      for (const key of bgKeys) {
        const setting = get(key)
        if (setting?.value) {
          document.documentElement.style.setProperty(`--${key}`, `url(${setting.value})`)
          const opSetting = get(`${key}_opacity`)
          if (opSetting?.value) {
            document.documentElement.style.setProperty('--bg-overlay-opacity', String(Number(opSetting.value) / 100))
          }
        }
      }
      // Load interface style
      const styleS = get('interface_style')
      if (styleS?.value) {
        document.documentElement.setAttribute('data-style', styleS.value)
      }
      // Load radius style
      const radiusS = get('radius_style')
      if (radiusS?.value) {
        document.documentElement.setAttribute('data-corners', radiusS.value)
      }
      // Load border strength
      const borderS = get('border_strength')
      if (borderS?.value) {
        const v = Number(borderS.value)
        document.documentElement.style.setProperty('--border-opacity', String(v / 3))
        document.documentElement.style.setProperty('--border-width', v === 0 ? '0px' : v <= 1 ? '1px' : '2px')
      }
      // Load shadow depth
      const shadowS = get('shadow_depth')
      if (shadowS?.value) {
        document.documentElement.style.setProperty('--shadow-intensity', String(Number(shadowS.value) / 100))
      }
      // Load layout density
      const densityS = get('layout_density')
      if (densityS?.value) {
        document.documentElement.setAttribute('data-density', densityS.value)
      }
      // Load font size
      const fontSizeS = get('font_size')
      if (fontSizeS?.value) {
        const sizeMap: Record<string, string> = { xs: '12px', s: '13px', m: '14px', l: '16px', xl: '18px' }
        document.documentElement.style.setProperty('font-size', sizeMap[fontSizeS.value] || '14px')
      }
      // Load calendar event style
      const calStyleS = get('calendar_event_style')
      if (calStyleS?.value) document.documentElement.setAttribute('data-cal-style', calStyleS.value)
      // Load border strength
      const borderS2 = get('border_strength')
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
    <DndContext
      sensors={dndSensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
      ) : leftVisible ? (
        <LeftSidebar
          collapsed={false}
          toggleLeft={toggleLeft}
          refreshKey={sidebarRefreshKey}
        />
      ) : null}

      {/* Floating left-edge expand tab — symmetric with the right one. */}
      {!isMobile && !leftVisible && (
        <button
          onClick={toggleLeft}
          aria-label="Show left sidebar"
          className="rail-toggle rail-toggle-left"
        >
          <ChevronRight size={16} />
        </button>
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
      {!isMobile && effectiveRightVisible && <RightRail toggleRight={toggleRight} />}

      {!isMobile && !effectiveRightVisible && (
        <button
          onClick={toggleRight}
          aria-label="Show right sidebar"
          className="rail-toggle rail-toggle-right"
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

      {/* OnboardingModal kept as a component for future use, but not
          rendered — first-run is now silent-seed + Tour. */}

      {dbError && (
        <ErrorToast
          message={dbError}
          onDismiss={() => setDbError(null)}
        />
      )}

      {showTour && <Tour onClose={() => setShowTour(false)} />}
    </div>

    {/* Floating ghost while a task is being dragged across panes. */}
    <DragOverlay>
      {activeDragTaskUid ? (
        <div style={{
          padding: '8px 14px', borderRadius: '8px',
          background: 'var(--bg-primary)', color: 'var(--text-primary)',
          border: '1px solid var(--accent)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          fontSize: '13px', fontWeight: 500,
          maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', cursor: 'grabbing',
        }}>{dragGhostTitle}</div>
      ) : null}
    </DragOverlay>
    </DndContext>
  )
}

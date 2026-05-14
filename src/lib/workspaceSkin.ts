// Workspace-skin helpers: sidebar background patterns + accent gradient.
// Settings keys: 'sidebar_pattern' (none|dots|grid) and 'accent_gradient_to'
// (hex string or empty). Applied via CSS variables on :root so they cascade
// to all consumers (sidebar bg, avatar circles, etc.).

export type SidebarPattern = 'none' | 'dots' | 'grid'

// SVG patterns as data-URIs. Neutral grey at very low alpha so they read on
// both light and dark sidebars without re-encoding per theme.
const PATTERN_DATA: Record<Exclude<SidebarPattern, 'none'>, string> = {
  dots: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='2' cy='2' r='1' fill='%23808080' opacity='0.18'/></svg>")`,
  grid: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><path d='M 24 0 L 0 0 0 24' fill='none' stroke='%23808080' stroke-opacity='0.10' stroke-width='1'/></svg>")`,
}

export function applySidebarPattern(pattern: SidebarPattern) {
  const root = document.documentElement
  if (pattern === 'none') {
    root.style.setProperty('--sidebar-pattern', 'none')
  } else {
    root.style.setProperty('--sidebar-pattern', PATTERN_DATA[pattern])
  }
}

// Accent gradient — when set, --accent-gradient becomes a 135° two-stop
// gradient from the current --accent to the picked colour. When empty,
// --accent-gradient falls back to a flat var(--accent) so consumers using
// `background: var(--accent-gradient)` always render correctly.
export function applyAccentGradient(toColor: string | null) {
  const root = document.documentElement
  if (!toColor) {
    root.style.setProperty('--accent-gradient', 'var(--accent)')
  } else {
    root.style.setProperty('--accent-gradient', `linear-gradient(135deg, var(--accent), ${toColor})`)
  }
}

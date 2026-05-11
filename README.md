# Fluent — local-first productivity workspace

Pages, tasks, calendar, trackers, and finance in one app. Everything lives in your browser via IndexedDB — no account, no sync, works offline.

## Features

- **Today dashboard** — greeting, KPIs, schedule, tasks, tracker rings, recent pages
- **Pages** — block-based editor (TipTap) with slash menu, toggles, callouts, embedded databases
- **Calendar** — week / day / month / agenda views, recurring events, drag/resize, floating-button create on mobile
- **Kanban board** — drag cards across To Do / In Progress / Done with priority + drag handles
- **Canvas** — free-form text + image boxes with drag/resize/snap-to-grid
- **Trackers** — counters, values, habits, and **mood/scale** types. Ring grid on the dashboard with streak badges, 7-day mini heatmaps, and Daylio-style year-in-pixels for mood. Cross-tracker correlation insights.
- **Finance** — income/expense logging, monthly tiles, category management, currency picker
- **Command palette** (`⌘K`) — cross-app search across pages, tasks, trackers, finance entries; switch theme, time format, navigate, instantiate templates
- **Quick capture** (`⌘⇧N`) — universal page/task/event creator
- **Customisation** — Sculpt (neumorphic) interface mode with a 5-level elevation system, Flat mode, theme palettes, density, font, corner style, border weight, shadow depth

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **State:** Zustand (`pages`, `trackers` stores)
- **Storage:** Dexie (IndexedDB)
- **Editor:** TipTap 3
- **Drag/drop:** dnd-kit
- **Recurrence:** rrule
- **Charts:** recharts
- **Icons:** lucide-react

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The Onboarding modal will create a "Getting Started" page on first run.

```bash
npm run build  # production build
npm run start  # start built server
npm run lint   # eslint
```

## Keyboard shortcuts

Press `⌘?` in the app for the full list. Highlights:

| Shortcut | Action |
|---|---|
| `⌘K` | Command palette / cross-app search |
| `⌘⇧N` | Quick capture (page / task / event) |
| `⌘1 / 2 / 3` | Switch quick-capture kind |
| `N` | Create calendar event at 9am today (week/day) |
| `T` | Calendar — go to today |
| `/` | Open block menu in editor |

## Design system

**Sculpt mode** uses a 5-level elevation system inspired by Apple System Settings, Things 3, and Bear:

- `--sculpt-l1` flat / disabled
- `--sculpt-l2` hover lift
- `--sculpt-l3` raised (default for buttons + cards)
- `--sculpt-l4` modal / floating panel
- `--sculpt-l5` popover / FAB

Each recipe pairs an inner highlight + hairline rim + dual outer drop shadow. Dark mode swaps the recipe but keeps the elevation contract.

The colour system follows the **60-30-10 rule**: 60% neutral background, 30% structural elements (text, borders, ring tracks), 10% accent (primary actions, filled progress, streak badges).

## Architecture notes

- **Local-first.** No backend; IndexedDB persists across reloads. Multiple tabs sync via `storage` events + custom `*-changed` events.
- **Stores.** Pages and trackers have Zustand stores; tasks/finance/canvas live in component-level state (refactor to stores is open).
- **Sculpt CSS specificity.** Override rules need to match the global rule's specificity (`button:not([data-no-sculpt])` = 0,2,1) — use the same `:not()` chain in your override or it loses.
- **Accessibility.** Most modals use `role="dialog"`. The `[data-flat]` attribute opts a subtree out of sculpt elevation. The `data-no-sculpt` attribute opts a single button out.

## License

Private.

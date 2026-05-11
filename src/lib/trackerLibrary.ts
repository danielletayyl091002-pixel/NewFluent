// Curated tracker library — 50+ entries across 8 research-backed categories.
// References: Habi 50+ habits, Strides 150+ templates, Akiflow habit guide,
// James Clear's habit-tracking research (3-5 habits to start, then add).
//
// Each entry:
//   - icon: must match a name in src/components/trackers/TrackerGrid.tsx ICONS
//   - color: tracker accent (10% colour usage on dashboard rings)
//   - description: 1-line ~60 chars, shown in the library card

export type TrackerCategory =
  | 'health'
  | 'mind'
  | 'productivity'
  | 'routines'
  | 'money'
  | 'learning'
  | 'social'
  | 'break'

export interface LibraryTracker {
  name: string
  icon: string
  unit: string
  target: number
  color: string
  type: 'counter' | 'value' | 'habit' | 'select'
  options?: string[]
  category: TrackerCategory
  description: string
}

export const CATEGORY_LABELS: Record<TrackerCategory, { label: string; emoji: string }> = {
  health:       { label: 'Health & Body',  emoji: '💪' },
  mind:         { label: 'Mind & Mood',    emoji: '🧠' },
  productivity: { label: 'Productivity',   emoji: '⚡' },
  routines:     { label: 'Routines',       emoji: '🌅' },
  money:        { label: 'Money',          emoji: '💰' },
  learning:     { label: 'Learning',       emoji: '📚' },
  social:       { label: 'Social',         emoji: '🤝' },
  break:        { label: 'Break habits',   emoji: '🚫' },
}

export const TRACKER_LIBRARY: LibraryTracker[] = [
  // ── Health & Body ───────────────────────────────────────────────
  { name: 'Water', icon: 'droplets', unit: 'cups', target: 8, color: '#3B82F6',
    type: 'counter', category: 'health',
    description: '8 glasses a day for hydration.' },
  { name: 'Sleep', icon: 'moon', unit: 'hours', target: 8, color: '#8B5CF6',
    type: 'value', category: 'health',
    description: 'Hours slept last night.' },
  { name: 'Steps', icon: 'footprints', unit: 'steps', target: 10000, color: '#F59E0B',
    type: 'value', category: 'health',
    description: 'Daily step count toward 10k.' },
  { name: 'Workout', icon: 'dumbbell', unit: 'min', target: 30, color: '#EF4444',
    type: 'value', category: 'health',
    description: 'Minutes of strength or cardio.' },
  { name: 'Stretching', icon: 'wind', unit: 'min', target: 10, color: '#14B8A6',
    type: 'value', category: 'health',
    description: 'Mobility / yoga minutes.' },
  { name: 'Vitamins', icon: 'pill', unit: '', target: 1, color: '#22C55E',
    type: 'habit', category: 'health',
    description: 'Took your daily vitamins.' },
  { name: 'Skincare', icon: 'sun', unit: '', target: 1, color: '#EC4899',
    type: 'habit', category: 'health',
    description: 'Morning + evening skincare done.' },
  { name: 'Meals home-cooked', icon: 'salad', unit: 'meals', target: 3, color: '#84CC16',
    type: 'counter', category: 'health',
    description: 'Meals you cooked vs. ordered out.' },
  { name: 'Fruits & veg', icon: 'apple', unit: 'servings', target: 5, color: '#22C55E',
    type: 'counter', category: 'health',
    description: 'Servings of fruits + veg today.' },

  // ── Mind & Mood ─────────────────────────────────────────────────
  { name: 'Mood', icon: 'smile', unit: '', target: 0, color: '#EC4899',
    type: 'select', options: ['😢','😕','😐','🙂','😊'], category: 'mind',
    description: 'How you felt today on a 5-emoji scale.' },
  { name: 'Energy', icon: 'zap', unit: '', target: 0, color: '#F59E0B',
    type: 'select', options: ['Drained','Low','OK','Good','Buzzing'], category: 'mind',
    description: 'Your energy level on a 5-point scale.' },
  { name: 'Anxiety', icon: 'brain', unit: '', target: 0, color: '#A855F7',
    type: 'select', options: ['Calm','OK','Tense','Anxious','Overwhelmed'], category: 'mind',
    description: 'Anxiety level — spot patterns over time.' },
  { name: 'Meditation', icon: 'wind', unit: 'min', target: 10, color: '#14B8A6',
    type: 'value', category: 'mind',
    description: 'Minutes of meditation or breathwork.' },
  { name: 'Gratitude', icon: 'heart', unit: 'entries', target: 3, color: '#EC4899',
    type: 'counter', category: 'mind',
    description: 'Things you wrote down that you\'re grateful for.' },
  { name: 'Therapy', icon: 'brain', unit: '', target: 1, color: '#8B5CF6',
    type: 'habit', category: 'mind',
    description: 'Attended therapy today.' },
  { name: 'Journal', icon: 'pen-line', unit: '', target: 1, color: '#6366F1',
    type: 'habit', category: 'mind',
    description: 'Wrote a journal entry today.' },

  // ── Productivity ────────────────────────────────────────────────
  { name: 'Focus blocks', icon: 'timer', unit: 'blocks', target: 4, color: '#6366F1',
    type: 'counter', category: 'productivity',
    description: 'Pomodoros or deep-work blocks completed.' },
  { name: 'Deep work', icon: 'target', unit: 'hours', target: 3, color: '#3B82F6',
    type: 'value', category: 'productivity',
    description: 'Hours of uninterrupted focused work.' },
  { name: 'Tasks done', icon: 'star', unit: 'tasks', target: 5, color: '#F59E0B',
    type: 'counter', category: 'productivity',
    description: 'Tasks ticked off your list today.' },
  { name: 'Inbox zero', icon: 'target', unit: '', target: 1, color: '#10B981',
    type: 'habit', category: 'productivity',
    description: 'Hit inbox zero by end of day.' },
  { name: 'Plan tomorrow', icon: 'pen-line', unit: '', target: 1, color: '#A855F7',
    type: 'habit', category: 'productivity',
    description: 'Wrote tomorrow\'s top 3 before bed.' },
  { name: 'Productivity rating', icon: 'trending-up', unit: '', target: 0, color: '#3B82F6',
    type: 'select', options: ['1','2','3','4','5'], category: 'productivity',
    description: 'Self-rate today\'s productivity 1-5.' },

  // ── Routines ────────────────────────────────────────────────────
  { name: 'Made bed', icon: 'bed', unit: '', target: 1, color: '#A855F7',
    type: 'habit', category: 'routines',
    description: 'Made the bed this morning.' },
  { name: 'Morning routine', icon: 'sun', unit: '', target: 1, color: '#F59E0B',
    type: 'habit', category: 'routines',
    description: 'Completed your full morning routine.' },
  { name: 'Evening routine', icon: 'moon', unit: '', target: 1, color: '#8B5CF6',
    type: 'habit', category: 'routines',
    description: 'Wind-down routine before bed.' },
  { name: 'Wake-up time', icon: 'sun', unit: '', target: 0, color: '#F59E0B',
    type: 'select', options: ['Before 6','6-7','7-8','8-9','After 9'], category: 'routines',
    description: 'Track when you actually woke up.' },
  { name: 'House clean', icon: 'leaf', unit: '', target: 1, color: '#22C55E',
    type: 'habit', category: 'routines',
    description: 'Tidied or cleaned today.' },
  { name: 'Laundry', icon: 'leaf', unit: '', target: 1, color: '#84CC16',
    type: 'habit', category: 'routines',
    description: 'Did a load of laundry.' },

  // ── Money ───────────────────────────────────────────────────────
  { name: 'No-spend day', icon: 'dollar-sign', unit: '', target: 1, color: '#10B981',
    type: 'habit', category: 'money',
    description: 'Spent nothing on wants today.' },
  { name: 'Saved', icon: 'dollar-sign', unit: 'units', target: 50, color: '#10B981',
    type: 'value', category: 'money',
    description: 'How much you saved or invested today.' },
  { name: 'Budget reviewed', icon: 'bar-chart-2', unit: '', target: 1, color: '#3B82F6',
    type: 'habit', category: 'money',
    description: 'Reviewed your weekly budget.' },
  { name: 'Subscription audit', icon: 'bar-chart-2', unit: '', target: 1, color: '#8B5CF6',
    type: 'habit', category: 'money',
    description: 'Reviewed recurring charges this month.' },

  // ── Learning ────────────────────────────────────────────────────
  { name: 'Reading', icon: 'book-open', unit: 'pages', target: 20, color: '#A855F7',
    type: 'value', category: 'learning',
    description: 'Pages read today.' },
  { name: 'Course', icon: 'book-open', unit: 'min', target: 30, color: '#6366F1',
    type: 'value', category: 'learning',
    description: 'Minutes spent on an online course.' },
  { name: 'Language practice', icon: 'brain', unit: 'min', target: 15, color: '#EC4899',
    type: 'value', category: 'learning',
    description: 'Minutes on Duolingo / language app.' },
  { name: 'Instrument practice', icon: 'music', unit: 'min', target: 30, color: '#F59E0B',
    type: 'value', category: 'learning',
    description: 'Practice minutes on an instrument.' },
  { name: 'Podcast / audiobook', icon: 'headphones', unit: 'min', target: 30, color: '#14B8A6',
    type: 'value', category: 'learning',
    description: 'Minutes of educational listening.' },
  { name: 'New word', icon: 'pen-line', unit: '', target: 1, color: '#6366F1',
    type: 'habit', category: 'learning',
    description: 'Learned and wrote down a new word.' },

  // ── Social ──────────────────────────────────────────────────────
  { name: 'Called family', icon: 'heart', unit: '', target: 1, color: '#EC4899',
    type: 'habit', category: 'social',
    description: 'Called or messaged a family member.' },
  { name: 'Friend hangout', icon: 'heart', unit: '', target: 1, color: '#F59E0B',
    type: 'habit', category: 'social',
    description: 'Spent time with a friend (in-person or call).' },
  { name: 'Date night', icon: 'wine', unit: '', target: 1, color: '#A855F7',
    type: 'habit', category: 'social',
    description: 'Quality time with your partner.' },
  { name: 'Random act of kindness', icon: 'star', unit: '', target: 1, color: '#22C55E',
    type: 'habit', category: 'social',
    description: 'One thoughtful thing for someone today.' },
  { name: 'Compliments given', icon: 'smile', unit: '', target: 1, color: '#EC4899',
    type: 'counter', category: 'social',
    description: 'Genuine compliments given today.' },

  // ── Break habits ────────────────────────────────────────────────
  { name: 'No alcohol', icon: 'wine', unit: '', target: 1, color: '#78716C',
    type: 'habit', category: 'break',
    description: 'Mark each alcohol-free day.' },
  { name: 'No caffeine after noon', icon: 'coffee', unit: '', target: 1, color: '#78716C',
    type: 'habit', category: 'break',
    description: 'No caffeine past 12pm — for better sleep.' },
  { name: 'Screen time under 2h', icon: 'tv', unit: '', target: 1, color: '#EF4444',
    type: 'habit', category: 'break',
    description: 'Stayed under 2h of social/entertainment screens.' },
  { name: 'No fast food', icon: 'pizza', unit: '', target: 1, color: '#EF4444',
    type: 'habit', category: 'break',
    description: 'Skipped fast food today.' },
  { name: 'No phone in bed', icon: 'bed', unit: '', target: 1, color: '#8B5CF6',
    type: 'habit', category: 'break',
    description: 'No scrolling in bed before sleep.' },
  { name: 'No sugar', icon: 'pizza', unit: '', target: 1, color: '#EC4899',
    type: 'habit', category: 'break',
    description: 'Mark each sugar-free day.' },
  { name: 'No social media', icon: 'tv', unit: '', target: 1, color: '#EF4444',
    type: 'habit', category: 'break',
    description: 'Stayed off social media platforms today.' },
]

import { Block } from '@/db/schema'

// Content for the Getting Started page created by OnboardingModal
// on first run. Only uses Block.type values from the schema union.
export const GETTING_STARTED_BLOCKS: Pick<Block, 'type' | 'content'>[] = [
  { type: 'heading1', content: 'Welcome to Fluent' },
  { type: 'text',     content: 'Fluent is your all-in-one workspace for notes, tasks, finance, and calendar — all stored locally on your device.' },
  { type: 'heading2', content: 'What you can do' },
  { type: 'bullet',   content: 'Write notes and documents in the Page editor' },
  { type: 'bullet',   content: 'Manage tasks in the Kanban board' },
  { type: 'bullet',   content: 'Track habits and goals in Trackers' },
  { type: 'bullet',   content: 'Log income and expenses in Finance' },
  { type: 'bullet',   content: 'Schedule events in the Calendar' },
  { type: 'heading2', content: 'Quick tips' },
  { type: 'bullet',   content: 'Press / to open the block menu' },
  { type: 'bullet',   content: 'Press Cmd+K to search everything' },
  { type: 'bullet',   content: 'Press Cmd+Shift+N to create a new page instantly' },
  { type: 'bullet',   content: 'Press Cmd+? to see all keyboard shortcuts' },
  { type: 'divider',  content: '' },
  { type: 'text',     content: 'Delete this page anytime and start fresh. Fluent saves everything automatically.' },
]

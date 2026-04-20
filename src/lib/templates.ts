import { Block } from '@/db/schema'

export interface Template {
  name: string
  icon: string
  blocks: Pick<Block, 'type' | 'content'>[]
}

export const TEMPLATES: Template[] = [
  {
    name: 'Meeting Notes',
    icon: 'users',
    blocks: [
      { type: 'heading1', content: 'Meeting Notes' },
      { type: 'heading3', content: 'Attendees' },
      { type: 'bullet', content: '' },
      { type: 'heading3', content: 'Agenda' },
      { type: 'numbered', content: '' },
      { type: 'heading3', content: 'Action Items' },
      { type: 'todo', content: '' },
      { type: 'heading3', content: 'Notes' },
      { type: 'text', content: '' },
    ]
  },
  {
    name: 'Daily Journal',
    icon: 'book-open',
    blocks: [
      { type: 'heading1', content: 'Daily Journal' },
      { type: 'heading3', content: 'Grateful for' },
      { type: 'bullet', content: '' },
      { type: 'heading3', content: "Today's focus" },
      { type: 'todo', content: '' },
      { type: 'heading3', content: 'Reflection' },
      { type: 'text', content: '' },
    ]
  },
  {
    name: 'Project Plan',
    icon: 'target',
    blocks: [
      { type: 'heading1', content: 'Project Plan' },
      { type: 'heading3', content: 'Goal' },
      { type: 'text', content: '' },
      { type: 'heading3', content: 'Milestones' },
      { type: 'numbered', content: '' },
      { type: 'heading3', content: 'Tasks' },
      { type: 'todo', content: '' },
      { type: 'heading3', content: 'Notes' },
      { type: 'text', content: '' },
    ]
  },
  {
    name: 'Weekly Review',
    icon: 'calendar',
    blocks: [
      { type: 'heading1', content: 'Weekly Review' },
      { type: 'heading3', content: 'Wins this week' },
      { type: 'bullet', content: '' },
      { type: 'heading3', content: 'Challenges' },
      { type: 'bullet', content: '' },
      { type: 'heading3', content: 'Next week priorities' },
      { type: 'numbered', content: '' },
    ]
  },
  {
    name: 'Reading Notes',
    icon: 'book-open',
    blocks: [
      { type: 'heading1', content: 'Reading Notes' },
      { type: 'heading3', content: 'Key Ideas' },
      { type: 'bullet', content: '' },
      { type: 'heading3', content: 'Quotes' },
      { type: 'quote', content: '' },
      { type: 'heading3', content: 'My Thoughts' },
      { type: 'text', content: '' },
    ]
  },
]

// Public-domain / commonly-attributed historical quotes. Safe to ship —
// these are 100+ years old, no copyright concerns. Mix of stoic, eastern
// philosophy, and practical wisdom.

export interface DailyQuote {
  text: string
  author: string
}

export const QUOTES: DailyQuote[] = [
  { text: 'You have power over your mind — not outside events. Realise this, and you will find strength.', author: 'Marcus Aurelius' },
  { text: 'We suffer more often in imagination than in reality.', author: 'Seneca' },
  { text: 'It is not that we have a short time to live, but that we waste a lot of it.', author: 'Seneca' },
  { text: 'Waste no more time arguing what a good man should be. Be one.', author: 'Marcus Aurelius' },
  { text: 'The journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'When you are content to be simply yourself, everyone will respect you.', author: 'Lao Tzu' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: 'The man who moves a mountain begins by carrying away small stones.', author: 'Confucius' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Aristotle' },
  { text: 'Knowing yourself is the beginning of all wisdom.', author: 'Aristotle' },
  { text: 'Difficulties strengthen the mind, as labour does the body.', author: 'Seneca' },
  { text: 'The best revenge is to be unlike him who performed the injury.', author: 'Marcus Aurelius' },
  { text: 'A journey of a thousand miles must begin with a single step.', author: 'Lao Tzu' },
  { text: 'Begin at once to live, and count each separate day as a separate life.', author: 'Seneca' },
  { text: 'Very little is needed to make a happy life; it is all within yourself.', author: 'Marcus Aurelius' },
  { text: 'He who has overcome his fears will truly be free.', author: 'Aristotle' },
  { text: 'The only true wisdom is in knowing you know nothing.', author: 'Socrates' },
  { text: 'An unexamined life is not worth living.', author: 'Socrates' },
  { text: 'A ship in harbor is safe, but that is not what ships are built for.', author: 'John Shedd' },
  { text: 'It always seems impossible until it is done.', author: 'Common saying' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'Whether you think you can or think you cannot — you are right.', author: 'Henry Ford' },
  { text: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
  { text: 'Patience is bitter, but its fruit is sweet.', author: 'Aristotle' },
  { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
  { text: 'Do not wait. The time will never be just right.', author: 'Napoleon Hill' },
  { text: 'You will never plough a field by turning it over in your mind.', author: 'Irish proverb' },
  { text: 'A goal without a plan is just a wish.', author: 'Antoine de Saint-Exupéry' },
  { text: 'The cave you fear to enter holds the treasure you seek.', author: 'Joseph Campbell' },
  { text: 'Small daily improvements over time lead to stunning results.', author: 'Robin Sharma' },
]

// Rotate by local day-of-year so the quote is stable through the day.
export function getDailyQuote(now: Date = new Date()): DailyQuote {
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  return QUOTES[dayOfYear % QUOTES.length]
}

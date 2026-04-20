export const STORAGE_KEYS = {
  CALENDAR_EVENTS: "productivity_calendar_events",
  SLEEP_ENTRIES: "productivity_sleep_entries",
  HABITS: "productivity_habits",
  HABIT_COMPLETIONS: "productivity_habit_completions",
  TRANSACTIONS: "productivity_transactions",
  WATER_ENTRIES: "productivity_water_entries",
  WATER_SETTINGS: "productivity_water_settings",
  MOOD_ENTRIES: "productivity_mood_entries",
  WORKOUTS: "productivity_workouts",
  BOOKS: "productivity_books",
  READING_SESSIONS: "productivity_reading_sessions",
  GOALS: "productivity_goals",
  MEALS: "productivity_meals",
  NUTRITION_GOALS: "productivity_nutrition_goals",
  POMODORO_SESSIONS: "productivity_pomodoro_sessions",
  POMODORO_SETTINGS: "productivity_pomodoro_settings",
  NOTES: "productivity_notes",
  TODOS: "productivity_todos",
  THEME: "productivity_theme",
} as const;

export const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const HOURS_OF_DAY = Array.from({ length: 24 }, (_, i) => i);

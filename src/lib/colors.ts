export const EVENT_COLORS = {
  red: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300", dot: "bg-red-500" },
  orange: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", dot: "bg-orange-500" },
  yellow: { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300", dot: "bg-yellow-500" },
  green: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300", dot: "bg-green-500" },
  blue: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", dot: "bg-blue-500" },
  purple: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", dot: "bg-purple-500" },
  pink: { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-300", dot: "bg-pink-500" },
  gray: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300", dot: "bg-gray-500" },
} as const;

export type EventColor = keyof typeof EVENT_COLORS;

export const TRACKER_COLORS = {
  sleep: "from-indigo-500 to-purple-600",
  habits: "from-green-500 to-emerald-600",
  expenses: "from-amber-500 to-orange-600",
  water: "from-cyan-500 to-blue-600",
  mood: "from-pink-500 to-rose-600",
  fitness: "from-red-500 to-orange-600",
  reading: "from-violet-500 to-purple-600",
  goals: "from-teal-500 to-green-600",
  meals: "from-yellow-500 to-amber-600",
  pomodoro: "from-rose-500 to-red-600",
  notes: "from-slate-500 to-gray-600",
  todos: "from-blue-500 to-indigo-600",
} as const;

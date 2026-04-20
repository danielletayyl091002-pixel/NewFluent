import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addDays,
  differenceInMinutes,
  parseISO,
  isToday,
  isThisWeek,
  isThisMonth,
  isSameDay,
} from "date-fns";

export type DateString = string;
export type TimeString = string;

export function toDateString(date: Date): DateString {
  return format(date, "yyyy-MM-dd");
}

export function toTimeString(date: Date): TimeString {
  return format(date, "HH:mm");
}

export function formatDisplayDate(date: Date): string {
  return format(date, "MMM d, yyyy");
}

export function formatDisplayTime(time: TimeString): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function getWeekDates(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 0 });
  const end = endOfWeek(date, { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

export function getMonthGrid(date: Date): Date[][] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function getMinutesBetween(start: string, end: string): number {
  return differenceInMinutes(parseISO(end), parseISO(start));
}

export { format, parseISO, isToday, isThisWeek, isThisMonth, isSameDay, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval };

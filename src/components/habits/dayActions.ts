/* ============================================================
   Thin helpers that adapt the AppDataApi to date-based calls.
   Kept separate so components don't import the hook module
   just for types.
   ============================================================ */

export function toggleHabitForDate(
  toggle: (date: string, habitId: string) => void,
  date: string,
  habitId: string
): void {
  toggle(date, habitId);
}

export function setHabitValueForDate(
  set: (date: string, habitId: string, value: number) => void,
  date: string,
  habitId: string,
  value: number
): void {
  set(date, habitId, value);
}

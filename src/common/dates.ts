/** Calendar dates (no time of day) are exchanged as "YYYY-MM-DD" and stored as UTC midnight. */

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function toIsoDate(date: Date): string;
export function toIsoDate(date: Date | null): string | null;
export function toIsoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function todayUtc(now: Date = new Date()): Date {
  return parseIsoDate(toIsoDate(now));
}

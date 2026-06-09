/**
 * Calendar math for Trinidad Carnival.
 *
 * Carnival Monday is always Easter - 48 days (Monday before Ash Wednesday).
 * We compute Easter using the Meeus/Jones/Butcher Gregorian algorithm so we
 * don't have to store hardcoded dates per year.
 */

/** Returns Easter Sunday as a UTC Date for the given Gregorian year. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31);
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Returns Carnival Monday (Easter - 48 days) as a UTC Date for the given year. */
export function carnivalMonday(year: number): Date {
  const easter = easterSunday(year);
  return new Date(easter.getTime() - 48 * 24 * 60 * 60 * 1000);
}

/** Returns Carnival Monday as a YYYY-MM-DD string. */
export function carnivalMondayISO(year: number): string {
  return carnivalMonday(year).toISOString().slice(0, 10);
}

/**
 * Days between a calendar date and Carnival Monday of that carnival season's year.
 * Negative = before Carnival Monday, positive = after.
 */
export function daysFromCarnivalMonday(date: Date | string, year: number): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const cm = carnivalMonday(year);
  const ms = d.getTime() - cm.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

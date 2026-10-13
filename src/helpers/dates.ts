/** How a date field's day is shown when no format is asked for: "13 October 2026" (in English). */
const defaultFormat: Intl.DateTimeFormatOptions = { dateStyle: "long" };

export type AceDateFormat = Intl.DateTimeFormatOptions & {
  /** A language such as "en-GB". The default is the one the server or browser runs in. */
  locale?: string;
};

/**
 * A date field's day (a text such as "2026-10-13") as words, or null if it isn't a real day. A date field holds a
 * day with no time of day, so this never shifts it with a time zone: 13 October is 13 October everywhere.
 */
export function formatAceDate(date: string, format: AceDateFormat = {}): string | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parts) return null;
  const [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const moment = new Date(Date.UTC(year, month - 1, day));
  if (moment.getUTCFullYear() !== year || moment.getUTCMonth() !== month - 1 || moment.getUTCDate() !== day)
    return null;

  const { locale, ...options } = format;
  return new Intl.DateTimeFormat(locale, {
    ...(Object.keys(options).length > 0 ? options : defaultFormat),
    timeZone: "UTC",
  }).format(moment);
}

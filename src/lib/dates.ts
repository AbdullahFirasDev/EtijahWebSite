import type { Locale } from "@/content/site";

// Iraqi Arabic month names (كانون الثاني، شباط …) with Latin digits, matching the rest of the site.
const LOCALES: Record<Locale, string> = { ar: "ar-IQ-u-nu-latn", en: "en-GB" };

/** 'YYYY-MM-DD' (calendar date, no time zone) → Date at UTC midnight. */
export function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function formatDay(day: string | null | undefined, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  if (!day) return "";
  return new Intl.DateTimeFormat(LOCALES[locale], { ...opts, timeZone: "UTC" }).format(parseDay(day.slice(0, 10)));
}

export function formatDayShort(day: string | null | undefined, locale: Locale) {
  return formatDay(day, locale, { day: "numeric", month: "short", year: "numeric" });
}

/** Day + month parts for date "stubs" on cards. */
export function dayParts(day: string, locale: Locale) {
  const d = parseDay(day);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALES[locale], { ...o, timeZone: "UTC" }).format(d);
  return { day: f({ day: "numeric" }), month: f({ month: "short" }), year: f({ year: "numeric" }), weekday: f({ weekday: "long" }) };
}

/** Timestamp (ISO) → local date and time in Baghdad, for the staff portal. */
export function formatDateTime(iso: string | null | undefined, locale: Locale = "ar") {
  if (!iso) return "";
  return new Intl.DateTimeFormat(LOCALES[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Baghdad",
  }).format(new Date(iso));
}

/** Relative time in Arabic for staff lists ("قبل 5 دقائق"). */
export function timeAgo(iso: string, locale: Locale = "ar") {
  const diff = (Date.parse(iso) - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDateTime(iso, locale);
}

/** Today in Baghdad as 'YYYY-MM-DD'. */
export function todayDay(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date());
}

export function addDays(day: string, days: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

export const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

import type { Locale } from "@/content/site";
import { countryName } from "./countries";

/** One country / city of a multi-destination trip, with its own entry and exit dates. */
export interface TripDestination {
  country_code: string;
  city: string | null;
  entry_date: string | null;
  exit_date: string | null;
}

/** "Istanbul – Bursa, Türkiye · Tbilisi, Georgia": cities grouped by consecutive country. */
export function destinationsSummary(rows: Pick<TripDestination, "country_code" | "city">[], locale: Locale): string {
  const groups: { code: string; cities: string[] }[] = [];
  for (const r of rows) {
    const city = r.city?.trim() || null;
    const last = groups.at(-1);
    if (last?.code === r.country_code) {
      if (city && !last.cities.includes(city)) last.cities.push(city);
    } else groups.push({ code: r.country_code, cities: city ? [city] : [] });
  }
  return groups.map((g) => [g.cities.join(" – "), countryName(g.code, locale)].filter(Boolean).join(locale === "ar" ? "، " : ", ")).join(" · ");
}

/** First entry and last exit date over all destinations (null when none is set). */
export function destinationsSpan(rows: Pick<TripDestination, "entry_date" | "exit_date">[]) {
  const entries = rows.map((d) => d.entry_date).filter((x): x is string => !!x).sort();
  const exits = rows.map((d) => d.exit_date).filter((x): x is string => !!x).sort();
  return { start: entries[0] ?? null, end: exits.at(-1) ?? null };
}

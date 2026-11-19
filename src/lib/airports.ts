import { AIRPORT_ROWS } from "@/data/airports";

export interface Airport {
  code: string;
  country_code: string;
  name_ar: string;
  name_en: string;
}

/** Every airport in the reference list (Iraq first, then by destination country). */
export const ALL_AIRPORTS: Airport[] = AIRPORT_ROWS.map(([code, country_code, name_ar, name_en]) => ({ code, country_code, name_ar, name_en }));

/** Iraqi departure airports: the short list offered to the public in the request form. */
export const AIRPORTS: Airport[] = ALL_AIRPORTS.filter((a) => a.country_code === "IQ");

const BY_CODE = new Map(ALL_AIRPORTS.map((a) => [a.code, a]));

export const airportByCode = (code: string | null | undefined) => (code ? (BY_CODE.get(code.toUpperCase()) ?? null) : null);

/** "مطار إسطنبول (IST)": the label used in pickers and free-text flight fields. */
export const airportLabel = (a: Pick<Airport, "code" | "name_ar">) => `${a.name_ar} (${a.code})`;

/** Resolve what staff typed in an airport box: a label, an IATA code, or an exact Arabic/English name. */
export function findAirport(text: string, list: Airport[] = ALL_AIRPORTS): Airport | null {
  const t = text.trim();
  if (!t) return null;
  const code = /\(([A-Z]{3})\)\s*$/.exec(t)?.[1] ?? (/^[A-Za-z]{3}$/.test(t) ? t.toUpperCase() : null);
  if (code) {
    const hit = list.find((a) => a.code === code);
    if (hit) return hit;
  }
  const low = t.toLowerCase();
  return list.find((a) => a.name_ar === t || a.name_en.toLowerCase() === low) ?? null;
}

/** Compact form for flight legs (max 60 chars): the city in brackets or the name without "مطار … الدولي", plus the code. */
export function airportShort(a: Pick<Airport, "code" | "name_ar">): string {
  const city = /\(([^)]+)\)\s*$/.exec(a.name_ar)?.[1];
  const name = (city ?? a.name_ar.replace(/^مطار\s+/, "").replace(/\s+الدولي$/, "")).trim();
  return `${name} (${a.code})`.slice(0, 60);
}

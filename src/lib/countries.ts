import type { Locale } from "@/content/site";

// ISO 3166-1 alpha-2 codes. Popular destinations from Iraq first, then the rest alphabetically.
export const POPULAR_COUNTRIES = ["TR", "AE", "GE", "EG", "MY", "MV", "TH", "ID", "AZ", "LB", "JO", "IR", "SA", "SY", "QA", "OM", "GB", "FR", "IT", "DE", "ES", "AT", "CH", "RU", "CN", "JP", "LK", "TZ", "MA", "IQ"];

const ALL =
  "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW".split(" ");

export const COUNTRY_CODES = [...POPULAR_COUNTRIES, ...ALL.filter((c) => !POPULAR_COUNTRIES.includes(c))];

const displayNames: Partial<Record<Locale, Intl.DisplayNames>> = {};

export function countryName(code: string, locale: Locale): string {
  try {
    displayNames[locale] ??= new Intl.DisplayNames([locale], { type: "region" });
    return displayNames[locale]!.of(code) ?? code;
  } catch {
    return code;
  }
}

export const isCountry = (v: unknown): v is string => typeof v === "string" && ALL.includes(v);

/** Flag emoji from a country code (regional indicator symbols). */
export const flag = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

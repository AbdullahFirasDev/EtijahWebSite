// Money is stored as integer minor units (× 100) for every currency.
import type { Locale } from "@/content/site";

export const CURRENCIES = {
  USD: { ar: "دولار", en: "US$", nameAr: "دولار أمريكي", nameEn: "US Dollar" },
  IQD: { ar: "د.ع", en: "IQD", nameAr: "دينار عراقي", nameEn: "Iraqi Dinar" },
  EUR: { ar: "يورو", en: "€", nameAr: "يورو", nameEn: "Euro" },
  SAR: { ar: "ر.س", en: "SAR", nameAr: "ريال سعودي", nameEn: "Saudi Riyal" },
  AED: { ar: "د.إ", en: "AED", nameAr: "درهم إماراتي", nameEn: "UAE Dirham" },
  TRY: { ar: "ل.ت", en: "TRY", nameAr: "ليرة تركية", nameEn: "Turkish Lira" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];
export const isCurrency = (v: unknown): v is CurrencyCode => typeof v === "string" && v in CURRENCIES;

const grouping = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** 125000 (minor) → "1,250" ; 125050 → "1,250.50". Latin digits in both languages, like phone numbers. */
export function formatAmount(minor: number): string {
  const major = minor / 100;
  return Number.isInteger(major)
    ? grouping.format(major)
    : new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(major);
}

/** "1,250 دولار" in Arabic, "US$ 1,250" in English. */
export function formatMoney(minor: number, currency: string, locale: Locale): string {
  const c = CURRENCIES[currency as CurrencyCode];
  const label = c ? c[locale] : currency;
  const amount = formatAmount(minor);
  return locale === "ar" ? `${amount} ${label}` : `${label} ${amount}`;
}

export const currencyName = (currency: string, locale: Locale) => {
  const c = CURRENCIES[currency as CurrencyCode];
  return c ? (locale === "ar" ? c.nameAr : c.nameEn) : currency;
};

/** Parses staff input ("1,250.5", "١٢٥٠") into minor units, or null. */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  const normalized = input
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٫]/g, ".")
    .replace(/[,\s٬]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Minor units → editable string ("1250.5"). */
export const amountInput = (minor: number | null | undefined) => (minor == null ? "" : String(minor / 100));

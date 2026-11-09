import "server-only";
import { isCurrency, type CurrencyCode } from "@/lib/money";
import { all, run, tx } from "../db";

export interface PortalSettings {
  currencies: CurrencyCode[];
  default_currency: CurrencyCode;
  quote_validity_days: number;
  quote_terms_ar: string;
  quote_terms_en: string;
}

const DEFAULTS: PortalSettings = {
  currencies: ["USD", "IQD"],
  default_currency: "USD",
  quote_validity_days: 7,
  quote_terms_ar: "",
  quote_terms_en: "",
};

export function getSettings(): PortalSettings {
  const rows = all<{ key: string; value: string }>("SELECT key, value FROM settings WHERE key != 'app_secret'");
  const s: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) {
    try {
      s[r.key] = JSON.parse(r.value);
    } catch {
      /* ignore malformed */
    }
  }
  const currencies = (Array.isArray(s.currencies) ? s.currencies : DEFAULTS.currencies).filter(isCurrency) as CurrencyCode[];
  return {
    currencies: currencies.length ? currencies : DEFAULTS.currencies,
    default_currency: isCurrency(s.default_currency) ? s.default_currency : (currencies[0] ?? "USD"),
    quote_validity_days: Number(s.quote_validity_days) || DEFAULTS.quote_validity_days,
    quote_terms_ar: String(s.quote_terms_ar ?? ""),
    quote_terms_en: String(s.quote_terms_en ?? ""),
  };
}

export function saveSettings(input: PortalSettings) {
  tx(() => {
    for (const [key, value] of Object.entries(input)) {
      run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, JSON.stringify(value));
    }
  });
}

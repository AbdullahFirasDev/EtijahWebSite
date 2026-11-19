import "server-only";
import { site } from "@/content/site";
import { isCurrency, type CurrencyCode } from "@/lib/money";
import { col, tx } from "../db";

export interface PortalSettings {
  currencies: CurrencyCode[];
  default_currency: CurrencyCode;
  quote_validity_days: number;
  quote_terms_ar: string;
  quote_terms_en: string;
  /** Etijah's own details printed on Etijah-branded PDFs. */
  company_name_ar: string;
  company_name_en: string;
  company_phone: string;
  company_email: string;
  company_address_ar: string;
  company_address_en: string;
  /** Unified PDF template options (all companies share the layout; only identity changes). */
  pdf_show_hotel_photos: boolean;
  pdf_footer_note_ar: string;
  pdf_footer_note_en: string;
}

const DEFAULTS: PortalSettings = {
  currencies: ["USD", "IQD"],
  default_currency: "USD",
  quote_validity_days: 7,
  quote_terms_ar: "",
  quote_terms_en: "",
  company_name_ar: site.nameAr,
  company_name_en: site.nameEn,
  company_phone: site.phone.display,
  company_email: site.email ?? "",
  company_address_ar: `${site.address.streetAr}، ${site.address.cityAr}`,
  company_address_en: `${site.address.streetEn}, ${site.address.cityEn}`,
  pdf_show_hotel_photos: true,
  pdf_footer_note_ar: "",
  pdf_footer_note_en: "",
};

const HIDDEN = new Set(["app_secret"]);

export async function getSettings(): Promise<PortalSettings> {
  const rows = await (await col<{ _id: string; value: unknown }>("settings")).find({ _id: { $nin: [...HIDDEN] } }).toArray();
  const s: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) s[r._id] = r.value;
  const currencies = (Array.isArray(s.currencies) ? s.currencies : DEFAULTS.currencies).filter(isCurrency) as CurrencyCode[];
  const str = (k: keyof PortalSettings) => String(s[k] ?? DEFAULTS[k] ?? "");
  return {
    currencies: currencies.length ? currencies : DEFAULTS.currencies,
    default_currency: isCurrency(s.default_currency) ? s.default_currency : (currencies[0] ?? "USD"),
    quote_validity_days: Number(s.quote_validity_days) || DEFAULTS.quote_validity_days,
    quote_terms_ar: str("quote_terms_ar"),
    quote_terms_en: str("quote_terms_en"),
    company_name_ar: str("company_name_ar"),
    company_name_en: str("company_name_en"),
    company_phone: str("company_phone"),
    company_email: str("company_email"),
    company_address_ar: str("company_address_ar"),
    company_address_en: str("company_address_en"),
    pdf_show_hotel_photos: s.pdf_show_hotel_photos !== false,
    pdf_footer_note_ar: str("pdf_footer_note_ar"),
    pdf_footer_note_en: str("pdf_footer_note_en"),
  };
}

export async function saveSettings(input: Partial<PortalSettings>) {
  const settings = await col<{ _id: string; value: unknown }>("settings");
  await tx(async (session) => {
    for (const [key, value] of Object.entries(input)) {
      if (HIDDEN.has(key) || !(key in DEFAULTS)) continue;
      await settings.updateOne({ _id: key }, { $set: { value } }, { upsert: true, session });
    }
  });
}

import "server-only";
import { col } from "./db";
import { hotelPickerOptions } from "./repo/catalog";
import { listCompanies, type CompanyHotelDoc } from "./repo/companies";
import { getSettings } from "./repo/settings";

/** Option lists for the quote editor (companies with contacts and their hotel prices, programs, hotels). */
export async function quoteEditorOptions() {
  const [settings, companies, programs, hotels, access] = await Promise.all([
    getSettings(),
    listCompanies(),
    (await col<{ _id: number; title_ar: string; code: string; status: string; type: string; hotel_options: { id: string; hotel_id: number; room_ar: string | null }[] }>("programs"))
      .find({ status: { $ne: "archived" } }, { projection: { title_ar: 1, code: 1, status: 1, type: 1, "hotel_options.id": 1, "hotel_options.hotel_id": 1, "hotel_options.room_ar": 1 } })
      .sort({ updated_at: -1 })
      .toArray(),
    hotelPickerOptions({ includeCosts: true }),
    (await col<CompanyHotelDoc>("company_hotels")).find({}).toArray(),
  ]);
  const hotelName = new Map(hotels.map((h) => [h.id, h.name]));
  return {
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      hasLogo: !!c.branding?.logo_media_id,
      contacts: c.contacts.map((ct) => ({ id: ct.id, name: ct.name, phone: ct.phone, email: ct.email, is_primary: ct.is_primary })),
      hotelRates: access
        .filter((a) => a.company_id === c.id)
        .map((a) => ({ hotel_id: a.hotel_id, rates: a.rates.map((r) => ({ ...r, rate_id: r.rate_id })) })),
    })),
    programs: programs.map((p) => ({
      id: p._id,
      label: `${p.title_ar} (${p.code}${p.status === "published" ? "" : " · مسودة"})`,
      type: p.type,
      options: (p.hotel_options ?? []).map((o) => ({ id: o.id, label: [hotelName.get(o.hotel_id), o.room_ar].filter(Boolean).join(" — ") })),
    })),
    hotels,
    currencies: settings.currencies as string[],
    settings,
  };
}
export type QuoteEditorOptions = Awaited<ReturnType<typeof quoteEditorOptions>>;

import "server-only";
import { all } from "./db";
import { listHotels } from "./repo/catalog";
import { companyContacts, listCompanies } from "./repo/companies";
import { getSettings } from "./repo/settings";

/** Option lists for the quote editor (companies with contacts, programs, hotels). */
export function quoteEditorOptions() {
  const settings = getSettings();
  return {
    companies: listCompanies().map((c) => ({
      id: c.id,
      name: c.name,
      contacts: companyContacts(c.id).map((ct) => ({ id: ct.id, name: ct.name, phone: ct.phone, email: ct.email, is_primary: !!ct.is_primary })),
    })),
    programs: all<{ id: number; title_ar: string; code: string; status: string }>("SELECT id, title_ar, code, status FROM programs WHERE status != 'archived' ORDER BY updated_at DESC").map((p) => ({
      id: p.id,
      label: `${p.title_ar} (${p.code}${p.status === "published" ? "" : " · مسودة"})`,
    })),
    hotels: listHotels()
      .filter((h) => h.active)
      .map((h) => ({ id: h.id, name: h.name_ar, destination: h.dest_name_ar, stars: h.stars, hasLink: !!(h.website_url || h.maps_url) })),
    currencies: settings.currencies as string[],
    settings,
  };
}

import "server-only";
import type { WizardForm, WizardMeta } from "@/components/staff/ProgramWizard";
import { mediaByIds, mediaList } from "./media";
import type { ProgramEditorData } from "./repo/programs";

let n = 0;
const key = () => `s${++n}`;

/** Stored program → wizard form. Costs are dropped for roles that may not see them. */
export async function programToForm(p: ProgramEditorData, opts: { includeCosts: boolean }): Promise<{ form: WizardForm; meta: WizardMeta }> {
  const [cover, gallery] = await Promise.all([mediaByIds([p.cover_media_id]), mediaList(p.gallery)]);
  return {
    meta: { id: p.id, code: p.code, status: p.status, updated_at: p.updated_at, share: p.share },
    form: {
      type: p.type,
      visibility: p.visibility,
      featured: p.featured,
      title_ar: p.title_ar,
      title_en: p.title_en,
      slug: p.slug,
      summary_ar: p.summary_ar,
      summary_en: p.summary_en,
      description_ar: p.description_ar,
      description_en: p.description_en,
      destination_ids: p.destination_ids,
      duration_days: p.duration_days,
      duration_nights: p.duration_nights,
      currency: p.currency,
      airport: p.departure_airport,
      airline_ids: p.airline_ids,
      flights: p.flights.map((f) => ({ ...f, key: key() })),
      itinerary: p.itinerary.map((d) => ({ ...d, key: key() })),
      services: p.services,
      meals_ar: p.meals_ar,
      meals_en: p.meals_en,
      terms_ar: p.terms_ar,
      terms_en: p.terms_en,
      cover: p.cover_media_id ? (cover.get(p.cover_media_id) ?? null) : null,
      gallery,
      base_price: p.base_price || null,
      base_cost: opts.includeCosts ? p.base_cost : null,
      options: p.hotel_options.map((o) => ({
        key: key(),
        v: 0,
        id: o.id,
        hotel_id: o.hotel_id,
        room_type_id: o.room_type_id,
        room_ar: o.room_ar,
        room_en: o.room_en,
        occupancy: o.occupancy,
        board: o.board,
        nights: o.nights,
        basis: o.basis,
        night_price: o.night_price,
        night_cost: opts.includeCosts ? o.night_cost : null,
        source: o.source,
        rate_id: o.rate_snapshot?.rate_id ?? null,
        refresh_rate: false,
        snapshot: o.rate_snapshot ? { currency: o.rate_snapshot.currency, price: o.rate_snapshot.price, cost: opts.includeCosts ? o.rate_snapshot.cost : null, captured_at: o.rate_snapshot.captured_at } : null,
        fx_rate: o.fx_rate,
        final_price_override: o.final_price_override,
        note_ar: o.note_ar,
        note_en: o.note_en,
      })),
      extra_prices: p.extra_prices.map((x) => ({ ...x, key: key() })),
      price_note_ar: p.price_note_ar,
      price_note_en: p.price_note_en,
      departures: p.departures.map((d) => ({ ...d, key: key() })),
    },
  };
}

export function emptyProgramForm(currency: string, type: "fixed" | "custom" = "fixed"): WizardForm {
  return {
    type,
    visibility: "public",
    featured: false,
    title_ar: "",
    title_en: null,
    slug: null,
    summary_ar: null,
    summary_en: null,
    description_ar: null,
    description_en: null,
    destination_ids: [],
    duration_days: 8,
    duration_nights: 7,
    currency,
    airport: { code: "NJF", name_ar: "مطار النجف الأشرف الدولي", name_en: "Al Najaf International Airport" },
    airline_ids: [],
    flights: [],
    itinerary: [],
    services: [],
    meals_ar: null,
    meals_en: null,
    terms_ar: null,
    terms_en: null,
    cover: null,
    gallery: [],
    base_price: null,
    base_cost: null,
    options: [],
    extra_prices: [],
    price_note_ar: null,
    price_note_en: null,
    departures: [],
  };
}

import "server-only";
import { ALL_AIRPORTS } from "@/lib/airports";
import { COUNTRY_CODES, countryName } from "@/lib/countries";
import { airlineOptions } from "./repo/airlines";
import { hotelPickerOptions, listDestinations, listServices } from "./repo/catalog";
import { getSettings } from "./repo/settings";

const COUNTRY_ORDER = new Map(COUNTRY_CODES.map((c, i) => [c, i]));
const byCountryOrder = (a: string, b: string) => (COUNTRY_ORDER.get(a) ?? 999) - (COUNTRY_ORDER.get(b) ?? 999);

/** Destinations grouped for pickers: countries (popular first, names built on the server) and their cities. */
export async function destinationOptions(opts: { activeOnly?: boolean } = {}) {
  const rows = (await listDestinations()).filter((d) => !opts.activeOnly || d.active);
  const codes = [...new Set(rows.map((d) => d.country_code))].sort(byCountryOrder);
  return {
    countries: codes.map((code) => ({ code, name: countryName(code, "ar"), count: rows.filter((d) => d.country_code === code).length })),
    destinations: rows
      .sort((a, b) => byCountryOrder(a.country_code, b.country_code) || Number(a.kind === "area") - Number(b.kind === "area") || a.name_ar.localeCompare(b.name_ar, "ar"))
      .map((d) => ({ id: d.id, label: d.name_ar, name_en: d.name_en, country_code: d.country_code, country: countryName(d.country_code, "ar"), kind: d.kind ?? "city", airport_code: d.airport_code ?? null, active: d.active })),
  };
}

/** Option lists for the program wizard. Hotel costs are included only for roles allowed to see them. */
export async function catalogOptions(opts: { includeCosts: boolean }) {
  const [geo, hotels, services, settings, airlines] = await Promise.all([
    destinationOptions(),
    hotelPickerOptions(opts),
    listServices(true),
    getSettings(),
    airlineOptions(),
  ]);
  return {
    // Inactive destinations stay listed (marked) so a program that already uses one keeps it visible.
    destinations: geo.destinations,
    countries: geo.countries,
    hotels,
    services: services.map((s) => ({ id: s.id, icon: s.icon, name_ar: s.name_ar })),
    currencies: settings.currencies as string[],
    defaultCurrency: settings.default_currency as string,
    airlines,
    airports: ALL_AIRPORTS,
  };
}
export type CatalogOptions = Awaited<ReturnType<typeof catalogOptions>>;

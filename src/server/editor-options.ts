import "server-only";
import { countryName } from "@/lib/countries";
import { listDestinations, listHotels, listServices } from "./repo/catalog";
import { getSettings } from "./repo/settings";

/** Option lists shared by the program and quote editors. */
export function catalogOptions() {
  const destinations = listDestinations();
  return {
    destinations: destinations.filter((d) => d.active).map((d) => ({ id: d.id, label: d.name_ar, country: countryName(d.country_code, "ar") })),
    hotels: listHotels()
      .filter((h) => h.active)
      .map((h) => ({ id: h.id, name: h.name_ar, destination: `${h.dest_name_ar} — ${countryName(h.country_code, "ar")}`, destination_id: h.destination_id, stars: h.stars })),
    services: listServices(true).map((s) => ({ id: s.id, icon: s.icon, name_ar: s.name_ar })),
    currencies: getSettings().currencies as string[],
    settings: getSettings(),
  };
}

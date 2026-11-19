import "server-only";
import type { AirlineForm } from "@/components/staff/AirlineEditor";
import { COUNTRY_CODES, countryName } from "@/lib/countries";
import { mediaById } from "./media";
import { EMPTY_ISSUANCE, type AirlineDoc } from "./repo/airlines";

export async function airlineToForm(a: AirlineDoc | null): Promise<AirlineForm> {
  if (!a)
    return {
      id: null,
      name_ar: "",
      name_en: "",
      iata: null,
      logo: null,
      country_code: null,
      contact: { phone: null, email: null, website: null, person: null },
      internal_notes: null,
      status: "active",
      issuance: { ...EMPTY_ISSUANCE },
    };
  return {
    id: a._id,
    name_ar: a.name_ar,
    name_en: a.name_en,
    iata: a.iata,
    logo: await mediaById(a.logo_media_id),
    country_code: a.country_code,
    contact: a.contact,
    internal_notes: a.internal_notes,
    status: a.status,
    issuance: { ...EMPTY_ISSUANCE, ...a.issuance },
  };
}

export const countryOptions = () => COUNTRY_CODES.map((code) => ({ code, name: countryName(code, "ar") }));

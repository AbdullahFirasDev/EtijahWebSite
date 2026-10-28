// Verified company facts. Everything customer-facing that is "data" (not copy) lives here.

export const site = {
  nameAr: "الاتجاه للسياحة والسفر",
  nameEn: "Etijah Travel & Tourism",

  phone: {
    /** E.164, used for tel: links and structured data. */
    e164: "+9647826888850",
    /** Human-friendly grouping; always render inside dir="ltr". */
    display: "+964 782 688 8850",
  },

  whatsapp: {
    number: "9647826888850",
  },

  /**
   * The address supplied by the company was "etijah.etijah.net". It contains no "@",
   * so it is not a valid email address, and etijah.net currently has no reachable DNS
   * (checked 2026-10-28). Set this to the confirmed address to show it across the site.
   */
  email: null as string | null,

  address: {
    streetAr: "شارع الغدير كرامة، مجاور مصرف الخليج",
    cityAr: "النجف الأشرف",
    streetEn: "Ghadeer Karamah Street, next to Gulf Bank",
    cityEn: "Najaf",
    regionAr: "محافظة النجف",
    regionEn: "Najaf Governorate",
    countryCode: "IQ",
  },

  maps: {
    url: "https://maps.app.goo.gl/kWzQFMfET6hf8VXE9",
    // Coordinates of the company's Google Maps pin (resolved from the link above).
    lat: 32.0181083,
    lng: 44.3415702,
  },

  /**
   * Public production URL (e.g. https://www.example.com). Enables canonical URLs,
   * hreflang alternates, Open Graph images and an absolute sitemap. Leave unset until
   * the domain is live.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || null,
} as const;

export type ServiceId = "flights" | "visa" | "insurance" | "approvals" | "tours" | "other";
export type DestinationId = "istanbul" | "dubai" | "maldives" | "kualaLumpur" | "tbilisi" | "cairo";
export type Locale = "ar" | "en";

/** Opens a WhatsApp chat with the office, optionally prefilled. */
export function whatsappUrl(text?: string) {
  const base = `https://wa.me/${site.whatsapp.number}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const telUrl = `tel:${site.phone.e164}`;

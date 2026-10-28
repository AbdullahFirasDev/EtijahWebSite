import type { Metadata } from "next";
import { site } from "@/content/site";
import type { Dictionary } from "@/content/types";

const PATHS = { ar: "/", en: "/en/" } as const;
const OG_IMAGES = { ar: "/og/og-ar.jpg", en: "/og/og-en.jpg" } as const;

/**
 * Page metadata. Canonical URLs, hreflang alternates and Open Graph images all need
 * absolute URLs, so they are only emitted once NEXT_PUBLIC_SITE_URL is configured.
 */
export function buildMetadata(dict: Dictionary): Metadata {
  const { locale, meta } = dict;
  const metadata: Metadata = {
    title: meta.title,
    description: meta.description,
    applicationName: dict.brand.name,
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: {
      type: "website",
      siteName: dict.brand.name,
      title: meta.title,
      description: meta.description,
      locale: locale === "ar" ? "ar_IQ" : "en_US",
      alternateLocale: locale === "ar" ? ["en_US"] : ["ar_IQ"],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
    robots: { index: true, follow: true },
  };

  if (site.url) {
    const image = { url: OG_IMAGES[locale], width: 1200, height: 630, alt: meta.ogAlt };
    metadata.metadataBase = new URL(site.url);
    metadata.alternates = {
      canonical: PATHS[locale],
      languages: { ar: PATHS.ar, en: PATHS.en, "x-default": PATHS.ar },
    };
    metadata.openGraph = { ...metadata.openGraph, url: PATHS[locale], images: [image] };
    metadata.twitter = { ...metadata.twitter, images: [image.url] };
  }

  return metadata;
}

/** schema.org TravelAgency (a LocalBusiness subtype) built only from verified facts. */
export function travelAgencyJsonLd(dict: Dictionary) {
  const ar = dict.locale === "ar";
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: ar ? site.nameAr : site.nameEn,
    alternateName: ar ? site.nameEn : site.nameAr,
    description: dict.meta.description,
    telephone: site.phone.e164,
    ...(site.email ? { email: site.email } : {}),
    ...(site.url
      ? {
          "@id": `${site.url}/#business`,
          url: `${site.url}${PATHS[dict.locale]}`,
          image: `${site.url}${OG_IMAGES[dict.locale]}`,
          logo: `${site.url}/brand/etijah-logo.png`,
        }
      : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: ar ? site.address.streetAr : site.address.streetEn,
      addressLocality: ar ? site.address.cityAr : site.address.cityEn,
      addressRegion: ar ? site.address.regionAr : site.address.regionEn,
      addressCountry: site.address.countryCode,
    },
    geo: { "@type": "GeoCoordinates", latitude: site.maps.lat, longitude: site.maps.lng },
    hasMap: site.maps.url,
    areaServed: { "@type": "Country", name: ar ? "العراق" : "Iraq" },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: dict.services.eyebrow,
      itemListElement: dict.services.items.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.title, description: s.text },
      })),
    },
  };
}

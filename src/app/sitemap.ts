import type { MetadataRoute } from "next";
import { site } from "@/content/site";

export const dynamic = "force-static";

// Sitemap URLs must be absolute; entries appear once NEXT_PUBLIC_SITE_URL is set.
export default function sitemap(): MetadataRoute.Sitemap {
  if (!site.url) return [];
  const languages = { ar: `${site.url}/`, en: `${site.url}/en/` };
  const lastModified = new Date();
  return [
    { url: languages.ar, lastModified, changeFrequency: "monthly", priority: 1, alternates: { languages } },
    { url: languages.en, lastModified, changeFrequency: "monthly", priority: 0.8, alternates: { languages } },
  ];
}

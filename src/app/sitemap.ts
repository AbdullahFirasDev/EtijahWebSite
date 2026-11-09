import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { publicHotelSlugs } from "@/server/repo/catalog";
import { publicProgramSlugs } from "@/server/repo/programs";

// Rebuilt at most every hour so newly published offers appear.
export const revalidate = 3600;

// Sitemap URLs must be absolute; entries appear once NEXT_PUBLIC_SITE_URL is set.
// Only public pages are listed: never staff pages or company quotes.
export default function sitemap(): MetadataRoute.Sitemap {
  if (!site.url) return [];
  const pair = (path: string) => ({ ar: `${site.url}${path}`, en: `${site.url}/en${path}` });
  const home = { ar: `${site.url}/`, en: `${site.url}/en/` };
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: home.ar, lastModified: now, changeFrequency: "monthly", priority: 1, alternates: { languages: home } },
    { url: home.en, lastModified: now, changeFrequency: "monthly", priority: 0.8, alternates: { languages: home } },
  ];
  const add = (path: string, lastModified: Date, priority: number) => {
    const languages = pair(path);
    entries.push({ url: languages.ar, lastModified, changeFrequency: "weekly", priority, alternates: { languages } });
    entries.push({ url: languages.en, lastModified, changeFrequency: "weekly", priority: priority - 0.1, alternates: { languages } });
  };
  try {
    add("/programs/", now, 0.9);
    for (const p of publicProgramSlugs()) add(`/programs/${p.slug}/`, new Date(p.updated_at), 0.8);
    for (const h of publicHotelSlugs()) add(`/hotels/${h.slug}/`, new Date(h.updated_at), 0.5);
  } catch (error) {
    console.error("[sitemap]", error);
  }
  return entries;
}

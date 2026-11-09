import type { MetadataRoute } from "next";
import { site } from "@/content/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // Staff portal, private company quotes and APIs are never crawled (they also send noindex).
    rules: { userAgent: "*", allow: "/", disallow: ["/staff/", "/q/", "/api/"] },
    ...(site.url ? { sitemap: `${site.url}/sitemap.xml`, host: site.url } : {}),
  };
}

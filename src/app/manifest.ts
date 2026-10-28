import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { asset } from "@/lib/asset";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.nameAr,
    short_name: "الاتجاه",
    description: "الاتجاه للسياحة والسفر — النجف الأشرف",
    lang: "ar",
    dir: "rtl",
    start_url: asset("/"),
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#051c33",
    icons: [
      { src: asset("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
      { src: asset("/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
      { src: asset("/icons/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

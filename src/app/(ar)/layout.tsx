import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../globals.css";
import { ar } from "@/content/ar";
import { cairo } from "@/lib/fonts";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(ar);

export const viewport: Viewport = {
  themeColor: "#051c33",
  colorScheme: "light",
};

/** Arabic root layout (default locale, right-to-left). */
export default function ArabicLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body>{children}</body>
    </html>
  );
}

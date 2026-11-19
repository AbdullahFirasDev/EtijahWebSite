import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../globals.css";
import { cairo } from "@/lib/fonts";

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };
export const viewport: Viewport = { themeColor: "#051c33", colorScheme: "light" };

/** Root layout for A4 print pages (the source of generated PDFs). Never indexed. */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body>{children}</body>
    </html>
  );
}

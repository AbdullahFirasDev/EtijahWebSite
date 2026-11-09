import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../globals.css";
import { cairo } from "@/lib/fonts";

export const metadata: Metadata = {
  title: { default: "بوابة الموظفين | الاتجاه للسياحة والسفر", template: "%s | بوابة الموظفين" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#051c33", colorScheme: "light" };

/** Staff portal root layout (Arabic, RTL). Private: never indexed, never cached. */
export default function StaffRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}

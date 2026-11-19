import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../globals.css";
import { cairo } from "@/lib/fonts";

export const metadata: Metadata = {
  title: { default: "بوابة الشركات | الاتجاه للسياحة والسفر", template: "%s | بوابة الشركات" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#051c33", colorScheme: "light" };

/** Partner (B2B) portal root layout. Private: never indexed, never cached. */
export default function B2bRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../globals.css";
import { en } from "@/content/en";
import { cairo } from "@/lib/fonts";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(en);

export const viewport: Viewport = {
  themeColor: "#051c33",
  colorScheme: "light",
};

/** English root layout (left-to-right). */
export default function EnglishLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={cairo.variable}>
      <body>{children}</body>
    </html>
  );
}

import { Cairo } from "next/font/google";

// Cairo is the brand typeface (variable 200–1000), self-hosted by next/font at build time.
export const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
  fallback: ["Segoe UI", "Tahoma", "system-ui", "sans-serif"],
});

import type { Locale } from "@/content/site";

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";

/** Two-digit ordinal for decorative numbering: "01" in English, "٠١" in Arabic. */
export function formatIndex(n: number, locale: Locale) {
  const padded = String(n).padStart(2, "0");
  return locale === "ar" ? padded.replace(/\d/g, (d) => ARABIC_INDIC[Number(d)]) : padded;
}

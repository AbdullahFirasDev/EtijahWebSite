// Dial codes offered in the traveler request form. Iraq first; the rest cover the region and
// countries with large Iraqi communities.
export const DIAL_CODES: { country: string; code: string }[] = [
  { country: "IQ", code: "964" },
  { country: "SA", code: "966" },
  { country: "AE", code: "971" },
  { country: "KW", code: "965" },
  { country: "QA", code: "974" },
  { country: "BH", code: "973" },
  { country: "OM", code: "968" },
  { country: "JO", code: "962" },
  { country: "LB", code: "961" },
  { country: "SY", code: "963" },
  { country: "TR", code: "90" },
  { country: "IR", code: "98" },
  { country: "EG", code: "20" },
  { country: "GB", code: "44" },
  { country: "DE", code: "49" },
  { country: "SE", code: "46" },
  { country: "NL", code: "31" },
  { country: "DK", code: "45" },
  { country: "NO", code: "47" },
  { country: "FI", code: "358" },
  { country: "FR", code: "33" },
  { country: "BE", code: "32" },
  { country: "AT", code: "43" },
  { country: "US", code: "1" },
  { country: "AU", code: "61" },
  { country: "NZ", code: "64" },
  { country: "MY", code: "60" },
];

// Arabic-Indic (U+0660…) and Persian (U+06F0…) digits → Latin.
const toLatin = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));

/**
 * Builds an E.164 number from a dial code and a local number, or null when invalid.
 * Accepts Arabic-Indic digits and a leading trunk 0 (e.g. 0782… → +964782…).
 */
export function toE164(dialCode: string, local: string): string | null {
  if (!DIAL_CODES.some((d) => d.code === dialCode)) return null;
  let digits = toLatin(local).replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(digits)) return null;
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else digits = dialCode + digits.replace(/^0+/, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** "+9647826888850" → "+964 782 688 8850" (readable grouping, always render in dir="ltr"). */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const d = e164.replace(/^\+/, "");
  const dial = DIAL_CODES.map((c) => c.code)
    .sort((a, b) => b.length - a.length)
    .find((c) => d.startsWith(c));
  if (!dial) return e164;
  const rest = d.slice(dial.length);
  return `+${dial} ${rest.replace(/(\d{3})(\d{3})(\d+)/, "$1 $2 $3")}`;
}

/** wa.me link for a phone number (digits only). */
export const waLink = (e164: string, text?: string) =>
  `https://wa.me/${e164.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

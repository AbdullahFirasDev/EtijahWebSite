import "server-only";
import { z } from "zod";
import { isCountry } from "@/lib/countries";
import { isDay } from "@/lib/dates";
import { isCurrency } from "@/lib/money";

/** Optional text: trimmed, empty → null, length-capped. */
export const optText = (max: number) =>
  z
    .string()
    .max(max * 2)
    .nullish()
    .transform((v) => (v ?? "").trim())
    .refine((v) => v.length <= max, { message: `النص أطول من ${max} حرفاً.` })
    .transform((v) => (v ? v : null));

export const reqText = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} مطلوب.` })
    .transform((v) => v.trim())
    .refine((v) => v.length >= min, { message: min <= 1 ? `${label} مطلوب.` : `${label} قصير جداً.` })
    .refine((v) => v.length <= max, { message: `${label} أطول من ${max} حرفاً.` });

/** http(s) URL only (blocks javascript:, data: and similar), or null. */
export const optUrl = z
  .string()
  .max(1000)
  .nullish()
  .transform((v) => (v ?? "").trim())
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return (u.protocol === "https:" || u.protocol === "http:") && !!u.hostname.includes(".");
    } catch {
      return false;
    }
  }, { message: "الرابط غير صالح. يجب أن يبدأ بـ https://" })
  .transform((v) => (v ? v : null));

export const optEmail = z
  .string()
  .max(200)
  .nullish()
  .transform((v) => (v ?? "").trim().toLowerCase())
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), { message: "البريد الإلكتروني غير صالح." })
  .transform((v) => (v ? v : null));

export const day = z.string().refine(isDay, { message: "التاريخ غير صالح." });
export const optDay = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isDay(v), { message: "التاريخ غير صالح." });

export const id = z.number().int().positive();
export const mediaId = z.string().uuid();
export const currency = z.string().refine(isCurrency, { message: "العملة غير مدعومة." });
export const country = z.string().refine(isCountry, { message: "الدولة غير صالحة." });
export const int = (min: number, max: number, label = "القيمة") =>
  z.number({ error: `${label} غير صالحة.` }).int(`${label} يجب أن تكون عدداً صحيحاً.`).min(min, `${label} أقل من المسموح.`).max(max, `${label} أكبر من المسموح.`);
/** Money in minor units. */
export const money = z.number().int().min(0).max(100_000_000_000);

/** First error message plus per-path messages ("days.2.title_ar" → message). */
export function zodFailure(error: z.ZodError): { ok: false; error: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: error.issues[0]?.message ?? "البيانات غير صالحة.", fieldErrors };
}

export function fail(error: string, fieldErrors?: Record<string, string>) {
  return { ok: false as const, error, fieldErrors };
}

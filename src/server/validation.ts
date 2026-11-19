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
export const mediaId = z.uuid();
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

/** #rrggbb colour (brand colours on partner documents). */
export const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "اللون يجب أن يكون بصيغة ‎#RRGGBB.").transform((v) => v.toLowerCase());

/** Basis points (1% = 100), 0–100%. */
export const basisPoints = z.number({ error: "النسبة غير صالحة." }).int().min(0, "النسبة لا تقل عن صفر.").max(10_000, "النسبة لا تتجاوز 100%.");

/** Signed money in minor units (supplements, adjustments). */
export const signedMoney = z.number().int().min(-100_000_000_000).max(100_000_000_000);

/** Positive exchange rate with up to 6 decimals. */
export const fxRate = z.number().positive("سعر الصرف يجب أن يكون أكبر من صفر.").max(1_000_000).nullable();

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), { message: "البريد الإلكتروني غير صالح." });

/** HH:MM (24h). */
export const optTime = z
  .string()
  .nullish()
  .transform((v) => (v ? v.trim() : null))
  .refine((v) => v === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), { message: "الوقت غير صالح (HH:MM)." });

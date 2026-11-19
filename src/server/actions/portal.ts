"use server";

import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { isCountry } from "@/lib/countries";
import { todayDay } from "@/lib/dates";
import { col } from "../db";
import { createB2bRequest } from "../repo/b2b";
import { optDay, optText, reqText } from "../validation";
import { companyAction } from "./guard";

const requestSchema = z
  .object({
    title: reqText(3, 160, "عنوان الطلب / Title"),
    country_codes: z.array(z.string().refine(isCountry)).max(5),
    places: optText(200),
    date_from: optDay,
    date_to: optDay,
    nights: z.number().int().min(1).max(90).nullable(),
    adults: z.number().int().min(1).max(500),
    children: z.number().int().min(0).max(500),
    rooms: z.number().int().min(0).max(300),
    hotel_ids: z.array(z.number().int().positive()).max(10),
    hotel_stars: z.number().int().min(1).max(5).nullable(),
    budget: optText(120),
    beneficiary: optText(160),
    notes: optText(3000),
  })
  .refine((r) => !r.date_from || r.date_from >= todayDay(), { message: "اختر تاريخاً قادماً. / Choose a future date.", path: ["date_from"] })
  .refine((r) => !r.date_from || !r.date_to || r.date_to >= r.date_from, { message: "تاريخ العودة قبل تاريخ السفر. / Return is before departure.", path: ["date_to"] });

/** A company user asks Etijah for a program / quote. Only hotels the company may see can be referenced. */
export async function createPortalRequestAction(input: z.input<typeof requestSchema>): Promise<ActionResult<{ ref: string }>> {
  return companyAction("requests.create", requestSchema, input, async (data, user) => {
    if (data.hotel_ids.length) {
      const allowed = await (await col("company_hotels")).countDocuments({ company_id: user.companyId, hotel_id: { $in: [...new Set(data.hotel_ids)] } });
      if (allowed !== new Set(data.hotel_ids).size) return { ok: false, error: "أحد الفنادق غير متاح لشركتك. / A hotel is not available to your company." };
    }
    const { ref } = await createB2bRequest(user.companyId, user.id, { ...data, hotel_ids: [...new Set(data.hotel_ids)] });
    return ok({ ref }, `تم إرسال طلبك (${ref}). سيعدّ فريق الاتجاه العرض ويرسله إلى بوابتكم.`);
  });
}

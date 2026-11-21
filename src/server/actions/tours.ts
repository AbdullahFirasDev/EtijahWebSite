"use server";

import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { can } from "@/lib/permissions";
import { getSettings } from "../repo/settings";
import { deleteTour, getTour, saveTour } from "../repo/tours";
import { audit } from "../security";
import { country, currency, id, money, optText, reqText } from "../validation";
import { staffAction } from "./guard";

const tourSchema = z.object({
  id: id.optional(),
  country_code: country,
  city_ar: optText(80),
  city_en: optText(80),
  name_ar: reqText(2, 160, "اسم الجولة بالعربية"),
  name_en: optText(160),
  description_ar: optText(3000),
  description_en: optText(3000),
  duration_ar: optText(60),
  duration_en: optText(60),
  currency,
  price: money,
  cost: money.nullable(),
  active: z.boolean(),
});

export async function saveTourAction(input: z.input<typeof tourSchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("tours.edit", tourSchema, input, async (data, staff) => {
    const existing = data.id ? await getTour(data.id) : null;
    if (data.id && !existing) return { ok: false, error: "الجولة غير موجودة." };
    if (!(await getSettings()).currencies.includes(data.currency as never)) return { ok: false, error: "العملة غير مفعّلة في الإعدادات." };
    // Without the right to see costs, the stored cost is kept as it is.
    const cost = can(staff.role, "hotels.costs") ? data.cost : (existing?.cost ?? null);
    const savedId = await saveTour({ ...data, cost }, staff.id);
    await audit(staff.id, data.id ? "update" : "create", "tour", savedId);
    return ok({ id: savedId }, "تم حفظ الجولة.");
  });
}

export async function deleteTourAction(tourId: number): Promise<ActionResult<null>> {
  return staffAction("tours.edit", id, tourId, async (tid, staff) => {
    if (!(await getTour(tid))) return { ok: false, error: "الجولة غير موجودة." };
    // Programs and quotes hold their own copy of the tour, so deleting it changes nothing there.
    await deleteTour(tid);
    await audit(staff.id, "delete", "tour", tid);
    return ok(null, "تم حذف الجولة.");
  });
}

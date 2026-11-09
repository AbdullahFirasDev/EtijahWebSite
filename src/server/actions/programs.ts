"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { can } from "@/lib/permissions";
import { BOARDS, DEPARTURE_STATUSES, PROGRAM_KINDS, PROGRAM_STATUSES } from "@/lib/travel-labels";
import { isSlug } from "@/lib/slug";
import { all, placeholders } from "../db";
import { mediaExists } from "../media";
import {
  deleteProgram,
  duplicateProgram,
  getProgramRow,
  publishProblems,
  saveProgram,
  setProgramStatus,
  updateDepartureQuick,
} from "../repo/programs";
import { getSettings } from "../repo/settings";
import { currency, day, id, int, mediaId, money, optText, reqText } from "../validation";
import { staffAction } from "./guard";

const refreshPublic = () => revalidatePath("/", "layout");

const departureSchema = z
  .object({
    id: id.optional(),
    depart_date: day,
    return_date: day,
    seats_total: int(1, 2000, "عدد المقاعد"),
    seats_held: int(0, 2000, "المقاعد المحجوزة خارج الموقع"),
    price: money.nullable(),
    status: z.enum(DEPARTURE_STATUSES),
    note_ar: optText(200),
    note_en: optText(200),
  })
  .refine((d) => d.return_date >= d.depart_date, { message: "تاريخ العودة يجب أن يكون بعد تاريخ السفر.", path: ["return_date"] })
  .refine((d) => d.seats_held <= d.seats_total, { message: "المقاعد المحجوزة أكثر من إجمالي المقاعد.", path: ["seats_held"] });

const programSchema = z
  .object({
    kind: z.enum(PROGRAM_KINDS),
    featured: z.boolean(),
    title_ar: reqText(3, 140, "عنوان البرنامج بالعربية"),
    title_en: optText(140),
    slug: optText(80).refine((v) => v === null || isSlug(v), { message: "الرابط المختصر يقبل حروفاً إنجليزية صغيرة وأرقاماً وشرطات فقط." }),
    summary_ar: optText(320),
    summary_en: optText(320),
    description_ar: optText(8000),
    description_en: optText(8000),
    destination_ids: z.array(id).min(1, "اختر وجهة واحدة على الأقل.").max(10),
    duration_days: int(1, 90, "عدد الأيام"),
    duration_nights: int(0, 90, "عدد الليالي"),
    currency,
    price_note_ar: optText(120),
    price_note_en: optText(120),
    meals_ar: optText(200),
    meals_en: optText(200),
    terms_ar: optText(6000),
    terms_en: optText(6000),
    cover_media_id: mediaId.nullable(),
    gallery: z.array(mediaId).max(30),
    prices: z
      .array(z.object({ label_ar: reqText(2, 120, "وصف السعر"), label_en: optText(120), amount: money.refine((v) => v > 0, { message: "السعر يجب أن يكون أكبر من صفر." }) }))
      .max(16),
    days: z
      .array(z.object({ title_ar: reqText(2, 160, "عنوان اليوم"), title_en: optText(160), body_ar: optText(3000), body_en: optText(3000) }))
      .max(90),
    hotels: z
      .array(z.object({ hotel_id: id, nights: int(1, 90, "عدد الليالي"), room_ar: optText(120), room_en: optText(120), board: z.enum(BOARDS).nullable() }))
      .max(20),
    services: z.array(z.object({ service_id: id, included: z.boolean(), note_ar: optText(200), note_en: optText(200) })).max(60),
    departures: z.array(departureSchema).max(120),
  })
  .refine((p) => p.duration_nights <= p.duration_days, { message: "عدد الليالي لا يتجاوز عدد الأيام.", path: ["duration_nights"] });

const saveSchema = z.object({ id: id.nullable(), intent: z.enum(["save", "publish"]), program: programSchema });

export async function saveProgramAction(input: { id: number | null; intent: "save" | "publish"; program: unknown }): Promise<ActionResult<{ id: number; status: string }>> {
  return staffAction("catalog.edit", saveSchema, input, (data, staff) => {
    const p = data.program;
    if (data.id && !getProgramRow(data.id)) return { ok: false, error: "البرنامج غير موجود." };
    if (!getSettings().currencies.includes(p.currency as never)) return { ok: false, error: "العملة غير مفعّلة في الإعدادات." };

    // Every referenced record must exist (clear messages instead of database errors).
    const missing = (table: string, ids: number[]) => {
      const unique = [...new Set(ids)];
      if (!unique.length) return false;
      return all(`SELECT id FROM ${table} WHERE id IN (${placeholders(unique.length)})`, ...unique).length !== unique.length;
    };
    if (missing("destinations", p.destination_ids)) return { ok: false, error: "إحدى الوجهات المختارة غير موجودة." };
    if (missing("hotels", p.hotels.map((h) => h.hotel_id))) return { ok: false, error: "أحد الفنادق المختارة غير موجود." };
    if (missing("services", p.services.map((s) => s.service_id))) return { ok: false, error: "إحدى الخدمات غير موجودة." };
    if (new Set(p.services.map((s) => s.service_id)).size !== p.services.length) return { ok: false, error: "تكررت خدمة في القائمة." };
    const mediaIds = [...(p.cover_media_id ? [p.cover_media_id] : []), ...p.gallery];
    if (mediaIds.some((m) => !mediaExists(m))) return { ok: false, error: "إحدى الصور غير موجودة. أعد رفعها." };

    if (data.intent === "publish" && !can(staff.role, "catalog.publish")) return { ok: false, error: "لا تملك صلاحية النشر." };

    const programId = saveProgram(data.id, { ...p, destination_ids: [...new Set(p.destination_ids)], gallery: [...new Set(p.gallery)] }, staff.id);

    let status = getProgramRow(programId)!.status;
    if (data.intent === "publish") {
      const problems = publishProblems(programId);
      if (problems.length) {
        refreshPublic();
        return { ok: false, error: `تم الحفظ كمسودة، ولكن لا يمكن النشر بعد: ${problems.join(" ")}`, fieldErrors: { _saved: String(programId) } };
      }
      setProgramStatus(programId, "published", staff.id);
      status = "published";
    }
    refreshPublic();
    return ok({ id: programId, status }, data.intent === "publish" ? "تم حفظ البرنامج ونشره للمسافرين." : "تم حفظ التغييرات.");
  });
}

const statusSchema = z.object({ id, status: z.enum(PROGRAM_STATUSES) });

export async function setProgramStatusAction(input: { id: number; status: string }): Promise<ActionResult<{ status: string }>> {
  return staffAction("catalog.publish", statusSchema, input, (data, staff) => {
    if (!getProgramRow(data.id)) return { ok: false, error: "البرنامج غير موجود." };
    if (data.status === "published") {
      const problems = publishProblems(data.id);
      if (problems.length) return { ok: false, error: `لا يمكن النشر بعد: ${problems.join(" ")}` };
    }
    setProgramStatus(data.id, data.status, staff.id);
    refreshPublic();
    const labels = { published: "تم نشر البرنامج.", paused: "تم إيقاف البرنامج مؤقتاً، ولم يعد ظاهراً للمسافرين.", archived: "تمت أرشفة البرنامج.", draft: "أُعيد البرنامج إلى المسودات." };
    return ok({ status: data.status }, labels[data.status]);
  });
}

export async function deleteProgramAction(programId: number): Promise<ActionResult<null>> {
  return staffAction("catalog.delete", id, programId, (pid, staff) => {
    if (!getProgramRow(pid)) return { ok: false, error: "البرنامج غير موجود." };
    deleteProgram(pid, staff.id);
    refreshPublic();
    return ok(null, "تم حذف البرنامج. الطلبات المرتبطة به بقيت محفوظة.");
  });
}

export async function duplicateProgramAction(programId: number): Promise<ActionResult<{ id: number }>> {
  return staffAction("catalog.edit", id, programId, (pid, staff) => {
    const newId = duplicateProgram(pid, staff.id);
    if (!newId) return { ok: false, error: "البرنامج غير موجود." };
    return ok({ id: newId }, "تم إنشاء نسخة كمسودة.");
  });
}

const quickDepartureSchema = z
  .object({ id, seats_total: int(1, 2000, "عدد المقاعد"), seats_held: int(0, 2000, "المقاعد المحجوزة"), status: z.enum(DEPARTURE_STATUSES) })
  .refine((d) => d.seats_held <= d.seats_total, { message: "المقاعد المحجوزة أكثر من الإجمالي.", path: ["seats_held"] });

export async function updateDepartureAction(input: z.input<typeof quickDepartureSchema>): Promise<ActionResult<null>> {
  return staffAction("catalog.edit", quickDepartureSchema, input, (data, staff) => {
    if (!all("SELECT id FROM departures WHERE id = ?", data.id).length) return { ok: false, error: "الموعد غير موجود." };
    updateDepartureQuick(data.id, data, staff.id);
    refreshPublic();
    return ok(null, "تم تحديث المقاعد.");
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { site } from "@/content/site";
import { ok, type ActionResult } from "@/lib/action-result";
import { can } from "@/lib/permissions";
import { programText } from "@/lib/program-text";
import { isSlug } from "@/lib/slug";
import { BOARDS, DEPARTURE_STATUSES, PROGRAM_STATUSES, PROGRAM_TYPES, VISIBILITIES } from "@/lib/travel-labels";
import { mediaExist } from "../media";
import { existingIds, RATE_BASES } from "../repo/catalog";
import {
  deleteProgram,
  duplicateProgram,
  getDeparture,
  getProgramDoc,
  getProgramPreview,
  publishProblems,
  saveProgram,
  setProgramStatus,
  setShareLink,
  updateDepartureQuick,
} from "../repo/programs";
import { getSettings } from "../repo/settings";
import { currency, day, fxRate, id, int, mediaId, money, optText, optTime, reqText, signedMoney } from "../validation";
import { staffAction } from "./guard";

const refreshPublic = () => revalidatePath("/", "layout");

const departureSchema = z
  .object({
    id: id.optional(),
    depart_date: day,
    return_date: day,
    seats_total: int(1, 2000, "عدد المقاعد"),
    seats_held: int(0, 2000, "المقاعد المحجوزة خارج الموقع"),
    price_supplement: signedMoney,
    status: z.enum(DEPARTURE_STATUSES),
    note_ar: optText(200),
    note_en: optText(200),
  })
  .refine((d) => d.return_date >= d.depart_date, { message: "تاريخ العودة يجب أن يكون بعد تاريخ السفر.", path: ["return_date"] })
  .refine((d) => d.seats_held <= d.seats_total, { message: "المقاعد المحجوزة أكثر من إجمالي المقاعد.", path: ["seats_held"] });

const optionSchema = z.object({
  id: z.string().max(64).nullable(),
  hotel_id: id,
  room_type_id: z.string().max(64).nullable(),
  room_ar: optText(120),
  room_en: optText(120),
  occupancy: int(1, 20, "عدد الأشخاص في الغرفة"),
  board: z.enum(BOARDS).nullable(),
  nights: int(1, 90, "عدد الليالي"),
  basis: z.enum(RATE_BASES),
  night_price: money,
  night_cost: money.nullable(),
  source: z.enum(["library", "custom"]),
  rate_id: z.string().max(64).nullable(),
  refresh_rate: z.boolean(),
  fx_rate: fxRate,
  final_price_override: money.nullable(),
  note_ar: optText(200),
  note_en: optText(200),
});

const flightSchema = z.object({
  direction: z.enum(["outbound", "return", "internal"]),
  airline_id: id.nullable(),
  flight_no: optText(12),
  from: optText(60),
  to: optText(60),
  day: int(1, 90, "اليوم").nullable(),
  depart_time: optTime,
  arrive_time: optTime,
  note: optText(200),
});

const programSchema = z
  .object({
    type: z.enum(PROGRAM_TYPES),
    visibility: z.enum(VISIBILITIES),
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
    departure_airport: z.object({ code: optText(4), name_ar: reqText(2, 120, "مطار المغادرة"), name_en: optText(120) }).nullable(),
    airline_ids: z.array(id).max(10),
    flights: z.array(flightSchema).max(20),
    itinerary: z.array(z.object({ title_ar: reqText(2, 160, "عنوان اليوم"), title_en: optText(160), body_ar: optText(3000), body_en: optText(3000) })).max(90),
    services: z.array(z.object({ service_id: id, included: z.boolean(), note_ar: optText(200), note_en: optText(200) })).max(60),
    meals_ar: optText(200),
    meals_en: optText(200),
    terms_ar: optText(6000),
    terms_en: optText(6000),
    cover_media_id: mediaId.nullable(),
    gallery: z.array(mediaId).max(30),
    base_price: money,
    base_cost: money.nullable(),
    hotel_options: z.array(optionSchema).max(20),
    extra_prices: z.array(z.object({ label_ar: reqText(2, 120, "وصف السعر"), label_en: optText(120), amount: money.refine((v) => v > 0, { message: "السعر يجب أن يكون أكبر من صفر." }) })).max(16),
    price_note_ar: optText(120),
    price_note_en: optText(120),
    departures: z.array(departureSchema).max(120),
  })
  .refine((p) => p.duration_nights <= p.duration_days, { message: "عدد الليالي لا يتجاوز عدد الأيام.", path: ["duration_nights"] });

const saveSchema = z.object({ id: id.nullable(), intent: z.enum(["save", "publish"]), program: programSchema });

export async function saveProgramAction(input: { id: number | null; intent: "save" | "publish"; program: unknown }): Promise<ActionResult<{ id: number; status: string }>> {
  return staffAction("programs.edit", saveSchema, input, async (data, staff) => {
    const p = data.program;
    if (data.id && !(await getProgramDoc(data.id))) return { ok: false, error: "البرنامج غير موجود." };
    const rights = { pricing: can(staff.role, "programs.pricing"), override: can(staff.role, "pricing.override") };
    if (rights.pricing && !(await getSettings()).currencies.includes(p.currency as never)) return { ok: false, error: "العملة غير مفعّلة في الإعدادات." };

    // Every referenced record must exist (clear messages instead of broken references).
    if (!(await existingIds("destinations", p.destination_ids))) return { ok: false, error: "إحدى الوجهات المختارة غير موجودة." };
    if (!(await existingIds("hotels", p.hotel_options.map((h) => h.hotel_id)))) return { ok: false, error: "أحد الفنادق المختارة غير موجود." };
    if (!(await existingIds("services", p.services.map((s) => s.service_id)))) return { ok: false, error: "إحدى الخدمات غير موجودة." };
    if (!(await existingIds("airlines", [...p.airline_ids, ...p.flights.map((f) => f.airline_id).filter((a): a is number => !!a)]))) return { ok: false, error: "إحدى شركات الطيران غير موجودة." };
    if (new Set(p.services.map((s) => s.service_id)).size !== p.services.length) return { ok: false, error: "تكررت خدمة في القائمة." };
    if (!(await mediaExist([p.cover_media_id, ...p.gallery]))) return { ok: false, error: "إحدى الصور غير موجودة. أعد رفعها." };
    if (data.intent === "publish" && !can(staff.role, "programs.publish")) return { ok: false, error: "لا تملك صلاحية النشر." };

    const programId = await saveProgram(
      data.id,
      { ...p, destination_ids: [...new Set(p.destination_ids)], airline_ids: [...new Set(p.airline_ids)], gallery: [...new Set(p.gallery)] },
      staff.id,
      rights,
    );

    let status = (await getProgramDoc(programId))!.status;
    if (data.intent === "publish") {
      const problems = await publishProblems(programId);
      if (problems.length) {
        refreshPublic();
        return { ok: false, error: `تم الحفظ كمسودة، ولكن لا يمكن النشر بعد: ${problems.join(" ")}`, fieldErrors: { _saved: String(programId) } };
      }
      await setProgramStatus(programId, "published", staff.id);
      status = "published";
    }
    refreshPublic();
    const note = !rights.pricing && data.id ? " (الأسعار بقيت كما هي: لا تملك صلاحية تعديلها.)" : "";
    return ok({ id: programId, status }, (data.intent === "publish" ? "تم حفظ البرنامج ونشره للمسافرين." : "تم حفظ التغييرات.") + note);
  });
}

const statusSchema = z.object({ id, status: z.enum(PROGRAM_STATUSES) });

export async function setProgramStatusAction(input: { id: number; status: string }): Promise<ActionResult<{ status: string }>> {
  return staffAction("programs.publish", statusSchema, input, async (data, staff) => {
    if (!(await getProgramDoc(data.id))) return { ok: false, error: "البرنامج غير موجود." };
    if (data.status === "published") {
      const problems = await publishProblems(data.id);
      if (problems.length) return { ok: false, error: `لا يمكن النشر بعد: ${problems.join(" ")}` };
    }
    await setProgramStatus(data.id, data.status, staff.id);
    refreshPublic();
    const labels = { published: "تم نشر البرنامج.", paused: "تم إيقاف البرنامج مؤقتاً، ولم يعد ظاهراً للمسافرين.", archived: "تمت أرشفة البرنامج.", draft: "أُعيد البرنامج إلى المسودات." };
    return ok({ status: data.status }, labels[data.status]);
  });
}

export async function deleteProgramAction(programId: number): Promise<ActionResult<null>> {
  return staffAction("programs.delete", id, programId, async (pid, staff) => {
    if (!(await getProgramDoc(pid))) return { ok: false, error: "البرنامج غير موجود." };
    await deleteProgram(pid, staff.id);
    refreshPublic();
    return ok(null, "تم حذف البرنامج.");
  });
}

export async function duplicateProgramAction(programId: number): Promise<ActionResult<{ id: number }>> {
  return staffAction("programs.edit", id, programId, async (pid, staff) => {
    const newId = await duplicateProgram(pid, staff.id, { pricing: can(staff.role, "programs.pricing"), override: can(staff.role, "pricing.override") });
    if (!newId) return { ok: false, error: "البرنامج غير موجود." };
    return ok({ id: newId }, "تم إنشاء نسخة كمسودة.");
  });
}

/** Independent share link: enable, stop, or replace (the old link stops working). */
export async function shareLinkAction(input: { id: number; action: "enable" | "disable" | "regenerate" }): Promise<ActionResult<{ token: string; enabled: boolean }>> {
  return staffAction("programs.publish", z.object({ id, action: z.enum(["enable", "disable", "regenerate"]) }), input, async (data, staff) => {
    const share = await setShareLink(data.id, data.action, staff.id);
    if (!share) return { ok: false, error: "البرنامج غير موجود." };
    const msg = { enable: "تم تفعيل الرابط المستقل.", disable: "تم إيقاف الرابط. من يملكه لن يتمكن من فتح البرنامج.", regenerate: "تم إنشاء رابط جديد، وأُبطل الرابط السابق." };
    return ok(share, msg[data.action]);
  });
}

/** Formatted text of a program (WhatsApp / Telegram / e-mail), in Arabic or English. */
export async function programTextAction(input: { id: number; locale: "ar" | "en" }): Promise<ActionResult<{ text: string }>> {
  return staffAction("programs.view", z.object({ id, locale: z.enum(["ar", "en"]) }), input, async (data) => {
    const detail = await getProgramPreview(data.id, data.locale);
    if (!detail) return { ok: false, error: "البرنامج غير موجود." };
    const link = detail.shareToken && site.url ? `${site.url}${data.locale === "en" ? "/en" : ""}/p/${detail.shareToken}/` : null;
    return ok({ text: programText(detail, data.locale, link) });
  });
}

const quickDepartureSchema = z
  .object({ id, seats_total: int(1, 2000, "عدد المقاعد"), seats_held: int(0, 2000, "المقاعد المحجوزة"), status: z.enum(DEPARTURE_STATUSES) })
  .refine((d) => d.seats_held <= d.seats_total, { message: "المقاعد المحجوزة أكثر من الإجمالي.", path: ["seats_held"] });

export async function updateDepartureAction(input: z.input<typeof quickDepartureSchema>): Promise<ActionResult<null>> {
  return staffAction("programs.edit", quickDepartureSchema, input, async (data, staff) => {
    const dep = await getDeparture(data.id);
    if (!dep) return { ok: false, error: "الموعد غير موجود." };
    if (!(await updateDepartureQuick(data.id, data, staff.id))) return { ok: false, error: `المقاعد أقل من الطلبات المؤكدة (${dep.seats_confirmed}) مع المحجوز خارج الموقع.` };
    refreshPublic();
    return ok(null, "تم تحديث المقاعد.");
  });
}

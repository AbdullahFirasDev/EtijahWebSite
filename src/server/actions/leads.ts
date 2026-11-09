"use server";

import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { addDays, formatDay, todayDay } from "@/lib/dates";
import { toE164 } from "@/lib/phone";
import { LEAD_STATUSES, ROOM_TYPES } from "@/lib/travel-labels";
import { get } from "../db";
import { createLead, getLead, logLeadContact, updateLead } from "../repo/leads";
import { departureForRequest, recordProgramView } from "../repo/programs";
import { rateLimit, requestMeta } from "../security";
import { id, optEmail, optText } from "../validation";
import { staffAction } from "./guard";

// ------------------------------------------------------------------ Public: trip request
const MESSAGES = {
  ar: {
    invalid: "تحقق من البيانات المدخلة.",
    program: "هذا العرض لم يعد متاحاً للحجز.",
    departure: "موعد الكروب المختار لم يعد متاحاً. اختر موعداً آخر.",
    seats: "عدد المقاعد المتبقية في هذا الموعد أقل من عدد المسافرين.",
    name: "اكتب الاسم الكامل.",
    phone: "رقم الهاتف غير صحيح.",
    date: "اختر تاريخاً قادماً.",
    rate: "تم استلام عدة طلبات من جهازك. انتظر قليلاً أو تواصل معنا عبر واتساب.",
    error: "تعذّر إرسال الطلب الآن. حاول مرة أخرى أو تواصل معنا عبر واتساب.",
  },
  en: {
    invalid: "Please check the details you entered.",
    program: "This offer is no longer available for booking.",
    departure: "The selected group date is no longer available. Please choose another date.",
    seats: "There are fewer seats left on this date than travelers in your request.",
    name: "Please enter your full name.",
    phone: "The phone number is not valid.",
    date: "Please choose a future date.",
    rate: "Several requests were received from your device. Please wait a little or contact us on WhatsApp.",
    error: "We couldn't send your request right now. Please try again or contact us on WhatsApp.",
  },
};

const requestSchema = z.object({
  locale: z.enum(["ar", "en"]),
  program_id: id,
  departure_id: id.nullable(),
  preferred_date: z.string().nullable(),
  adults: z.number().int().min(1).max(60),
  children: z.number().int().min(0).max(40),
  infants: z.number().int().min(0).max(10),
  rooms: z.number().int().min(1).max(40),
  room_type: z.enum(ROOM_TYPES).nullable(),
  full_name: z.string().max(200),
  dial_code: z.string().max(5),
  phone: z.string().max(40),
  email: optEmail,
  notes: optText(1000),
  // Spam signals: a hidden field humans leave empty, and the time the form was open.
  website: z.string().max(200).optional(),
  elapsed_ms: z.number().int().min(0).optional(),
});

export type TripRequestInput = z.input<typeof requestSchema>;

export async function submitTripRequestAction(input: TripRequestInput): Promise<ActionResult<{ ref: string }>> {
  const locale = input?.locale === "en" ? "en" : "ar";
  const t = MESSAGES[locale];
  try {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? "");
      return { ok: false, error: t.invalid, fieldErrors: field ? { [field]: t.invalid } : undefined };
    }
    const d = parsed.data;
    const meta = await requestMeta();

    const fullName = d.full_name.trim().replace(/\s+/g, " ");
    if (fullName.length < 3 || fullName.length > 80) return { ok: false, error: t.name, fieldErrors: { full_name: t.name } };
    const phone = toE164(d.dial_code, d.phone);
    if (!phone) return { ok: false, error: t.phone, fieldErrors: { phone: t.phone } };

    // Bots: pretend success without storing anything, so they learn nothing.
    if (d.website || (d.elapsed_ms != null && d.elapsed_ms < 2500)) return ok({ ref: "REQ-0000-00000" });
    if (!rateLimit("trip-request", meta.ipHash, 6, 30 * 60)) return { ok: false, error: t.rate };

    const program = get<{ id: number; title_ar: string; title_en: string | null; kind: string }>(
      "SELECT id, title_ar, title_en, kind FROM programs WHERE id = ? AND status = 'published'",
      d.program_id,
    );
    if (!program) return { ok: false, error: t.program };

    let departureLabel: string | null = null;
    let preferred: string | null = null;
    if (d.departure_id) {
      const dep = departureForRequest(program.id, d.departure_id);
      if (!dep || !dep.state.bookable) return { ok: false, error: t.departure, fieldErrors: { departure_id: t.departure } };
      if (dep.state.seatsLeft < d.adults + d.children) return { ok: false, error: t.seats, fieldErrors: { departure_id: t.seats } };
      departureLabel = `${dep.row.code} · ${formatDay(dep.row.depart_date, "ar")} → ${formatDay(dep.row.return_date, "ar")}`;
    } else if (d.preferred_date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.preferred_date) || d.preferred_date < todayDay() || d.preferred_date > addDays(todayDay(), 730))
        return { ok: false, error: t.date, fieldErrors: { preferred_date: t.date } };
      preferred = d.preferred_date;
    }

    const { ref } = createLead({
      program_id: program.id,
      departure_id: d.departure_id,
      program_title: program.title_ar,
      departure_label: departureLabel,
      preferred_date: preferred,
      adults: d.adults,
      children: d.children,
      infants: d.infants,
      rooms: d.rooms,
      room_type: d.room_type,
      full_name: fullName,
      phone,
      email: d.email,
      notes: d.notes,
      locale,
      ip_hash: meta.ipHash,
      user_agent: meta.userAgent,
    });
    return ok({ ref });
  } catch (error) {
    console.error("[trip request]", error);
    return { ok: false, error: t.error };
  }
}

/** Counts a program view (called once per browser session from the program page). */
export async function trackProgramViewAction(programId: number): Promise<void> {
  if (!Number.isInteger(programId) || programId <= 0) return;
  const meta = await requestMeta();
  if (!rateLimit("program-view", `${meta.ipHash}:${programId}`, 3, 3600)) return;
  recordProgramView(programId);
}

// ------------------------------------------------------------------ Staff
const updateSchema = z.object({
  id,
  status: z.enum(LEAD_STATUSES).optional(),
  note: optText(2000),
  assigned_to: id.nullable().optional(),
});

export async function updateLeadAction(input: z.input<typeof updateSchema>): Promise<ActionResult<null>> {
  return staffAction("leads.manage", updateSchema, input, (data, staff) => {
    if (!getLead(data.id)) return { ok: false, error: "الطلب غير موجود." };
    if (data.assigned_to && !get("SELECT 1 FROM staff_users WHERE id = ? AND active = 1", data.assigned_to)) return { ok: false, error: "الموظف غير موجود." };
    if (!data.status && !data.note && data.assigned_to === undefined) return { ok: false, error: "لا يوجد تغيير للحفظ." };
    updateLead(data.id, { status: data.status, note: data.note, assigned_to: data.assigned_to }, staff.id);
    return ok(null, "تم تحديث الطلب.");
  });
}

const contactSchema = z.object({ id, channel: z.enum(["whatsapp", "phone", "email"]) });

export async function logLeadContactAction(input: z.input<typeof contactSchema>): Promise<ActionResult<null>> {
  return staffAction("leads.manage", contactSchema, input, (data, staff) => {
    if (!getLead(data.id)) return { ok: false, error: "الطلب غير موجود." };
    const labels = { whatsapp: "تواصل عبر واتساب", phone: "اتصال هاتفي", email: "مراسلة بالبريد الإلكتروني" };
    logLeadContact(data.id, staff.id, labels[data.channel]);
    return ok(null);
  });
}

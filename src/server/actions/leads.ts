"use server";

import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { isCountry } from "@/lib/countries";
import { addDays, formatDay, todayDay } from "@/lib/dates";
import { isCurrency } from "@/lib/money";
import { toE164 } from "@/lib/phone";
import { optionPrice } from "@/lib/program-pricing";
import { LEAD_STATUSES, ROOM_TYPES, pick } from "@/lib/travel-labels";
import { col } from "../db";
import { createLead, getLead, logLeadContact, updateLead } from "../repo/leads";
import { departureForRequest, getProgramDoc, recordProgramView } from "../repo/programs";
import { rateLimit, requestMeta } from "../security";
import { id, optEmail, optText } from "../validation";
import { staffAction } from "./guard";

// ------------------------------------------------------------------ Public: trip request
const MESSAGES = {
  ar: {
    invalid: "تحقق من البيانات المدخلة.",
    program: "هذا العرض لم يعد متاحاً للحجز.",
    departure: "موعد السفر المختار لم يعد متاحاً. اختر موعداً آخر.",
    seats: "عدد المقاعد المتبقية في هذا الموعد أقل من عدد المسافرين.",
    hotel: "خيار الفندق المختار لم يعد متاحاً.",
    name: "اكتب الاسم الكامل.",
    phone: "رقم الهاتف غير صحيح.",
    date: "اختر تاريخاً قادماً.",
    country: "اختر الدولة التي تريد السفر إليها.",
    rate: "تم استلام عدة طلبات من جهازك. انتظر قليلاً أو تواصل معنا عبر واتساب.",
    error: "تعذّر إرسال الطلب الآن. حاول مرة أخرى أو تواصل معنا عبر واتساب.",
  },
  en: {
    invalid: "Please check the details you entered.",
    program: "This offer is no longer available for booking.",
    departure: "The selected date is no longer available. Please choose another date.",
    seats: "There are fewer seats left on this date than travelers in your request.",
    hotel: "The selected hotel option is no longer available.",
    name: "Please enter your full name.",
    phone: "The phone number is not valid.",
    date: "Please choose a future date.",
    country: "Please choose the country you would like to visit.",
    rate: "Several requests were received from your device. Please wait a little or contact us on WhatsApp.",
    error: "We couldn't send your request right now. Please try again or contact us on WhatsApp.",
  },
};

const optDayInput = z.string().nullable().optional().transform((v) => v || null);

const requestSchema = z.object({
  locale: z.enum(["ar", "en"]),
  program_id: id,
  departure_id: id.nullable(),
  hotel_option_id: z.string().max(64).nullable().optional(),
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
  // Tailor-made (custom) program wishes.
  custom: z
    .object({
      country_codes: z.array(z.string()).max(5),
      places: optText(200),
      date_from: optDayInput,
      date_to: optDayInput,
      flexible: z.boolean(),
      days: z.number().int().min(1).max(90).nullable(),
      nights: z.number().int().min(0).max(90).nullable(),
      departure_airport: optText(80),
      hotel_stars: z.number().int().min(1).max(5).nullable(),
      budget_amount: z.number().int().min(0).max(100_000_000_000).nullable(),
      budget_currency: z.string().nullable(),
      airline_pref: optText(80),
      services: z.array(z.string().max(80)).max(20),
      activities: optText(1000),
    })
    .nullable()
    .optional(),
  // Spam signals: a hidden field humans leave empty, and the time the form was open.
  website: z.string().max(200).optional(),
  elapsed_ms: z.number().int().min(0).optional(),
});

export type TripRequestInput = z.input<typeof requestSchema>;

const isFutureDay = (d: string | null) => !d || (/^\d{4}-\d{2}-\d{2}$/.test(d) && d >= todayDay() && d <= addDays(todayDay(), 730));

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
    if (!(await rateLimit("trip-request", meta.ipHash, 6, 30 * 60))) return { ok: false, error: t.rate };

    const program = await getProgramDoc(d.program_id);
    if (!program || program.status !== "published") return { ok: false, error: t.program };

    const base = {
      program_id: program._id,
      program_title: program.title_ar,
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
    } as const;

    if (program.type === "custom") {
      const c = d.custom;
      if (!c) return { ok: false, error: t.invalid };
      const countries = c.country_codes.filter(isCountry);
      if (!countries.length) countries.push(...program.country_codes);
      if (!countries.length) return { ok: false, error: t.country, fieldErrors: { country_codes: t.country } };
      if (!isFutureDay(c.date_from) || !isFutureDay(c.date_to) || (c.date_from && c.date_to && c.date_to < c.date_from))
        return { ok: false, error: t.date, fieldErrors: { date_from: t.date } };
      const { ref } = await createLead({
        ...base,
        kind: "custom",
        departure_id: null,
        departure_label: null,
        preferred_date: c.date_from,
        hotel_option: null,
        custom: {
          country_codes: countries,
          places: c.places,
          date_from: c.date_from,
          date_to: c.date_to,
          flexible: c.flexible,
          days: c.days,
          nights: c.nights,
          departure_airport: c.departure_airport,
          hotel_stars: c.hotel_stars,
          budget_amount: c.budget_amount,
          budget_currency: c.budget_currency && isCurrency(c.budget_currency) ? c.budget_currency : null,
          airline_pref: c.airline_pref,
          services: c.services.map((s) => s.trim()).filter(Boolean),
          activities: c.activities,
        },
      });
      return ok({ ref });
    }

    // Fixed program: a bookable date (when the program has dates) and optionally a hotel choice.
    let departureLabel: string | null = null;
    let preferred: string | null = null;
    let supplement = 0;
    if (d.departure_id) {
      const dep = await departureForRequest(program._id, d.departure_id);
      if (!dep || !dep.state.bookable) return { ok: false, error: t.departure, fieldErrors: { departure_id: t.departure } };
      if (dep.state.seatsLeft < d.adults + d.children) return { ok: false, error: t.seats, fieldErrors: { departure_id: t.seats } };
      departureLabel = `${dep.row.code} · ${formatDay(dep.row.depart_date, "ar")} → ${formatDay(dep.row.return_date, "ar")}`;
      supplement = dep.row.price_supplement;
    } else if (d.preferred_date) {
      if (!isFutureDay(d.preferred_date)) return { ok: false, error: t.date, fieldErrors: { preferred_date: t.date } };
      preferred = d.preferred_date;
    }
    let hotelOption = null;
    if (d.hotel_option_id) {
      const o = program.hotel_options.find((x) => x.id === d.hotel_option_id);
      if (!o) return { ok: false, error: t.hotel, fieldErrors: { hotel_option_id: t.hotel } };
      const hotel = await (await col<{ _id: number; name_ar: string; name_en: string }>("hotels")).findOne({ _id: o.hotel_id }, { projection: { name_ar: 1, name_en: 1 } });
      // The price the traveler saw is copied into the request (later price changes don't alter it).
      hotelOption = {
        id: o.id,
        label: [hotel?.name_ar, pick("ar", o.room_ar, o.room_en)].filter(Boolean).join(" — "),
        price: optionPrice(program, o) + supplement,
        currency: program.currency,
      };
    }

    const { ref } = await createLead({ ...base, kind: "program", departure_id: d.departure_id, departure_label: departureLabel, preferred_date: preferred, hotel_option: hotelOption, custom: null });
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
  if (!(await rateLimit("program-view", `${meta.ipHash}:${programId}`, 3, 3600))) return;
  await recordProgramView(programId);
}

// ------------------------------------------------------------------ Staff
const updateSchema = z.object({
  id,
  status: z.enum(LEAD_STATUSES).optional(),
  note: optText(2000),
  assigned_to: id.nullable().optional(),
});

export async function updateLeadAction(input: z.input<typeof updateSchema>): Promise<ActionResult<null>> {
  return staffAction("leads.manage", updateSchema, input, async (data, staff) => {
    if (!(await getLead(data.id))) return { ok: false, error: "الطلب غير موجود." };
    if (data.assigned_to && !(await (await col("staff_users")).findOne({ _id: data.assigned_to, active: true }))) return { ok: false, error: "الموظف غير موجود." };
    if (!data.status && !data.note && data.assigned_to === undefined) return { ok: false, error: "لا يوجد تغيير للحفظ." };
    await updateLead(data.id, { status: data.status, note: data.note, assigned_to: data.assigned_to }, staff.id);
    return ok(null, data.status === "confirmed" ? "تم تأكيد الطلب وحجز المقاعد." : "تم تحديث الطلب.");
  });
}

const contactSchema = z.object({ id, channel: z.enum(["whatsapp", "phone", "email"]) });

export async function logLeadContactAction(input: z.input<typeof contactSchema>): Promise<ActionResult<null>> {
  return staffAction("leads.manage", contactSchema, input, async (data, staff) => {
    if (!(await getLead(data.id))) return { ok: false, error: "الطلب غير موجود." };
    const labels = { whatsapp: "تواصل عبر واتساب", phone: "اتصال هاتفي", email: "مراسلة بالبريد الإلكتروني" };
    await logLeadContact(data.id, staff.id, labels[data.channel]);
    return ok(null);
  });
}


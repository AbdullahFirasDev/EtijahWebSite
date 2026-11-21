"use server";

import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { countryName } from "@/lib/countries";
import { daysBetween, todayDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { BOARDS, ITEM_UNITS } from "@/lib/travel-labels";
import { getCompanyUser, getStaff } from "../auth/session";
import { mediaExist } from "../media";
import { getB2bRequest } from "../repo/b2b";
import { existingIds, RATE_BASES } from "../repo/catalog";
import { getCompany } from "../repo/companies";
import { getLeadDoc, logLeadQuote } from "../repo/leads";
import { getProgramDoc } from "../repo/programs";
import { getSettings } from "../repo/settings";
import {
  canRespond,
  clientLinkOpen,
  deleteQuote,
  duplicateQuote,
  getCompanyQuote,
  getQuoteByToken,
  getQuoteEditor,
  markQuoteSent,
  quoteDraftFromProgram,
  recordQuoteView,
  regenerateQuoteLink,
  respondToQuote,
  revokeQuoteLink,
  saveQuote,
  sendProblems,
  setQuoteLinkExpiry,
  setQuoteStatus,
} from "../repo/quotes";
import { audit, rateLimit, requestMeta } from "../security";
import { country, currency, day, id, int, mediaId, money, optDay, optEmail, optText, reqText } from "../validation";
import { companyAction, staffAction } from "./guard";

const quoteSchema = z
  .object({
    audience: z.enum(["company", "traveler"]),
    company_id: id.nullable(),
    contact_id: id.nullable(),
    lead_id: id.nullable(),
    b2b_request_id: id.nullable(),
    client: z.object({ name: reqText(2, 120, "اسم المسافر"), phone: optText(40), email: optEmail }).nullable(),
    beneficiary: z.object({ name: optText(160), note: optText(300) }).nullable(),
    branding: z.enum(["company", "etijah"]),
    program_id: id.nullable(),
    locale: z.enum(["ar", "en"]),
    title: reqText(3, 160, "عنوان العرض"),
    destination: optText(300),
    destinations: z
      .array(z.object({ country_code: country, city: optText(120), entry_date: optDay, exit_date: optDay }))
      .max(30)
      .default([]),
    intro: optText(2000),
    start_date: optDay,
    end_date: optDay,
    adults: int(0, 2000, "عدد البالغين"),
    children: int(0, 2000, "عدد الأطفال"),
    infants: int(0, 500, "عدد الرضّع"),
    rooms: int(0, 1000, "عدد الغرف"),
    rooms_note: optText(300),
    currency,
    pricing_mode: z.enum(["per_person", "per_room", "per_group"]),
    discount_kind: z.enum(["amount", "percent"]).nullable(),
    discount_value: z.number().int().min(0).max(100_000_000_000),
    discount_label: optText(120),
    inclusions: z.array(z.string().trim().min(1).max(300)).max(60),
    exclusions: z.array(z.string().trim().min(1).max(300)).max(60),
    notes: optText(4000),
    terms: optText(8000),
    internal_notes: optText(4000),
    cover_media_id: mediaId.nullable(),
    gallery: z.array(mediaId).max(12),
    valid_until: day,
    days: z.array(z.object({ title: reqText(2, 160, "عنوان اليوم"), body: optText(3000) })).max(90),
    hotels: z
      .array(
        z.object({
          id: z.string().max(64).nullable(),
          hotel_id: id,
          check_in: optDay,
          check_out: optDay,
          nights: int(1, 90, "عدد الليالي"),
          room_type: optText(160),
          board: z.enum(BOARDS).nullable(),
          rooms: int(0, 1000, "عدد الغرف").nullable(),
          rate: z
            .object({
              rate_id: z.string().max(64).nullable(),
              source: z.enum(["library", "company", "custom"]),
              basis: z.enum(RATE_BASES),
              occupancy: int(1, 20, "عدد الأشخاص"),
              currency,
              night_price: money,
              night_cost: money.nullable(),
              refresh: z.boolean(),
            })
            .nullable(),
        }),
      )
      .max(20),
    items: z
      .array(
        z.object({
          kind: z.enum(["main", "fee", "option"]),
          label: reqText(2, 160, "وصف البند"),
          description: optText(400),
          unit: z.enum(ITEM_UNITS),
          quantity: int(1, 100_000, "الكمية"),
          unit_price: money,
          unit_cost: money.nullable(),
        }),
      )
      .max(60),
  })
  .refine((q) => !q.start_date || !q.end_date || q.end_date >= q.start_date, { message: "تاريخ العودة قبل تاريخ السفر.", path: ["end_date"] })
  .refine((q) => q.discount_kind !== "percent" || q.discount_value <= 10000, { message: "نسبة الخصم لا تتجاوز 100%.", path: ["discount_value"] })
  .refine((q) => q.hotels.every((h) => !h.check_in || !h.check_out || h.check_out > h.check_in), { message: "تاريخ المغادرة من الفندق يجب أن يكون بعد تاريخ الوصول.", path: ["hotels"] })
  .refine((q) => q.destinations.every((d) => !d.entry_date || !d.exit_date || d.exit_date >= d.entry_date), { message: "تاريخ الخروج من إحدى الوجهات قبل تاريخ الدخول إليها.", path: ["destinations"] })
  .refine((q) => q.audience === "traveler" || q.company_id, { message: "اختر الشركة المستلمة.", path: ["company_id"] })
  .refine((q) => q.audience === "company" || q.client, { message: "أدخل بيانات المسافر المستلم.", path: ["client"] });

export async function saveQuoteAction(input: { id: number | null; quote: unknown }): Promise<ActionResult<{ id: number }>> {
  return staffAction("quotes.manage", z.object({ id: id.nullable(), quote: quoteSchema }), input, async (data, staff) => {
    const q = data.quote;
    if (data.id && !(await getQuoteEditor(data.id))) return { ok: false, error: "العرض غير موجود." };
    if (q.audience === "company") {
      const company = await getCompany(q.company_id!);
      if (!company) return { ok: false, error: "اختر الشركة المستلمة.", fieldErrors: { company_id: "مطلوب" } };
      if (q.contact_id && !company.contacts.some((c) => c.id === q.contact_id)) return { ok: false, error: "جهة الاتصال لا تتبع هذه الشركة." };
      if (q.b2b_request_id && !(await getB2bRequest(q.b2b_request_id, company._id))) return { ok: false, error: "طلب الشركة لا يتبع هذه الشركة." };
    } else if (q.branding === "company") return { ok: false, error: "عروض المسافرين تصدر بهوية الاتجاه." };
    if (q.lead_id && !(await getLeadDoc(q.lead_id))) return { ok: false, error: "طلب المسافر غير موجود." };
    if (q.program_id && !(await getProgramDoc(q.program_id))) return { ok: false, error: "البرنامج المصدر غير موجود." };
    if (!(await getSettings()).currencies.includes(q.currency as never)) return { ok: false, error: "العملة غير مفعّلة في الإعدادات." };
    if (!(await existingIds("hotels", q.hotels.map((h) => h.hotel_id)))) return { ok: false, error: "أحد الفنادق غير موجود." };
    if (!(await mediaExist([q.cover_media_id, ...q.gallery]))) return { ok: false, error: "إحدى الصور غير موجودة." };
    const savedId = await saveQuote(
      data.id,
      {
        ...q,
        company_id: q.audience === "company" ? q.company_id : null,
        contact_id: q.audience === "company" ? q.contact_id : null,
        client: q.audience === "traveler" ? q.client : null,
        gallery: [...new Set(q.gallery)],
      },
      staff.id,
    );
    if (!data.id && q.lead_id) {
      const saved = await getQuoteEditor(savedId);
      await logLeadQuote(q.lead_id, staff.id, saved!.ref);
    }
    return ok({ id: savedId }, data.id ? "تم حفظ التعديلات." : "تم إنشاء عرض السعر كمسودة.");
  });
}

export async function programDraftForQuoteAction(input: { programId: number; locale: "ar" | "en"; adults: number; optionId?: string | null }) {
  return staffAction(
    "quotes.manage",
    z.object({ programId: id, locale: z.enum(["ar", "en"]), adults: z.number().int().min(0).max(2000), optionId: z.string().max(64).nullish() }),
    input,
    async (data) => {
      const draft = await quoteDraftFromProgram(data.programId, data.locale, data.adults, data.optionId);
      return draft ? ok(draft) : { ok: false as const, error: "البرنامج غير موجود." };
    },
  );
}

/**
 * Pre-filled content for a quote answering a traveler request (typically a tailor-made program
 * request): recipient, travelers, dates, destination and the traveler's wishes as internal notes.
 */
export async function leadDraftForQuoteAction(leadId: number) {
  return staffAction("quotes.manage", id, leadId, async (lid) => {
    const l = await getLeadDoc(lid);
    if (!l) return { ok: false as const, error: "الطلب غير موجود." };
    const c = l.custom;
    const wishes = c
      ? [
          c.country_codes.length ? `الدول: ${c.country_codes.map((x) => countryName(x, "ar")).join("، ")}` : null,
          c.places ? `المدن/الأماكن: ${c.places}` : null,
          c.date_from || c.date_to ? `الموعد: ${c.date_from ?? "؟"} → ${c.date_to ?? "؟"}${c.flexible ? " (مرن)" : ""}` : null,
          c.days || c.nights ? `المدة: ${c.days ?? "؟"} أيام / ${c.nights ?? "؟"} ليالٍ` : null,
          c.departure_airport ? `مطار المغادرة: ${c.departure_airport}` : null,
          c.hotel_stars ? `الفندق: ${c.hotel_stars} نجوم` : null,
          c.budget_amount ? `الميزانية التقريبية: ${formatMoney(c.budget_amount, c.budget_currency ?? "USD", "ar")}` : null,
          c.airline_pref ? `شركة الطيران المفضلة: ${c.airline_pref}` : null,
          c.services.length ? `الخدمات المطلوبة: ${c.services.join("، ")}` : null,
          c.activities ? `الأنشطة: ${c.activities}` : null,
        ].filter(Boolean)
      : [];
    const start = c?.date_from ?? l.preferred_date ?? null;
    const end = c?.date_to ?? null;
    const codes = c?.country_codes ?? [];
    return ok({
      lead_id: l._id,
      program_id: l.program_id,
      locale: l.locale,
      client: { name: l.full_name, phone: l.phone, email: l.email },
      title: c ? `${l.locale === "en" ? "Tailor-made trip" : "برنامج خاص"} — ${c.country_codes.map((x) => countryName(x, l.locale)).join(l.locale === "en" ? ", " : "، ")}` : l.program_title,
      destination: c ? [c.country_codes.map((x) => countryName(x, l.locale)).join(" · "), c.places].filter(Boolean).join(" — ") : null,
      destinations: codes.map((code, i) => ({ country_code: code, city: null, entry_date: i === 0 ? start : null, exit_date: i === codes.length - 1 ? end : null })),
      start_date: start,
      end_date: end,
      adults: l.adults,
      children: l.children,
      infants: l.infants,
      rooms: l.rooms,
      internal_notes: [`طلب المسافر ${l.ref}`, ...wishes, l.notes ? `ملاحظات المسافر: ${l.notes}` : null].filter(Boolean).join("\n"),
      nights: start && end ? Math.max(1, daysBetween(start, end)) : (c?.nights ?? null),
    });
  });
}

/** Pre-filled content for a quote answering a partner (B2B portal) request. */
export async function b2bRequestDraftAction(requestId: number) {
  return staffAction("quotes.manage", id, requestId, async (rid) => {
    const r = await getB2bRequest(rid);
    if (!r) return { ok: false as const, error: "الطلب غير موجود." };
    return ok({
      b2b_request_id: r._id,
      company_id: r.company_id,
      title: r.title,
      destination: [r.country_codes.map((x) => countryName(x, "ar")).join(" · "), r.places].filter(Boolean).join(" — ") || null,
      destinations: r.country_codes.map((code, i) => ({ country_code: code, city: null, entry_date: i === 0 ? r.date_from : null, exit_date: i === r.country_codes.length - 1 ? r.date_to : null })),
      start_date: r.date_from,
      end_date: r.date_to,
      adults: r.adults,
      children: r.children,
      rooms: r.rooms,
      hotel_ids: r.hotel_ids,
      beneficiary: r.beneficiary,
      internal_notes: [`طلب الشركة ${r.ref}`, r.hotel_stars ? `نجوم الفندق: ${r.hotel_stars}` : null, r.budget ? `الميزانية: ${r.budget}` : null, r.notes ? `ملاحظات: ${r.notes}` : null].filter(Boolean).join("\n"),
    });
  });
}

const sendSchema = z.object({ id, channel: z.enum(["whatsapp", "email", "link", "portal"]) });

export async function markQuoteSentAction(input: z.input<typeof sendSchema>): Promise<ActionResult<null>> {
  return staffAction("quotes.manage", sendSchema, input, async (data, staff) => {
    const q = await getQuoteEditor(data.id);
    if (!q) return { ok: false, error: "العرض غير موجود." };
    const problems = sendProblems(q);
    if (problems.length) return { ok: false, error: problems.join(" ") };
    await markQuoteSent(data.id, data.channel, staff.id);
    return ok(null, data.channel === "portal" ? "أصبح العرض متاحاً لمستخدمي الشركة في بوابتهم." : "تم تسجيل إرسال العرض.");
  });
}

const statusSchema = z.object({ id, status: z.enum(["accepted", "rejected", "sent", "draft"]), note: optText(1000) });

export async function setQuoteStatusAction(input: z.input<typeof statusSchema>): Promise<ActionResult<null>> {
  return staffAction("quotes.manage", statusSchema, input, async (data, staff) => {
    const q = await getQuoteEditor(data.id);
    if (!q) return { ok: false, error: "العرض غير موجود." };
    if (data.status === "draft" && q.status !== "draft" && q.view_count > 0) return { ok: false, error: "لا يمكن إعادة عرض شاهده العميل إلى المسودات." };
    await setQuoteStatus(data.id, data.status, staff.id, data.note);
    return ok(null, "تم تحديث حالة العرض.");
  });
}

const linkSchema = z.object({ id, action: z.enum(["revoke", "regenerate", "expiry"]), expires: optDay });

export async function quoteLinkAction(input: z.input<typeof linkSchema>): Promise<ActionResult<null>> {
  return staffAction("quotes.manage", linkSchema, input, async (data, staff) => {
    if (!(await getQuoteEditor(data.id))) return { ok: false, error: "العرض غير موجود." };
    if (data.action === "revoke") await revokeQuoteLink(data.id, staff.id);
    else if (data.action === "regenerate") await regenerateQuoteLink(data.id, staff.id);
    else {
      if (data.expires && data.expires < todayDay()) return { ok: false, error: "تاريخ انتهاء الرابط في الماضي." };
      await setQuoteLinkExpiry(data.id, data.expires, staff.id);
    }
    const msg = { revoke: "تم إبطال الرابط. لن يتمكن أحد من فتحه.", regenerate: "تم إنشاء رابط جديد، وأُبطل الرابط السابق.", expiry: "تم تحديث صلاحية الرابط." };
    return ok(null, msg[data.action]);
  });
}

export async function duplicateQuoteAction(quoteId: number): Promise<ActionResult<{ id: number }>> {
  return staffAction("quotes.manage", id, quoteId, async (qid, staff) => {
    const newId = await duplicateQuote(qid, staff.id);
    return newId ? ok({ id: newId }, "تم إنشاء نسخة جديدة كمسودة بأسعار الفنادق الحالية.") : { ok: false, error: "العرض غير موجود." };
  });
}

export async function deleteQuoteAction(quoteId: number): Promise<ActionResult<null>> {
  return staffAction("b2b.delete", id, quoteId, async (qid, staff) => {
    await deleteQuote(qid, staff.id);
    return ok(null, "تم حذف العرض.");
  });
}

// ------------------------------------------------------------------ Public (client link holders)
/** Records a client view. Called from the browser only (link-preview bots do not run it). */
export async function quoteViewedAction(token: string): Promise<void> {
  if (typeof token !== "string") return;
  const q = await getQuoteByToken(token);
  if (!q || !clientLinkOpen(q)) return;
  if (await getStaff()) return; // Staff previews are not client views.
  await recordQuoteView(q);
}

const respondSchema = z.object({
  token: z.string().max(60),
  action: z.enum(["accept", "changes"]),
  name: z.string().max(200),
  note: optText(2000),
});

export async function respondToQuoteAction(input: z.input<typeof respondSchema>): Promise<ActionResult<{ status: string }>> {
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request / الطلب غير صالح." };
  const d = parsed.data;
  const q = await getQuoteByToken(d.token);
  const companyUser = await getCompanyUser();
  const ownCompany = !!q && !!companyUser && q.company_id === companyUser.companyId && q.status !== "draft";
  if (!q || (!clientLinkOpen(q) && !ownCompany)) return { ok: false, error: "This link is no longer available. / هذا الرابط لم يعد متاحاً." };
  const ar = q.locale === "ar";
  if (await getStaff()) return { ok: false, error: ar ? "هذه معاينة موظف. لا يمكن الرد على العرض نيابةً عن العميل." : "This is a staff preview; responses are disabled." };
  if (ownCompany && !companyUser!.permissions.includes("quotes.respond")) return { ok: false, error: ar ? "لا تملك صلاحية الرد على العروض." : "You are not allowed to answer quotes." };
  if (!canRespond(q)) return { ok: false, error: ar ? "لا يمكن الرد على هذا العرض حالياً (انتهت صلاحيته أو تم الرد عليه)." : "This quote can no longer be answered (expired or already answered)." };
  const name = d.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return { ok: false, error: ar ? "اكتب اسمك." : "Please enter your name.", fieldErrors: { name: "required" } };
  if (d.action === "changes" && !d.note) return { ok: false, error: ar ? "اكتب التعديلات المطلوبة." : "Please describe the changes you need.", fieldErrors: { note: "required" } };
  const meta = await requestMeta();
  if (!(await rateLimit("quote-response", `${meta.ipHash}:${q._id}`, 5, 3600))) return { ok: false, error: ar ? "محاولات كثيرة، حاول لاحقاً." : "Too many attempts, try later." };
  if (!(await respondToQuote(q, d.action, name, d.note, ownCompany ? "portal" : "link"))) return { ok: false, error: ar ? "تم الرد على هذا العرض مسبقاً." : "This quote was already answered." };
  return ok({ status: d.action === "accept" ? "accepted" : "changes_requested" });
}

/** Partner portal: accept a quote or ask for changes, as the signed-in company user. */
export async function portalRespondAction(input: { quoteId: number; action: "accept" | "changes"; note: string | null }): Promise<ActionResult<{ status: string }>> {
  return companyAction("quotes.respond", z.object({ quoteId: id, action: z.enum(["accept", "changes"]), note: optText(2000) }), input, async (data, user) => {
    const q = await getCompanyQuote(user.companyId, data.quoteId);
    if (!q) return { ok: false, error: "العرض غير موجود. / Quote not found." };
    if (!canRespond(q)) return { ok: false, error: "لا يمكن الرد على هذا العرض حالياً. / This quote can no longer be answered." };
    if (data.action === "changes" && !data.note) return { ok: false, error: "اكتب التعديلات المطلوبة. / Describe the changes.", fieldErrors: { note: "required" } };
    if (!(await respondToQuote(q, data.action, user.name, data.note, "portal"))) return { ok: false, error: "تم الرد على هذا العرض مسبقاً." };
    await audit(user.id, data.action === "accept" ? "accept" : "request_changes", "quote", q._id, { company_id: user.companyId }, { actor: "company" });
    return ok({ status: data.action === "accept" ? "accepted" : "changes_requested" }, data.action === "accept" ? "تم قبول العرض. سيتواصل معكم فريق الاتجاه." : "تم إرسال طلب التعديل.");
  });
}

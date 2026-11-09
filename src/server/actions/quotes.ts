"use server";

import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { todayDay } from "@/lib/dates";
import { ITEM_UNITS, BOARDS } from "@/lib/travel-labels";
import { all, get, placeholders } from "../db";
import { getStaff } from "../auth/session";
import { mediaExists } from "../media";
import { getSettings } from "../repo/settings";
import {
  canRespond,
  clientLinkOpen,
  deleteQuote,
  duplicateQuote,
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
import { rateLimit, requestMeta } from "../security";
import { currency, day, id, int, mediaId, money, optDay, optText, reqText } from "../validation";
import { staffAction } from "./guard";

const quoteSchema = z
  .object({
    company_id: id,
    contact_id: id.nullable(),
    program_id: id.nullable(),
    locale: z.enum(["ar", "en"]),
    title: reqText(3, 160, "عنوان العرض"),
    destination: optText(160),
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
          hotel_id: id,
          check_in: optDay,
          check_out: optDay,
          nights: int(1, 90, "عدد الليالي"),
          room_type: optText(160),
          board: z.enum(BOARDS).nullable(),
          rooms: int(0, 1000, "عدد الغرف").nullable(),
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
  .refine((q) => q.hotels.every((h) => !h.check_in || !h.check_out || h.check_out > h.check_in), { message: "تاريخ المغادرة من الفندق يجب أن يكون بعد تاريخ الوصول.", path: ["hotels"] });

export async function saveQuoteAction(input: { id: number | null; quote: unknown }): Promise<ActionResult<{ id: number }>> {
  return staffAction("b2b.manage", z.object({ id: id.nullable(), quote: quoteSchema }), input, (data, staff) => {
    const q = data.quote;
    if (data.id && !getQuoteEditor(data.id)) return { ok: false, error: "العرض غير موجود." };
    if (!get("SELECT 1 FROM companies WHERE id = ?", q.company_id)) return { ok: false, error: "اختر الشركة المستلمة.", fieldErrors: { company_id: "مطلوب" } };
    if (q.contact_id && !get("SELECT 1 FROM company_contacts WHERE id = ? AND company_id = ?", q.contact_id, q.company_id))
      return { ok: false, error: "جهة الاتصال لا تتبع هذه الشركة." };
    if (q.program_id && !get("SELECT 1 FROM programs WHERE id = ?", q.program_id)) return { ok: false, error: "البرنامج المصدر غير موجود." };
    if (!getSettings().currencies.includes(q.currency as never)) return { ok: false, error: "العملة غير مفعّلة في الإعدادات." };
    const hotelIds = [...new Set(q.hotels.map((h) => h.hotel_id))];
    if (hotelIds.length && all(`SELECT id FROM hotels WHERE id IN (${placeholders(hotelIds.length)})`, ...hotelIds).length !== hotelIds.length)
      return { ok: false, error: "أحد الفنادق غير موجود." };
    const mediaIds = [...(q.cover_media_id ? [q.cover_media_id] : []), ...q.gallery];
    if (mediaIds.some((m) => !mediaExists(m))) return { ok: false, error: "إحدى الصور غير موجودة." };
    const savedId = saveQuote(data.id, { ...q, gallery: [...new Set(q.gallery)] }, staff.id);
    return ok({ id: savedId }, data.id ? "تم حفظ التعديلات." : "تم إنشاء عرض السعر كمسودة.");
  });
}

export async function programDraftForQuoteAction(input: { programId: number; locale: "ar" | "en"; adults: number }) {
  return staffAction(
    "b2b.manage",
    z.object({ programId: id, locale: z.enum(["ar", "en"]), adults: z.number().int().min(0).max(2000) }),
    input,
    (data) => {
      const draft = quoteDraftFromProgram(data.programId, data.locale, data.adults);
      return draft ? ok(draft) : { ok: false as const, error: "البرنامج غير موجود." };
    },
  );
}

const sendSchema = z.object({ id, channel: z.enum(["whatsapp", "email", "link"]) });

export async function markQuoteSentAction(input: z.input<typeof sendSchema>): Promise<ActionResult<null>> {
  return staffAction("b2b.manage", sendSchema, input, (data, staff) => {
    const q = getQuoteEditor(data.id);
    if (!q) return { ok: false, error: "العرض غير موجود." };
    const problems = sendProblems(q);
    if (problems.length) return { ok: false, error: problems.join(" ") };
    markQuoteSent(data.id, data.channel, staff.id);
    return ok(null, "تم تسجيل إرسال العرض.");
  });
}

const statusSchema = z.object({ id, status: z.enum(["accepted", "rejected", "sent", "draft"]), note: optText(1000) });

export async function setQuoteStatusAction(input: z.input<typeof statusSchema>): Promise<ActionResult<null>> {
  return staffAction("b2b.manage", statusSchema, input, (data, staff) => {
    const q = getQuoteEditor(data.id);
    if (!q) return { ok: false, error: "العرض غير موجود." };
    if (data.status === "draft" && q.status !== "draft" && q.view_count > 0) return { ok: false, error: "لا يمكن إعادة عرض شاهده العميل إلى المسودات." };
    setQuoteStatus(data.id, data.status, staff.id, data.note);
    return ok(null, "تم تحديث حالة العرض.");
  });
}

const linkSchema = z.object({ id, action: z.enum(["revoke", "regenerate", "expiry"]), expires: optDay });

export async function quoteLinkAction(input: z.input<typeof linkSchema>): Promise<ActionResult<null>> {
  return staffAction("b2b.manage", linkSchema, input, (data, staff) => {
    if (!getQuoteEditor(data.id)) return { ok: false, error: "العرض غير موجود." };
    if (data.action === "revoke") revokeQuoteLink(data.id, staff.id);
    else if (data.action === "regenerate") regenerateQuoteLink(data.id, staff.id);
    else {
      if (data.expires && data.expires < todayDay()) return { ok: false, error: "تاريخ انتهاء الرابط في الماضي." };
      setQuoteLinkExpiry(data.id, data.expires, staff.id);
    }
    const msg = { revoke: "تم إبطال الرابط. لن يتمكن أحد من فتحه.", regenerate: "تم إنشاء رابط جديد، وأُبطل الرابط السابق.", expiry: "تم تحديث صلاحية الرابط." };
    return ok(null, msg[data.action]);
  });
}

export async function duplicateQuoteAction(quoteId: number): Promise<ActionResult<{ id: number }>> {
  return staffAction("b2b.manage", id, quoteId, (qid, staff) => {
    const newId = duplicateQuote(qid, staff.id);
    return newId ? ok({ id: newId }, "تم إنشاء نسخة جديدة كمسودة.") : { ok: false, error: "العرض غير موجود." };
  });
}

export async function deleteQuoteAction(quoteId: number): Promise<ActionResult<null>> {
  return staffAction("b2b.delete", id, quoteId, (qid, staff) => {
    deleteQuote(qid, staff.id);
    return ok(null, "تم حذف العرض.");
  });
}

// ------------------------------------------------------------------ Public (client link holders)
/** Records a client view. Called from the browser only (link-preview bots do not run it). */
export async function quoteViewedAction(token: string): Promise<void> {
  if (typeof token !== "string") return;
  const q = getQuoteByToken(token);
  if (!q || !clientLinkOpen(q)) return;
  if (await getStaff()) return; // Staff previews are not client views.
  recordQuoteView(q);
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
  const q = getQuoteByToken(d.token);
  if (!q || !clientLinkOpen(q)) return { ok: false, error: "This link is no longer available. / هذا الرابط لم يعد متاحاً." };
  const ar = q.locale === "ar";
  if (await getStaff()) return { ok: false, error: ar ? "هذه معاينة موظف. لا يمكن الرد على العرض نيابةً عن العميل." : "This is a staff preview; responses are disabled." };
  if (!canRespond(q)) return { ok: false, error: ar ? "لا يمكن الرد على هذا العرض حالياً (انتهت صلاحيته أو تم الرد عليه)." : "This quote can no longer be answered (expired or already answered)." };
  const name = d.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return { ok: false, error: ar ? "اكتب اسمك." : "Please enter your name.", fieldErrors: { name: "required" } };
  if (d.action === "changes" && !d.note) return { ok: false, error: ar ? "اكتب التعديلات المطلوبة." : "Please describe the changes you need.", fieldErrors: { note: "required" } };
  const meta = await requestMeta();
  if (!rateLimit("quote-response", `${meta.ipHash}:${q.id}`, 5, 3600)) return { ok: false, error: ar ? "محاولات كثيرة، حاول لاحقاً." : "Too many attempts, try later." };
  respondToQuote(q, d.action, name, d.note);
  return ok({ status: d.action === "accept" ? "accepted" : "changes_requested" });
}

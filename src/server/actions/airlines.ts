"use server";

import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { COMMISSION_BASES, COMMISSION_KINDS, COMMISSION_METHODS } from "@/lib/commission-math";
import { isCountry } from "@/lib/countries";
import { isCurrency } from "@/lib/money";
import { mediaExist } from "../media";
import {
  addRule,
  AIRLINE_STATUSES,
  CREDIT_MODES,
  deleteAirline,
  deleteRule,
  endRule,
  getAirline,
  iataTaken,
  ISSUE_METHODS,
} from "../repo/airlines";
import { saveAirline } from "../repo/airlines";
import { getCompany } from "../repo/companies";
import { createTicket, getTicket, PAYMENT_STATUSES, previewTicket, SETTLEMENT_STATUSES, updateTicketPayment, voidTicket, type TicketInput } from "../repo/tickets";
import { basisPoints, day, id, mediaId, money, optDay, optEmail, optText, optUrl, reqText } from "../validation";
import { staffAction } from "./guard";

// ------------------------------------------------------------------ Airlines
const issuanceSchema = z.object({
  method: z.enum(ISSUE_METHODS),
  method_note: optText(300),
  portal_url: optUrl,
  email: optEmail,
  phone: optText(40),
  instructions: optText(6000),
  documents: optText(2000),
  booking_request: optText(2000),
  confirmation: optText(2000),
  payment: optText(2000),
  prepayment_required: z.boolean(),
  credit: z.enum(CREDIT_MODES),
  credit_note: optText(500),
  access_notes: optText(2000),
  secret_ref: optText(200),
  notes: optText(3000),
});

const airlineSchema = z.object({
  id: id.nullable(),
  name_ar: reqText(2, 120, "اسم شركة الطيران بالعربية"),
  name_en: reqText(2, 120, "اسم شركة الطيران بالإنجليزية"),
  iata: optText(3).refine((v) => v === null || /^[A-Za-z0-9]{2}$/.test(v), { message: "رمز IATA حرفان أو حرف ورقم (مثل IA أو TK)." }),
  logo_media_id: mediaId.nullable(),
  country_code: z.string().nullable().refine((v) => v === null || isCountry(v), { message: "الدولة غير صالحة." }),
  contact: z.object({ phone: optText(40), email: optEmail, website: optUrl, person: optText(100) }),
  internal_notes: optText(3000),
  status: z.enum(AIRLINE_STATUSES),
  issuance: issuanceSchema,
});

/** Passwords must never be typed into the procedure fields (they are stored as plain text). */
const looksLikeSecret = (s: string | null) => !!s && /(password|passwd|pwd|كلمة\s*(ال)?(مرور|سر)|الرقم\s*السري)\s*[:=]/i.test(s);

export async function saveAirlineAction(input: z.input<typeof airlineSchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("airlines.edit", airlineSchema.transform((a) => ({ ...a, iata: a.iata?.toUpperCase() ?? null })), input, async (data, staff) => {
    if (data.id && !(await getAirline(data.id))) return { ok: false, error: "شركة الطيران غير موجودة." };
    if (data.iata && (await iataTaken(data.iata, data.id ?? 0))) return { ok: false, error: `رمز IATA ${data.iata} مسجل لشركة طيران أخرى.`, fieldErrors: { iata: "مكرر" } };
    if (!(await mediaExist([data.logo_media_id]))) return { ok: false, error: "الشعار غير موجود. أعد رفعه." };
    const i = data.issuance;
    if ([i.access_notes, i.instructions, i.notes, i.method_note, data.internal_notes].some(looksLikeSecret))
      return { ok: false, error: "لا تحفظ كلمات المرور في النظام. اكتب في «مرجع بيانات الدخول» مكان حفظها الآمن (مثل مدير كلمات المرور) بدلاً منها.", fieldErrors: { access_notes: "بدون كلمات مرور" } };
    const { id: airlineId, ...fields } = data;
    const savedId = await saveAirline(airlineId, fields, staff.id);
    return ok({ id: savedId }, "تم حفظ بيانات شركة الطيران.");
  });
}

export async function deleteAirlineAction(airlineId: number): Promise<ActionResult<null>> {
  return staffAction("airlines.edit", id, airlineId, async (aid, staff) => {
    const problem = await deleteAirline(aid, staff.id);
    return problem ? { ok: false, error: problem } : ok(null, "تم حذف شركة الطيران.");
  });
}

// ------------------------------------------------------------------ Commission rules
const ruleSchema = z
  .object({
    scope: z.enum(["etijah", "company"]),
    airline_id: id,
    company_id: id.nullable(),
    kind: z.enum(COMMISSION_KINDS),
    method: z.enum(COMMISSION_METHODS),
    rate_bp: basisPoints,
    fixed_amount: money.nullable(),
    basis: z.enum(COMMISSION_BASES),
    basis_note: optText(300),
    currency: z.string().nullable().refine((v) => v === null || isCurrency(v), { message: "العملة غير مدعومة." }),
    settlement: optText(300),
    valid_from: day,
    valid_to: optDay,
    notes: optText(1000),
  })
  .refine((r) => r.scope === "etijah" || r.company_id, { message: "اختر الشركة.", path: ["company_id"] })
  .refine((r) => r.scope === "company" || r.company_id === null, { message: "عمولة الاتجاه لا ترتبط بشركة.", path: ["company_id"] })
  .refine((r) => r.scope === "etijah" || r.kind === "commission", { message: "عمولة الشركة إما نسبة أو مبلغ ثابت.", path: ["kind"] })
  .refine((r) => r.kind !== "commission" || r.method !== "percent" || r.rate_bp > 0, { message: "أدخل نسبة العمولة.", path: ["rate_bp"] })
  .refine((r) => r.kind !== "commission" || r.method !== "fixed" || (r.fixed_amount != null && r.fixed_amount > 0 && r.currency), { message: "أدخل مبلغ العمولة الثابتة وعملتها.", path: ["fixed_amount"] })
  .refine((r) => r.basis !== "other" || r.basis_note, { message: "اشرح أساس الاحتساب الآخر.", path: ["basis_note"] })
  .refine((r) => !r.valid_to || r.valid_to >= r.valid_from, { message: "تاريخ النهاية قبل تاريخ البداية.", path: ["valid_to"] });

export async function addRuleAction(input: z.input<typeof ruleSchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("commissions.manage", ruleSchema, input, async (data, staff) => {
    if (!(await getAirline(data.airline_id))) return { ok: false, error: "شركة الطيران غير موجودة." };
    if (data.company_id && !(await getCompany(data.company_id))) return { ok: false, error: "الشركة غير موجودة." };
    // Terms that do not apply are cleared, so a rule never carries a stale rate.
    const clean = {
      ...data,
      rate_bp: data.kind === "commission" && data.method === "percent" ? data.rate_bp : 0,
      fixed_amount: data.kind === "commission" && data.method === "fixed" ? data.fixed_amount : null,
      valid_to: data.valid_to ?? null,
    };
    const newId = await addRule(clean, staff.id);
    return ok({ id: newId }, "تم حفظ قاعدة العمولة. السجلات السابقة تحتفظ بالنسب التي احتُسبت بها.");
  });
}

export async function endRuleAction(input: { id: number; valid_to: string | null; notes: string | null }): Promise<ActionResult<null>> {
  return staffAction("commissions.manage", z.object({ id, valid_to: optDay, notes: optText(1000) }), input, async (data, staff) => {
    await endRule(data.id, data.valid_to, data.notes, staff.id);
    return ok(null, "تم تحديث القاعدة.");
  });
}

export async function deleteRuleAction(ruleId: number): Promise<ActionResult<null>> {
  return staffAction("commissions.manage", id, ruleId, async (rid, staff) => {
    await deleteRule(rid, staff.id);
    return ok(null, "تم حذف القاعدة.");
  });
}

// ------------------------------------------------------------------ Tickets
const override = z.object({ amount: money, reason: reqText(3, 300, "سبب التعديل اليدوي") }).nullable();

const ticketSchema = z
  .object({
    airline_id: id,
    company_id: id.nullable(),
    ticket_number: reqText(3, 30, "رقم التذكرة").transform((v) => v.replace(/\s+/g, "")),
    pnr: optText(12).transform((v) => v?.toUpperCase() ?? null),
    passenger: optText(120),
    route: optText(120),
    currency: z.string().refine(isCurrency, { message: "العملة غير مدعومة." }),
    base_fare: money,
    taxes: money,
    service_fee: money,
    other_basis_amount: money.nullable(),
    issue_method: z.enum(ISSUE_METHODS),
    issued_at: day,
    payment_method: optText(120),
    payment_status: z.enum(PAYMENT_STATUSES),
    paid_amount: money,
    airline_settlement: z.enum(SETTLEMENT_STATUSES),
    notes: optText(2000),
    company_override: override,
    etijah_override: override,
  })
  .refine((t) => t.base_fare > 0, { message: "أدخل السعر الأساسي للتذكرة.", path: ["base_fare"] });

async function checkRefs(t: { airline_id: number; company_id: number | null }) {
  if (!(await getAirline(t.airline_id))) return "شركة الطيران غير موجودة.";
  if (t.company_id && !(await getCompany(t.company_id))) return "الشركة غير موجودة.";
  return null;
}

/** Review step: computes both commissions from the rules in effect on the issue date. Saves nothing. */
export async function previewTicketAction(input: z.input<typeof ticketSchema>) {
  return staffAction("tickets.manage", ticketSchema, input, async (data) => {
    const problem = await checkRefs(data);
    if (problem) return { ok: false as const, error: problem };
    return ok(await previewTicket(data as TicketInput));
  });
}

export async function createTicketAction(input: { ticket: z.input<typeof ticketSchema>; expected: { company: number | null; etijah: number | null } }): Promise<ActionResult<{ id: number; ref: string }>> {
  return staffAction(
    "tickets.manage",
    z.object({ ticket: ticketSchema, expected: z.object({ company: z.number().int().nullable(), etijah: z.number().int().nullable() }) }),
    input,
    async (data, staff) => {
      const problem = await checkRefs(data.ticket);
      if (problem) return { ok: false, error: problem };
      const t = data.ticket as TicketInput;
      const preview = await previewTicket(t);
      if (t.paid_amount > preview.math.net_due) return { ok: false, error: "المبلغ المسدد أكبر من المبلغ المستحق." };
      const created = await createTicket(t, staff.id, data.expected);
      return ok(created, `تم تسجيل عملية الإصدار ${created.ref}.`);
    },
  );
}

const paymentSchema = z.object({
  id,
  payment_status: z.enum(PAYMENT_STATUSES),
  paid_amount: money,
  payment_method: optText(120),
  airline_settlement: z.enum(SETTLEMENT_STATUSES),
  notes: optText(2000),
});

export async function updateTicketPaymentAction(input: z.input<typeof paymentSchema>): Promise<ActionResult<null>> {
  return staffAction("tickets.manage", paymentSchema, input, async (data, staff) => {
    const { id: ticketId, ...rest } = data;
    if (!(await getTicket(ticketId))) return { ok: false, error: "التذكرة غير موجودة." };
    await updateTicketPayment(ticketId, rest, staff.id);
    return ok(null, "تم تحديث حالة الدفع.");
  });
}

export async function voidTicketAction(input: { id: number; reason: string }): Promise<ActionResult<null>> {
  return staffAction("tickets.manage", z.object({ id, reason: reqText(3, 300, "سبب الإلغاء") }), input, async (data, staff) => {
    const t = await getTicket(data.id);
    if (!t) return { ok: false, error: "التذكرة غير موجودة." };
    if (t.status === "void") return { ok: false, error: "التذكرة ملغاة مسبقاً." };
    await voidTicket(data.id, data.reason, staff.id);
    return ok(null, "تم إلغاء العملية. لن تُحتسب في التقارير.");
  });
}

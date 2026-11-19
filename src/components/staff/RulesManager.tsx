"use client";

import { CalendarX2, History, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { COMMISSION_BASIS_LABELS, COMMISSION_BASES, COMMISSION_KIND_LABELS, COMMISSION_KINDS, COMMISSION_METHOD_LABELS, COMMISSION_METHODS, ruleLabel, type CommissionBasis, type CommissionKind, type CommissionMethod } from "@/lib/commission-math";
import { formatDay, todayDay } from "@/lib/dates";
import { addRuleAction, deleteRuleAction, endRuleAction } from "@/server/actions/airlines";
import { MoneyInput } from "./fields";
import { Modal } from "./Modal";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Table, Textarea } from "./ui";
import { useActionRunner } from "./useActionRunner";

export interface RuleItem {
  id: number;
  scope: "etijah" | "company";
  airline_id: number;
  airline_name: string;
  company_id: number | null;
  company_name: string | null;
  kind: CommissionKind;
  method: CommissionMethod;
  rate_bp: number;
  fixed_amount: number | null;
  basis: CommissionBasis;
  basis_note: string | null;
  currency: string | null;
  settlement: string | null;
  valid_from: string;
  valid_to: string | null;
  notes: string | null;
  created_by_name: string | null;
  used: boolean;
  current: boolean;
  future: boolean;
}

interface Draft {
  airline_id: number | "";
  company_id: number | "";
  kind: CommissionKind;
  method: CommissionMethod;
  rate: string;
  fixed_amount: number | null;
  basis: CommissionBasis;
  basis_note: string;
  currency: string;
  settlement: string;
  valid_from: string;
  valid_to: string;
  notes: string;
}

/**
 * Commission rules with full history. A rate is never edited in place: a new version starts on
 * a date and the previous one is closed the day before, so recorded tickets keep their terms.
 */
export function RulesManager({
  scope,
  rules,
  airlines,
  companies,
  currencies,
  fixedAirlineId,
  fixedCompanyId,
  canEdit,
  title,
  description,
}: {
  scope: "etijah" | "company";
  rules: RuleItem[];
  airlines: { id: number; name: string; iata: string | null }[];
  companies: { id: number; name: string }[];
  currencies: string[];
  fixedAirlineId?: number;
  fixedCompanyId?: number;
  canEdit: boolean;
  title: string;
  description: string;
}) {
  const { run, pending } = useActionRunner();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [end, setEnd] = useState<{ rule: RuleItem; valid_to: string; notes: string } | null>(null);
  const [historyOf, setHistoryOf] = useState<string | null>(null);

  const open = (base?: RuleItem) =>
    setDraft({
      airline_id: base?.airline_id ?? fixedAirlineId ?? "",
      company_id: base?.company_id ?? fixedCompanyId ?? "",
      kind: base?.kind ?? (scope === "company" ? "commission" : "commission"),
      method: base?.method ?? "percent",
      rate: base && base.method === "percent" && base.rate_bp ? String(base.rate_bp / 100) : "",
      fixed_amount: base?.fixed_amount ?? null,
      basis: base?.basis ?? "base_fare",
      basis_note: base?.basis_note ?? "",
      currency: base?.currency ?? currencies[0] ?? "USD",
      settlement: base?.settlement ?? "",
      valid_from: todayDay(),
      valid_to: "",
      notes: "",
    });

  const submit = () => {
    if (!draft) return;
    const rate = Number(draft.rate.replace(",", "."));
    run(
      () =>
        addRuleAction({
          scope,
          airline_id: Number(draft.airline_id),
          company_id: scope === "company" ? Number(draft.company_id) || null : null,
          kind: draft.kind,
          method: draft.method,
          rate_bp: Number.isFinite(rate) ? Math.round(rate * 100) : 0,
          fixed_amount: draft.fixed_amount,
          basis: draft.basis,
          basis_note: draft.basis_note || null,
          currency: draft.method === "fixed" ? draft.currency : draft.currency || null,
          settlement: draft.settlement || null,
          valid_from: draft.valid_from,
          valid_to: draft.valid_to || null,
          notes: draft.notes || null,
        }),
      { onOk: () => setDraft(null) },
    );
  };

  // Group by airline (+ company): the current rule first, history behind a toggle.
  const groups = new Map<string, RuleItem[]>();
  for (const r of rules) {
    const k = `${r.airline_id}:${r.company_id ?? 0}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  const row = (r: RuleItem, muted = false) => (
    <tr key={r.id} className={muted ? "bg-mist/50 text-muted" : ""} data-rule-row={r.id}>
      {!fixedAirlineId ? <td className="font-bold text-brand-950">{r.airline_name}</td> : null}
      {scope === "company" && !fixedCompanyId ? <td>{r.company_name}</td> : null}
      <td>
        <span className="num text-base font-black text-brand-700" data-rule-value>
          {ruleLabel(r)}
        </span>
        {r.kind !== "commission" ? null : <span className="block text-xs text-muted">{COMMISSION_METHOD_LABELS[r.method]}</span>}
      </td>
      <td className="text-xs">
        {r.kind === "commission" ? COMMISSION_BASIS_LABELS[r.basis] : COMMISSION_KIND_LABELS[r.kind]}
        {r.basis_note ? <span className="block text-muted">{r.basis_note}</span> : null}
      </td>
      <td className="text-xs whitespace-nowrap">
        {formatDay(r.valid_from, "ar")} ← {r.valid_to ? formatDay(r.valid_to, "ar") : "مفتوح"}
      </td>
      <td>{r.current ? <Badge tone="success">سارية</Badge> : r.future ? <Badge tone="brand">مستقبلية</Badge> : <Badge tone="muted">منتهية</Badge>}</td>
      <td className="text-xs">{r.settlement ?? "—"}</td>
      <td className="max-w-48 text-xs">{r.notes ?? ""}</td>
      <td className="whitespace-nowrap">
        {canEdit ? (
          <>
            <Button size="sm" variant="ghost" aria-label="إنهاء أو تعديل الملاحظات" onClick={() => setEnd({ rule: r, valid_to: r.valid_to ?? "", notes: r.notes ?? "" })}>
              <CalendarX2 className="size-4" aria-hidden="true" />
            </Button>
            {!r.used ? (
              <Button size="sm" variant="ghost" className="text-danger" aria-label="حذف القاعدة" onClick={() => run(() => deleteRuleAction(r.id), { confirm: "حذف هذه القاعدة؟ (غير مستخدمة في أي تذكرة)" })}>
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            ) : (
              <Badge tone="neutral">مستخدمة</Badge>
            )}
          </>
        ) : null}
      </td>
    </tr>
  );

  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        actions={
          canEdit ? (
            <Button size="sm" variant="primary" onClick={() => open()} data-add-rule={scope}>
              <Plus className="size-4" aria-hidden="true" /> نسبة / قاعدة جديدة
            </Button>
          ) : null
        }
      />
      {rules.length ? (
        <Table label={title}>
          <thead>
            <tr>
              {!fixedAirlineId ? <th>شركة الطيران</th> : null}
              {scope === "company" && !fixedCompanyId ? <th>الشركة</th> : null}
              <th>العمولة</th>
              <th>طريقة الاحتساب</th>
              <th>فترة التطبيق</th>
              <th>الحالة</th>
              <th>التسوية</th>
              <th>ملاحظات</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...groups.entries()].map(([k, list]) => {
              const main = list.find((r) => r.current) ?? list[0];
              const rest = list.filter((r) => r !== main);
              return [
                row(main),
                rest.length ? (
                  <tr key={`${k}-h`}>
                    <td colSpan={9} className="py-1.5">
                      <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline" onClick={() => setHistoryOf(historyOf === k ? null : k)} data-rule-history>
                        <History className="size-3.5" aria-hidden="true" /> {historyOf === k ? "إخفاء السجل" : `السجل التاريخي (${rest.length})`}
                      </button>
                      {canEdit ? (
                        <button type="button" className="ms-4 text-xs font-bold text-brand-600 hover:underline" onClick={() => open(main)}>
                          نسبة جديدة لهذا الخط
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : null,
                ...(historyOf === k ? rest.map((r) => row(r, true)) : []),
              ];
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="لا توجد قواعد عمولة بعد" text="لا توجد نسب افتراضية في النظام. أضف النسبة المتفق عليها لكل خط طيران وتاريخ بدء تطبيقها." />
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        wide
        title={scope === "etijah" ? "عمولة الاتجاه من شركة الطيران" : "عمولة الشركة حسب الخط الجوي"}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>إلغاء</Button>
            <Button variant="primary" loading={pending} onClick={submit} data-save-rule>
              <Save className="size-4" aria-hidden="true" /> حفظ القاعدة
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="شركة الطيران" required>
              <Select value={draft.airline_id} disabled={!!fixedAirlineId} onChange={(e) => setDraft({ ...draft, airline_id: e.target.value ? Number(e.target.value) : "" })} data-rule-airline>
                <option value="">اختر…</option>
                {airlines.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.iata ? `(${a.iata})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {scope === "company" ? (
              <Field label="الشركة" required>
                <Select value={draft.company_id} disabled={!!fixedCompanyId} onChange={(e) => setDraft({ ...draft, company_id: e.target.value ? Number(e.target.value) : "" })} data-rule-company>
                  <option value="">اختر…</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="هل تدفع شركة الطيران عمولة للاتجاه؟" required>
                <Select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as CommissionKind })} data-rule-kind>
                  {COMMISSION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {COMMISSION_KIND_LABELS[k]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {draft.kind === "commission" ? (
              <>
                <Field label="طريقة الاحتساب">
                  <Select value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value as CommissionMethod })}>
                    {COMMISSION_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {COMMISSION_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </Select>
                </Field>
                {draft.method === "percent" ? (
                  <Field label="نسبة العمولة %" required hint="مثال: 5 أو 2.5">
                    <Input dir="ltr" inputMode="decimal" className="num" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} data-rule-rate />
                  </Field>
                ) : (
                  <div className="grid grid-cols-[1fr_7rem] gap-2">
                    <Field label="المبلغ لكل تذكرة" required>
                      <MoneyInput value={draft.fixed_amount} onChange={(v) => setDraft({ ...draft, fixed_amount: v })} aria-label="المبلغ" />
                    </Field>
                    <Field label="العملة">
                      <Select value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })}>
                        {currencies.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                )}
                {draft.method === "percent" ? (
                  <Field label="تُحتسب على">
                    <Select value={draft.basis} onChange={(e) => setDraft({ ...draft, basis: e.target.value as CommissionBasis })} data-rule-basis>
                      {COMMISSION_BASES.map((b) => (
                        <option key={b} value={b}>
                          {COMMISSION_BASIS_LABELS[b]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                {draft.basis === "other" && draft.method === "percent" ? (
                  <Field label="اشرح أساس الاحتساب" required>
                    <Input value={draft.basis_note} onChange={(e) => setDraft({ ...draft, basis_note: e.target.value })} placeholder="مثال: السعر دون ضريبة YQ" />
                  </Field>
                ) : null}
              </>
            ) : null}
            <Field label="طريقة التسوية">
              <Input value={draft.settlement} onChange={(e) => setDraft({ ...draft, settlement: e.target.value })} placeholder="مثال: خصم من فاتورة BSP الشهرية" />
            </Field>
            <Field label="تاريخ بداية التطبيق" required hint="القاعدة السابقة المفتوحة تُغلق في اليوم السابق تلقائياً.">
              <Input type="date" dir="ltr" className="num" value={draft.valid_from} onChange={(e) => setDraft({ ...draft, valid_from: e.target.value })} data-rule-from />
            </Field>
            <Field label="تاريخ النهاية (اختياري)">
              <Input type="date" dir="ltr" className="num" value={draft.valid_to} onChange={(e) => setDraft({ ...draft, valid_to: e.target.value })} />
            </Field>
            <Field label="ملاحظات" className="sm:col-span-2">
              <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!end}
        onClose={() => setEnd(null)}
        title="إنهاء القاعدة أو تعديل ملاحظاتها"
        footer={
          <>
            <Button onClick={() => setEnd(null)}>إلغاء</Button>
            <Button variant="primary" loading={pending} onClick={() => end && run(() => endRuleAction({ id: end.rule.id, valid_to: end.valid_to || null, notes: end.notes || null }), { onOk: () => setEnd(null) })}>
              حفظ
            </Button>
          </>
        }
      >
        {end ? (
          <div className="grid gap-4">
            <p className="text-sm text-muted">لا يمكن تغيير النسبة نفسها؛ لتغييرها أضف قاعدة جديدة بتاريخ بداية جديد. التذاكر المسجلة تحتفظ بالنسبة التي احتُسبت بها.</p>
            <Field label="تاريخ النهاية" hint="اتركه فارغاً لقاعدة مفتوحة النهاية.">
              <Input type="date" dir="ltr" className="num" value={end.valid_to} onChange={(e) => setEnd({ ...end, valid_to: e.target.value })} />
            </Field>
            <Field label="ملاحظات">
              <Textarea rows={2} value={end.notes} onChange={(e) => setEnd({ ...end, notes: e.target.value })} />
            </Field>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}

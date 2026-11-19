"use client";

import { BedDouble, KeyRound, Pencil, Plus, Save, Star, Trash2, UserRound } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { asset } from "@/lib/asset";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { COMPANY_PERMISSION_LABELS, COMPANY_PERMISSIONS, type CompanyPermission } from "@/lib/permissions";
import { BOARD_LABELS, BOARDS, RATE_BASIS_LABELS, type Board } from "@/lib/travel-labels";
import { createCompanyUserAction, removeCompanyHotelAction, resetCompanyUserPasswordAction, setCompanyHotelAction, updateCompanyUserAction } from "@/server/actions/companies";
import { MoneyInput, NumberInput } from "./fields";
import { Modal } from "./Modal";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Table, Toggle } from "./ui";
import { useActionRunner } from "./useActionRunner";

const noopSubscribe = () => () => {};

/** Readable random password (letters + digits, ~80 bits). */
function generatePassword() {
  const a = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const raw = [...bytes].map((b) => a[b % a.length]).join("");
  const pw = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
  return /\d/.test(pw) && /[A-Za-z]/.test(pw) ? pw : `${pw.slice(0, -1)}7`;
}

// ------------------------------------------------------------------ Company users
export interface CompanyUserItem {
  id: number;
  company_id: number;
  company_name?: string;
  name: string;
  email: string;
  phone: string | null;
  permissions: CompanyPermission[];
  active: boolean;
  last_login_at: string | null;
}

export function CompanyUsersManager({ companyId, users, portalEnabled, showCompany }: { companyId: number | null; users: CompanyUserItem[]; portalEnabled: boolean; showCompany?: boolean }) {
  const { run, pending } = useActionRunner();
  const [form, setForm] = useState<(Omit<CompanyUserItem, "id" | "last_login_at"> & { id: number | null; password: string }) | null>(null);
  const [reset, setReset] = useState<{ user: CompanyUserItem; password: string } | null>(null);
  const [shown, setShown] = useState<{ email: string; password: string } | null>(null);
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const loginUrl = `${origin}${asset("/b2b/login/")}`;

  return (
    <Card id="users">
      <CardHeader
        title="حسابات مستخدمي الشركة"
        description={portalEnabled ? "كل مستخدم يدخل إلى بوابة شركته فقط، بالصلاحيات المحددة له." : "بوابة الشركة غير مفعّلة: لن يتمكن المستخدمون من الدخول حتى تفعيلها من بيانات الشركة."}
        actions={
          companyId ? (
            <Button size="sm" variant="subtle" data-add-company-user onClick={() => setForm({ id: null, company_id: companyId, name: "", email: "", phone: null, permissions: [...COMPANY_PERMISSIONS], active: true, password: generatePassword() })}>
              <Plus className="size-4" aria-hidden="true" /> مستخدم جديد
            </Button>
          ) : null
        }
      />
      {shown ? (
        <div role="status" className="mx-5 mt-4 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm">
          <p className="font-bold text-brand-950">بيانات الدخول (تظهر مرة واحدة — أرسلها للمستخدم بطريقة آمنة):</p>
          <p className="mt-1">
            الرابط: <span dir="ltr" className="num">{loginUrl}</span>
          </p>
          <p>
            البريد: <span dir="ltr">{shown.email}</span> · كلمة المرور:{" "}
            <span dir="ltr" className="num font-black" data-generated-password>
              {shown.password}
            </span>
          </p>
        </div>
      ) : null}
      {users.length ? (
        <Table label="المستخدمون">
          <thead>
            <tr>
              <th>المستخدم</th>
              {showCompany ? <th>الشركة</th> : null}
              <th>الصلاحيات</th>
              <th>آخر دخول</th>
              <th>الحالة</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-company-user={u.email}>
                <td>
                  <p className="flex items-center gap-2 font-bold text-brand-950">
                    <UserRound className="size-4 text-brand-500" aria-hidden="true" /> {u.name}
                  </p>
                  <p className="text-xs text-muted" dir="ltr">
                    {u.email}
                  </p>
                </td>
                {showCompany ? <td>{u.company_name}</td> : null}
                <td className="max-w-72">
                  <div className="flex flex-wrap gap-1">
                    {u.permissions.map((p) => (
                      <Badge key={p} tone="brand">
                        {COMPANY_PERMISSION_LABELS[p]}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="text-xs text-muted">{u.last_login_at ? formatDateTime(u.last_login_at) : "لم يدخل بعد"}</td>
                <td>{u.active ? <Badge tone="success">فعّال</Badge> : <Badge tone="muted">موقوف</Badge>}</td>
                <td className="whitespace-nowrap">
                  <Button size="sm" variant="ghost" aria-label={`تعديل ${u.name}`} onClick={() => setForm({ ...u, password: "" })}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`كلمة مرور جديدة لـ ${u.name}`} onClick={() => setReset({ user: u, password: generatePassword() })}>
                    <KeyRound className="size-4" aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="لا يوجد مستخدمون" text="أنشئ حساباً لموظف الشركة ليدخل إلى بوابتها ويرى عروضها والفنادق المتاحة لها." />
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "تعديل مستخدم الشركة" : "مستخدم جديد للشركة"}
        footer={
          <>
            <Button onClick={() => setForm(null)}>إلغاء</Button>
            <Button
              variant="primary"
              loading={pending}
              data-save-company-user
              onClick={() =>
                form &&
                (form.id
                  ? run(() => updateCompanyUserAction({ id: form.id!, company_id: form.company_id, name: form.name, email: form.email, phone: form.phone, permissions: form.permissions, active: form.active }), { onOk: () => setForm(null) })
                  : run(() => createCompanyUserAction({ company_id: form.company_id, name: form.name, email: form.email, phone: form.phone, permissions: form.permissions, password: form.password }), {
                      onOk: () => {
                        setShown({ email: form.email, password: form.password });
                        setForm(null);
                      },
                    }))
              }
            >
              <Save className="size-4" aria-hidden="true" /> حفظ
            </Button>
          </>
        }
      >
        {form ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-cu-name />
            </Field>
            <Field label="البريد الإلكتروني (اسم الدخول)" required>
              <Input type="email" dir="ltr" className="text-left" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-cu-email />
            </Field>
            <Field label="الهاتف">
              <Input dir="ltr" className="num text-left" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value || null })} />
            </Field>
            {!form.id ? (
              <Field label="كلمة المرور" hint="مولّدة تلقائياً؛ يمكن تغييرها.">
                <Input dir="ltr" className="num text-left" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-cu-password />
              </Field>
            ) : (
              <div className="pt-6">
                <Toggle id="cu-active" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="حساب فعّال" description="الإيقاف ينهي جلساته فوراً." />
              </div>
            )}
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-bold text-brand-950">الصلاحيات في البوابة</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {COMPANY_PERMISSIONS.map((p) => (
                  <label key={p} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-bold">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-600"
                      checked={form.permissions.includes(p)}
                      onChange={(e) => setForm({ ...form, permissions: e.target.checked ? [...form.permissions, p] : form.permissions.filter((x) => x !== p) })}
                    />
                    {COMPANY_PERMISSION_LABELS[p]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!reset}
        onClose={() => setReset(null)}
        title="كلمة مرور جديدة"
        footer={
          <>
            <Button onClick={() => setReset(null)}>إلغاء</Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={() =>
                reset &&
                run(() => resetCompanyUserPasswordAction({ id: reset.user.id, company_id: reset.user.company_id, password: reset.password }), {
                  onOk: () => {
                    setShown({ email: reset.user.email, password: reset.password });
                    setReset(null);
                  },
                })
              }
            >
              تعيين
            </Button>
          </>
        }
      >
        {reset ? (
          <Field label={`كلمة المرور الجديدة لـ ${reset.user.name}`} hint="تُنهى جلسات المستخدم الحالية.">
            <Input dir="ltr" className="num text-left" value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} />
          </Field>
        ) : null}
      </Modal>
    </Card>
  );
}

// ------------------------------------------------------------------ Hotel access & company prices
interface CompanyRateForm {
  key: string;
  rate_id: string | null;
  room_type_id: string | null;
  room_label: string | null;
  board: Board | null;
  basis: "per_person" | "per_room";
  occupancy: number;
  currency: string;
  price: number | null;
}

export interface CompanyHotelItem {
  hotel_id: number;
  name: string;
  city: string;
  stars: number | null;
  note: string | null;
  rates: Omit<CompanyRateForm, "key">[];
  library: { id: string; room: string; board: Board | null; basis: "per_person" | "per_room"; occupancy: number; currency: string; price: number }[];
}

let rk = 0;

export function CompanyHotelsManager({ companyId, items, hotels, currencies }: { companyId: number; items: CompanyHotelItem[]; hotels: { id: number; name: string; city: string; stars: number | null }[]; currencies: string[] }) {
  const { run, pending } = useActionRunner();
  const [add, setAdd] = useState<number | "">("");
  const [edit, setEdit] = useState<{ item: CompanyHotelItem; rates: CompanyRateForm[]; note: string | null } | null>(null);
  const granted = new Set(items.map((i) => i.hotel_id));
  const available = hotels.filter((h) => !granted.has(h.id));

  return (
    <Card id="hotels">
      <CardHeader title="الفنادق المتاحة للشركة وأسعارها" description="تختار الإدارة الفنادق التي تراها الشركة في بوابتها، والسعر المخصص لها لكل غرفة. لا تُعرض أبداً تكاليفنا أو أسعار المكتبة." />
      <div className="flex flex-wrap items-end gap-2 border-b border-line px-5 py-4">
        <Field label="إتاحة فندق من المكتبة" className="min-w-64 flex-1">
          <Select value={add} onChange={(e) => setAdd(e.target.value ? Number(e.target.value) : "")} data-grant-hotel>
            <option value="">اختر الفندق…</option>
            {available.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} — {h.city} {h.stars ? `(${h.stars}★)` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          variant="primary"
          disabled={!add || pending}
          onClick={() => add && run(() => setCompanyHotelAction({ company_id: companyId, hotel_id: add, rates: null, note: null }), { onOk: () => setAdd("") })}
          data-grant-hotel-submit
        >
          <Plus className="size-4" aria-hidden="true" /> إتاحة بأسعار البيع المقترحة
        </Button>
      </div>
      {items.length ? (
        <ul role="list" className="divide-y divide-line">
          {items.map((it) => (
            <li key={it.hotel_id} className="px-5 py-3.5" data-company-hotel={it.hotel_id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 font-bold text-brand-950">
                  <BedDouble className="size-4 text-brand-500" aria-hidden="true" /> {it.name}
                  {it.stars ? (
                    <span className="inline-flex text-accent-500">
                      {Array.from({ length: it.stars }, (_, i) => (
                        <Star key={i} className="size-3 fill-current" aria-hidden="true" />
                      ))}
                    </span>
                  ) : null}
                  <span className="text-xs font-normal text-muted">{it.city}</span>
                </p>
                <div className="flex gap-1">
                  <Button size="sm" variant="subtle" onClick={() => setEdit({ item: it, note: it.note, rates: it.rates.map((r) => ({ ...r, key: `r${++rk}` })) })}>
                    <Pencil className="size-4" aria-hidden="true" /> أسعار الشركة
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger" aria-label="إلغاء الإتاحة" onClick={() => run(() => removeCompanyHotelAction({ company_id: companyId, hotel_id: it.hotel_id }), { confirm: `إلغاء وصول الشركة إلى ${it.name}؟` })}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {it.rates.map((r, i) => (
                  <Badge key={i} tone="neutral">
                    {r.room_label ?? "—"} · {r.board ? BOARD_LABELS[r.board].ar : "—"} · <span className="num">{r.price != null ? formatMoney(r.price, r.currency, "ar") : "—"}</span> {RATE_BASIS_LABELS[r.basis].ar}
                  </Badge>
                ))}
                {!it.rates.length ? <span className="text-xs text-accent-700">لا توجد أسعار: لن يرى المستخدم أسعاراً لهذا الفندق.</span> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="لا توجد فنادق متاحة لهذه الشركة" text="أتح الفنادق التي تريد أن يتصفحها مستخدمو الشركة في بوابتهم." />
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        wide
        title={`أسعار الشركة — ${edit?.item.name ?? ""}`}
        footer={
          <>
            <Button onClick={() => setEdit(null)}>إلغاء</Button>
            <Button
              variant="primary"
              loading={pending}
              data-save-company-rates
              onClick={() =>
                edit &&
                run(() => setCompanyHotelAction({ company_id: companyId, hotel_id: edit.item.hotel_id, note: edit.note, rates: edit.rates.map(({ key: _k, ...r }) => ({ ...r, price: r.price ?? 0 })) }), { onOk: () => setEdit(null) })
              }
            >
              <Save className="size-4" aria-hidden="true" /> حفظ
            </Button>
          </>
        }
      >
        {edit ? (
          <div className="grid gap-3">
            {edit.rates.map((r) => {
              const up = (patch: Partial<CompanyRateForm>) => setEdit({ ...edit, rates: edit.rates.map((x) => (x.key === r.key ? { ...x, ...patch } : x)) });
              return (
                <div key={r.key} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1.3fr_1fr_1fr_5rem_6rem_8rem_auto] sm:items-end">
                  <Field label="الغرفة">
                    <Input value={r.room_label ?? ""} onChange={(e) => up({ room_label: e.target.value || null })} />
                  </Field>
                  <Field label="الوجبات">
                    <Select value={r.board ?? ""} onChange={(e) => up({ board: (e.target.value || null) as Board | null })}>
                      <option value="">—</option>
                      {BOARDS.map((b) => (
                        <option key={b} value={b}>
                          {BOARD_LABELS[b].ar}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="نوع السعر">
                    <Select value={r.basis} onChange={(e) => up({ basis: e.target.value as CompanyRateForm["basis"] })}>
                      <option value="per_room">للغرفة</option>
                      <option value="per_person">للشخص</option>
                    </Select>
                  </Field>
                  <Field label="الأشخاص">
                    <NumberInput min={1} max={20} value={r.occupancy} onChange={(v) => up({ occupancy: v ?? 1 })} aria-label="الأشخاص" />
                  </Field>
                  <Field label="العملة">
                    <Select value={r.currency} onChange={(e) => up({ currency: e.target.value })}>
                      {[...new Set([r.currency, ...currencies])].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="سعر الشركة لليلة">
                    <MoneyInput value={r.price} onChange={(v) => up({ price: v })} aria-label="سعر الشركة" />
                  </Field>
                  <Button size="sm" variant="ghost" className="h-11 text-danger" aria-label="حذف" onClick={() => setEdit({ ...edit, rates: edit.rates.filter((x) => x.key !== r.key) })}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              {edit.item.library.map((l) => (
                <Button
                  key={l.id}
                  size="sm"
                  variant="subtle"
                  onClick={() => setEdit({ ...edit, rates: [...edit.rates, { key: `r${++rk}`, rate_id: l.id, room_type_id: null, room_label: l.room, board: l.board, basis: l.basis, occupancy: l.occupancy, currency: l.currency, price: l.price }] })}
                >
                  <Plus className="size-3.5" aria-hidden="true" /> {l.room} ({formatMoney(l.price, l.currency, "ar")})
                </Button>
              ))}
            </div>
            <Field label="ملاحظة تظهر للشركة">
              <Input value={edit.note ?? ""} onChange={(e) => setEdit({ ...edit, note: e.target.value || null })} />
            </Field>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}

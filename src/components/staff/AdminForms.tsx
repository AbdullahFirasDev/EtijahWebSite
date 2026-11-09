"use client";

import { KeyRound, Pencil, Plus, Save } from "lucide-react";
import { useState } from "react";
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from "@/lib/money";
import { ROLE_HINTS, ROLE_LABELS, ROLES, type Role } from "@/lib/permissions";
import { changeOwnPasswordAction } from "@/server/actions/auth";
import { createUserAction, resetUserPasswordAction, saveSettingsAction, updateUserAction } from "@/server/actions/admin";
import { NumberInput } from "./fields";
import { Modal } from "./Modal";
import { Badge, Button, Card, CardHeader, Field, Input, Select, Table, Textarea, Toggle } from "./ui";
import { useActionRunner } from "./useActionRunner";

// ------------------------------------------------------------------ Users
export interface UserItem {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  last_login: string | null;
}

export function UsersManager({ users, me }: { users: UserItem[]; me: number }) {
  const [edit, setEdit] = useState<(UserItem & { password?: string }) | null>(null);
  const [reset, setReset] = useState<{ id: number; name: string; password: string } | null>(null);
  const { run, pending } = useActionRunner();
  const isNew = edit?.id === 0;

  return (
    <>
      <Card>
        <CardHeader
          title="حسابات الموظفين"
          actions={
            <Button variant="primary" size="sm" onClick={() => setEdit({ id: 0, name: "", email: "", role: "sales", active: true, last_login: null, password: "" })}>
              <Plus className="size-4" aria-hidden="true" /> موظف جديد
            </Button>
          }
        />
        <Table label="المستخدمون">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>البريد</th>
              <th>الدور</th>
              <th>الحالة</th>
              <th>آخر دخول</th>
              <th className="w-0" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-bold text-brand-950">
                  {u.name} {u.id === me ? <Badge tone="brand">أنت</Badge> : null}
                </td>
                <td dir="ltr" className="text-start">
                  {u.email}
                </td>
                <td>{ROLE_LABELS[u.role]}</td>
                <td>{u.active ? <Badge tone="success">فعّال</Badge> : <Badge tone="muted">موقوف</Badge>}</td>
                <td className="text-xs text-muted">{u.last_login ?? "—"}</td>
                <td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" aria-label={`تعديل ${u.name}`} onClick={() => setEdit(u)}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`كلمة مرور جديدة لـ ${u.name}`} onClick={() => setReset({ id: u.id, name: u.name, password: "" })}>
                      <KeyRound className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-6">
        <CardHeader title="الأدوار والصلاحيات" description="تُطبّق الصلاحيات على الخادم في كل صفحة وإجراء، لا في الواجهة فقط." />
        <ul role="list" className="grid gap-3 p-5 md:grid-cols-3">
          {ROLES.map((r) => (
            <li key={r} className="rounded-xl border border-line p-4">
              <p className="font-extrabold text-brand-950">{ROLE_LABELS[r]}</p>
              <p className="mt-1 text-sm leading-[1.8] text-muted">{ROLE_HINTS[r]}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={isNew ? "موظف جديد" : "تعديل الحساب"}
        footer={
          <>
            <Button onClick={() => setEdit(null)}>إلغاء</Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={() =>
                edit &&
                run(() => (isNew ? createUserAction({ name: edit.name, email: edit.email, role: edit.role, password: edit.password ?? "" }) : updateUserAction(edit)), { onOk: () => setEdit(null) })
              }
            >
              حفظ
            </Button>
          </>
        }
      >
        {edit ? (
          <div className="grid gap-4">
            <Field label="الاسم" required htmlFor="u-name">
              <Input id="u-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="البريد الإلكتروني (اسم الدخول)" required htmlFor="u-email">
              <Input id="u-email" type="email" dir="ltr" className="text-start" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </Field>
            <Field label="الدور" htmlFor="u-role" hint={ROLE_HINTS[edit.role]}>
              <Select id="u-role" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            {isNew ? (
              <Field label="كلمة المرور المؤقتة" required htmlFor="u-pass" hint="10 أحرف على الأقل، حروف وأرقام. يغيّرها الموظف من «حسابي».">
                <Input id="u-pass" type="text" dir="ltr" autoComplete="new-password" value={edit.password ?? ""} onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
              </Field>
            ) : (
              <Toggle id="u-active" checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="حساب فعّال" description="إيقاف الحساب ينهي جلساته فوراً." />
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!reset}
        onClose={() => setReset(null)}
        title={`كلمة مرور جديدة — ${reset?.name ?? ""}`}
        footer={
          <>
            <Button onClick={() => setReset(null)}>إلغاء</Button>
            <Button variant="primary" loading={pending} onClick={() => reset && run(() => resetUserPasswordAction({ id: reset.id, password: reset.password }), { onOk: () => setReset(null) })}>
              تعيين
            </Button>
          </>
        }
      >
        {reset ? (
          <Field label="كلمة المرور الجديدة" htmlFor="r-pass" hint="سيتم تسجيل خروج المستخدم من كل الأجهزة.">
            <Input id="r-pass" type="text" dir="ltr" autoComplete="new-password" value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} />
          </Field>
        ) : null}
      </Modal>
    </>
  );
}

// ------------------------------------------------------------------ Settings
export interface SettingsState {
  currencies: string[];
  default_currency: string;
  quote_validity_days: number;
  quote_terms_ar: string;
  quote_terms_en: string;
}

export function SettingsForm({ initial }: { initial: SettingsState }) {
  const [s, setS] = useState(initial);
  const { run, pending } = useActionRunner();
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader title="العملات" description="العملات المتاحة في البرامج وعروض الأسعار." />
        <div className="grid gap-5 p-5">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">العملات المفعّلة</legend>
            {CURRENCY_CODES.map((c) => {
              const on = s.currencies.includes(c);
              return (
                <label key={c} className={`cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-bold ${on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line text-muted"}`}>
                  <input type="checkbox" className="me-2 accent-brand-600" checked={on} onChange={() => setS({ ...s, currencies: on ? s.currencies.filter((x) => x !== c) : [...s.currencies, c] })} />
                  {CURRENCIES[c as CurrencyCode].nameAr} ({c})
                </label>
              );
            })}
          </fieldset>
          <Field label="العملة الافتراضية" htmlFor="s-cur" className="max-w-xs">
            <Select id="s-cur" value={s.default_currency} onChange={(e) => setS({ ...s, default_currency: e.target.value })}>
              {s.currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="عروض أسعار الشركات" />
        <div className="grid gap-5 p-5">
          <Field label="مدة صلاحية العرض الافتراضية (أيام)" htmlFor="s-days" className="max-w-xs">
            <NumberInput id="s-days" min={1} max={180} value={s.quote_validity_days} onChange={(v) => setS({ ...s, quote_validity_days: v ?? 7 })} />
          </Field>
          <Field label="الشروط الافتراضية (عربي)" htmlFor="s-terms-ar">
            <Textarea id="s-terms-ar" rows={6} value={s.quote_terms_ar} onChange={(e) => setS({ ...s, quote_terms_ar: e.target.value })} />
          </Field>
          <Field label="Default terms (English)" htmlFor="s-terms-en">
            <Textarea id="s-terms-en" dir="ltr" className="text-left" rows={6} value={s.quote_terms_en} onChange={(e) => setS({ ...s, quote_terms_en: e.target.value })} />
          </Field>
        </div>
      </Card>
      <div>
        <Button variant="primary" loading={pending} onClick={() => run(() => saveSettingsAction(s))}>
          <Save className="size-4" aria-hidden="true" /> حفظ الإعدادات
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Own password
export function PasswordForm() {
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const { run, pending } = useActionRunner();
  const mismatch = v.confirm && v.next !== v.confirm;
  return (
    <Card className="max-w-xl">
      <CardHeader title="تغيير كلمة المرور" />
      <div className="grid gap-4 p-5">
        <Field label="كلمة المرور الحالية" htmlFor="pw-current">
          <Input id="pw-current" type="password" dir="ltr" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} />
        </Field>
        <Field label="كلمة المرور الجديدة" htmlFor="pw-next" hint="10 أحرف على الأقل، تحتوي على حروف وأرقام.">
          <Input id="pw-next" type="password" dir="ltr" autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} />
        </Field>
        <Field label="تأكيد كلمة المرور" htmlFor="pw-confirm" error={mismatch ? "غير متطابقة" : undefined}>
          <Input id="pw-confirm" type="password" dir="ltr" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
        </Field>
        <Button variant="primary" disabled={!v.current || !v.next || !!mismatch} loading={pending} onClick={() => run(() => changeOwnPasswordAction({ current: v.current, next: v.next }), { onOk: () => setV({ current: "", next: "", confirm: "" }) })}>
          حفظ كلمة المرور
        </Button>
      </div>
    </Card>
  );
}

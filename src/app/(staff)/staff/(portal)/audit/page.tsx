import { Card, Input, PageHeader, Select, Table } from "@/components/staff/ui";
import { formatDateTime } from "@/lib/dates";
import { requireStaffPage } from "@/server/auth/session";
import { col } from "@/server/db";
import type { AuditDoc } from "@/server/security";

export const metadata = { title: "سجل العمليات" };

const ENTITIES: Record<string, string> = {
  hotel: "فندق وأسعاره",
  program: "برنامج",
  departure: "موعد سفر",
  quote: "عرض سعر",
  company: "شركة",
  company_user: "مستخدم شركة",
  company_hotel: "فندق متاح لشركة",
  b2b_request: "طلب شركة",
  airline: "شركة طيران",
  commission_rule: "قاعدة عمولة",
  ticket: "عملية إصدار",
  lead: "طلب مسافر",
  user: "موظف",
  settings: "إعدادات",
  destination: "وجهة",
  service: "خدمة",
  media: "صورة",
  report: "تقرير",
};

/** Audit log of sensitive operations (prices, commissions, tickets, accounts, settings). */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string; id?: string }> }) {
  await requireStaffPage("audit.view");
  const sp = await searchParams;
  const filter: Record<string, string> = {};
  if (sp.entity && ENTITIES[sp.entity]) filter.entity = sp.entity;
  if (sp.id && /^[\w:-]{1,40}$/.test(sp.id)) filter.entity_id = sp.id;
  const rows = await (await col<AuditDoc>("audit_log")).find(filter).sort({ created_at: -1 }).limit(300).toArray();
  const users = new Map((await (await col<{ _id: number; name: string }>("staff_users")).find({}, { projection: { name: 1 } }).toArray()).map((u) => [u._id, u.name]));
  return (
    <>
      <PageHeader title="سجل العمليات (Audit Log)" description="كل تعديل على الأسعار والعمولات والتذاكر والحسابات والإعدادات، مع القيم قبل وبعد. آخر 300 عملية." />
      <Card>
        <form className="flex flex-wrap gap-2 border-b border-line p-4">
          <Select name="entity" defaultValue={sp.entity ?? ""} className="w-56" aria-label="النوع">
            <option value="">كل الأنواع</option>
            {Object.entries(ENTITIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Input name="id" defaultValue={sp.id} placeholder="رقم السجل" className="w-40" aria-label="رقم السجل" />
          <button className="rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">تصفية</button>
        </form>
        <Table label="سجل العمليات">
          <thead>
            <tr>
              <th>الوقت</th>
              <th>المنفّذ</th>
              <th>العملية</th>
              <th>السجل</th>
              <th>التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r._id)}>
                <td className="text-xs whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                <td className="text-xs">{r.user_id ? (r.actor === "company" ? `مستخدم شركة #${r.user_id}` : (users.get(r.user_id) ?? `#${r.user_id}`)) : r.actor === "cli" ? "سطر الأوامر" : "النظام"}</td>
                <td className="font-bold">{r.action}</td>
                <td className="text-xs">
                  {ENTITIES[r.entity] ?? r.entity} <span className="num">{r.entity_id ? `#${r.entity_id}` : ""}</span>
                </td>
                <td className="max-w-md">
                  {r.meta ? <code className="block max-h-24 overflow-auto text-[0.7rem] break-all whitespace-pre-wrap text-muted" dir="ltr">{JSON.stringify(r.meta)}</code> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

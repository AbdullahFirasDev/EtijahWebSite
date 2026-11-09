import { Inbox } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/staff/AutoRefresh";
import { LeadStatusBadge } from "@/components/staff/StatusBadge";
import { Card, EmptyState, Input, PageHeader, Select, Table } from "@/components/staff/ui";
import { formatDay, formatDateTime, timeAgo } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { LEAD_STATUS_LABELS, LEAD_STATUSES } from "@/lib/travel-labels";
import { requireStaffPage } from "@/server/auth/session";
import { listLeads } from "@/server/repo/leads";

export const metadata = { title: "طلبات المسافرين" };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireStaffPage("leads.view");
  const sp = await searchParams;
  const status = sp.status === "open" || LEAD_STATUSES.includes(sp.status as never) ? sp.status : undefined;
  const leads = listLeads({ status, q: sp.q?.slice(0, 80) });

  return (
    <>
      <AutoRefresh seconds={45} />
      <PageHeader title="طلبات المسافرين" description="كل طلبات الحجز المرسلة من صفحات العروض. تصل فوراً وتتحدّث هذه الصفحة تلقائياً." />
      <Card>
        <form className="flex flex-wrap gap-2 border-b border-line p-4" role="search">
          <Input name="q" defaultValue={sp.q} placeholder="الرقم المرجعي، الاسم، الهاتف…" aria-label="بحث" className="max-w-xs" />
          <Select name="status" defaultValue={status ?? ""} aria-label="الحالة" className="w-44">
            <option value="">كل الحالات</option>
            <option value="open">قيد المتابعة</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <button className="rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">تصفية</button>
        </form>
        {leads.length ? (
          <Table label="الطلبات">
            <thead>
              <tr>
                <th>الرقم المرجعي</th>
                <th>المسافر</th>
                <th>البرنامج</th>
                <th>الموعد</th>
                <th>المسافرون</th>
                <th>الحالة</th>
                <th>المسؤول</th>
                <th>وصل</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className={l.status === "new" ? "bg-accent-50/40" : undefined}>
                  <td>
                    <Link href={`/staff/requests/${l.id}/`} prefetch={false} className="num font-bold text-brand-700 hover:underline">
                      {l.ref}
                    </Link>
                  </td>
                  <td>
                    <p className="font-bold text-brand-950">{l.full_name}</p>
                    <p className="num text-xs text-muted" dir="ltr">
                      {formatPhone(l.phone)}
                    </p>
                  </td>
                  <td className="max-w-[14rem] truncate">{l.program_title}</td>
                  <td className="text-xs whitespace-nowrap">{l.departure_label ? l.departure_label.split("·")[1]?.trim() ?? l.departure_label : l.preferred_date ? formatDay(l.preferred_date, "ar") : "مرن"}</td>
                  <td className="num">
                    {l.adults + l.children}
                    {l.infants ? <span className="text-xs text-muted"> +{l.infants} رضيع</span> : null}
                  </td>
                  <td>
                    <LeadStatusBadge status={l.status} />
                  </td>
                  <td className="text-xs">{l.assignee ?? "—"}</td>
                  <td className="text-xs whitespace-nowrap text-muted" title={formatDateTime(l.created_at)}>
                    {timeAgo(l.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Inbox className="size-6" />} title="لا توجد طلبات" text="تظهر هنا طلبات «احجز رحلتك» التي يرسلها المسافرون من الموقع." />
        )}
      </Card>
    </>
  );
}

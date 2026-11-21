import { Plus, Ticket } from "lucide-react";
import Link from "next/link";
import { DateInput } from "@/components/staff/fields";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, Select, Table } from "@/components/staff/ui";
import { ruleLabel } from "@/lib/commission-math";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { airlineOptions } from "@/server/repo/airlines";
import { listCompanies } from "@/server/repo/companies";
import { listTickets, PAYMENT_STATUS_LABELS, PAYMENT_STATUSES } from "@/server/repo/tickets";
import { parseTicketFilters } from "@/server/ticket-filters";

export const metadata = { title: "سجلات الإصدارات" };

type Search = Record<string, string | undefined>;

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const staff = await requireStaffPage("tickets.view");
  const sp = await searchParams;
  const f = parseTicketFilters(sp);
  const [tickets, airlines, companies] = await Promise.all([listTickets(f), airlineOptions(), listCompanies()]);

  return (
    <>
      <PageHeader
        title="سجلات الإصدارات"
        description="عمليات إصدار التذاكر مع نسخة من نسب العمولة المستخدمة لحظة الإصدار، وحالة الدفع والتسوية."
        actions={
          can(staff.role, "tickets.manage") ? (
            <LinkButton href="/staff/tickets/new/" variant="primary">
              <Plus className="size-4" aria-hidden="true" /> تسجيل عملية إصدار
            </LinkButton>
          ) : null
        }
      />
      <Card>
        <form className="grid gap-2 border-b border-line p-4 sm:grid-cols-3 lg:grid-cols-7" role="search">
          <Input name="q" defaultValue={sp.q} placeholder="رقم التذكرة، PNR…" aria-label="بحث" />
          <Select name="airline" defaultValue={sp.airline ?? ""} aria-label="شركة الطيران">
            <option value="">كل الخطوط</option>
            {airlines.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select name="company" defaultValue={sp.company ?? ""} aria-label="الشركة">
            <option value="">كل الشركات</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <DateInput name="from" defaultValue={sp.from ?? null} aria-label="من" className="w-40" />
          <DateInput name="to" defaultValue={sp.to ?? null} aria-label="إلى" className="w-40" />
          <Select name="payment" defaultValue={sp.payment ?? ""} aria-label="الدفع">
            <option value="">كل حالات الدفع</option>
            {PAYMENT_STATUSES.map((p) => (
              <option key={p} value={p}>
                {PAYMENT_STATUS_LABELS[p]}
              </option>
            ))}
          </Select>
          <button className="h-11 rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">تصفية</button>
        </form>
        {tickets.length ? (
          <Table label="التذاكر">
            <thead>
              <tr>
                <th>المرجع</th>
                <th>التذكرة / PNR</th>
                <th>الخط</th>
                <th>الشركة</th>
                <th>التاريخ</th>
                <th>الإجمالي</th>
                <th>عمولة الشركة</th>
                <th>عمولتنا</th>
                <th>صافي المستحق</th>
                <th>الدفع</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} data-ticket-row={t.ticket_number}>
                  <td>
                    <Link href={`/staff/tickets/${t.id}/`} prefetch={false} className="num font-bold text-brand-700 hover:underline">
                      {t.ref}
                    </Link>
                    {t.status === "void" ? <Badge tone="danger" className="ms-1">ملغاة</Badge> : null}
                  </td>
                  <td className="num text-xs" dir="ltr">
                    {t.ticket_number}
                    {t.pnr ? <span className="block text-muted">{t.pnr}</span> : null}
                  </td>
                  <td>{t.airline_name}</td>
                  <td>{t.company_name ?? "مباشر"}</td>
                  <td className="text-xs whitespace-nowrap">{formatDay(t.issued_at, "ar")}</td>
                  <td className="num whitespace-nowrap">{formatMoney(t.total_fare, t.currency, "ar")}</td>
                  <td className="num text-xs whitespace-nowrap">
                    {t.company_commission ? (
                      <>
                        {formatMoney(t.company_commission.amount, t.currency, "ar")} <span className="text-muted">({ruleLabel(t.company_commission)})</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="num text-xs whitespace-nowrap">
                    {formatMoney(t.etijah_commission.amount, t.currency, "ar")} <span className="text-muted">({ruleLabel(t.etijah_commission)})</span>
                  </td>
                  <td className="num font-bold whitespace-nowrap">{formatMoney(t.net_due, t.currency, "ar")}</td>
                  <td>
                    <Badge tone={t.payment_status === "paid" ? "success" : t.payment_status === "partial" ? "accent" : "neutral"}>{PAYMENT_STATUS_LABELS[t.payment_status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Ticket className="size-6" />} title="لا توجد عمليات مسجلة" text="سجّل كل تذكرة بعد إصدارها لتُحتسب العمولات والمستحقات تلقائياً." />
        )}
      </Card>
    </>
  );
}

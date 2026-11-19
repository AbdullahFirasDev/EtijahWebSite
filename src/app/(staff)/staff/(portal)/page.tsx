import { CircleAlert, FilePlus2, Inbox, MapPinned, Ticket } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/staff/AutoRefresh";
import { LeadStatusBadge, QuoteStatusBadge } from "@/components/staff/StatusBadge";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, Stat, Table } from "@/components/staff/ui";
import { formatDay, timeAgo } from "@/lib/dates";
import { can } from "@/lib/permissions";
import type { LeadStatus, QuoteStatus } from "@/lib/travel-labels";
import { requireStaffPage } from "@/server/auth/session";
import { dashboardStats } from "@/server/repo/stats";

export const metadata = { title: "لوحة المتابعة" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const staff = await requireStaffPage("portal.view");
  const { denied } = await searchParams;
  const s = await dashboardStats();
  const b2b = can(staff.role, "quotes.manage");
  const catalog = can(staff.role, "programs.edit");
  const finance = can(staff.role, "tickets.view");

  return (
    <>
      <AutoRefresh seconds={60} />
      <PageHeader
        title={`أهلاً ${staff.name.split(" ")[0]}`}
        description="نظرة سريعة على الطلبات والعروض والكروبات. تتحدّث الصفحة تلقائياً كل دقيقة."
        actions={
          <>
            {catalog ? (
              <LinkButton href="/staff/programs/new/" variant="primary">
                <MapPinned className="size-4" aria-hidden="true" /> برنامج جديد
              </LinkButton>
            ) : null}
            {b2b ? (
              <LinkButton href="/staff/quotes/new/" variant="accent">
                <FilePlus2 className="size-4" aria-hidden="true" /> عرض سعر لشركة
              </LinkButton>
            ) : null}
            {finance ? (
              <LinkButton href="/staff/tickets/new/" variant="outline">
                <Ticket className="size-4" aria-hidden="true" /> تسجيل إصدار تذكرة
              </LinkButton>
            ) : null}
          </>
        }
      />

      {denied ? (
        <div role="alert" className="mb-6 flex items-center gap-2 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-bold text-accent-700">
          <CircleAlert className="size-4" aria-hidden="true" /> لا تملك صلاحية الوصول إلى الصفحة المطلوبة.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="طلبات جديدة" value={s.leads.new} hint={`${s.leads.open} قيد المتابعة · ${s.leads.customNew} برنامج خاص`} tone="accent" href="/staff/requests/?status=new" />
        <Stat label="طلبات هذا الشهر" value={s.leads.thisMonth} hint={`${s.leads.confirmed} حجز مؤكد إجمالاً`} href="/staff/requests/" />
        <Stat label="برامج منشورة" value={s.programs.published} hint={`${s.programs.drafts} مسودة · ${s.programs.views} مشاهدة`} href="/staff/programs/" />
        {b2b ? (
          <Stat
            label="عروض الشركات المفتوحة"
            value={s.quotes.open}
            hint={`${s.b2bNew} طلب شركة جديد · ${s.quotes.acceptanceRate == null ? `${s.quotes.sentThisMonth} أُرسل هذا الشهر` : `القبول ${s.quotes.acceptanceRate}%`}`}
            href="/staff/quotes/?status=open"
          />
        ) : (
          <Stat label="مواعيد كروبات قادمة" value={s.departures.length} href="/staff/groups/" />
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card aria-labelledby="recent-leads">
          <CardHeader id="recent-leads" title="أحدث طلبات المسافرين" actions={<LinkButton href="/staff/requests/" size="sm">كل الطلبات</LinkButton>} />
          {s.recentLeads.length ? (
            <ul role="list" className="divide-y divide-line">
              {s.recentLeads.map((l) => (
                <li key={l.id}>
                  <Link href={`/staff/requests/${l.id}/`} prefetch={false} className="flex items-center gap-4 px-5 py-3.5 hover:bg-brand-50/40">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                      <Inbox className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-brand-950">{l.full_name}</span>
                      <span className="block truncate text-xs text-muted">
                        {l.program_title} · {l.adults + l.children} مسافر
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <LeadStatusBadge status={l.status as LeadStatus} />
                      <span className="text-xs text-muted">{timeAgo(l.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد طلبات بعد" text="ستظهر هنا طلبات الحجز التي يرسلها المسافرون من صفحات العروض فور وصولها." />
          )}
        </Card>

        {b2b ? (
          <Card aria-labelledby="awaiting">
            <CardHeader id="awaiting" title="عروض بانتظار الرد" description={s.quotes.expiringSoon ? `${s.quotes.expiringSoon} عرض تنتهي صلاحيته خلال 3 أيام` : undefined} />
            {s.quotes.awaiting.length ? (
              <ul role="list" className="divide-y divide-line">
                {s.quotes.awaiting.map((q) => (
                  <li key={q.id}>
                    <Link href={`/staff/quotes/${q.id}/`} prefetch={false} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-brand-50/40">
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-brand-950">{q.company_name}</span>
                        <span className="block truncate text-xs text-muted">
                          <span className="num">{q.ref}</span> · صالح حتى {formatDay(q.valid_until, "ar")}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <QuoteStatusBadge status={q.status as QuoteStatus} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="لا توجد عروض مفتوحة" text="العروض المرسلة التي لم تُقبل أو تُرفض بعد تظهر هنا." />
            )}
          </Card>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card aria-labelledby="top-programs">
          <CardHeader id="top-programs" title="أداء البرامج" description="المشاهدات وعدد الطلبات لكل برنامج." />
          {s.topPrograms.length ? (
            <Table label="أداء البرامج">
              <thead>
                <tr>
                  <th>البرنامج</th>
                  <th>المشاهدات</th>
                  <th>الطلبات</th>
                  <th>نسبة التحويل</th>
                </tr>
              </thead>
              <tbody>
                {s.topPrograms.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={catalog ? `/staff/programs/${p.id}/` : `/staff/preview/program/${p.id}/`} prefetch={false} className="font-bold text-brand-900 hover:underline">
                        {p.title_ar}
                      </Link>
                    </td>
                    <td className="num">{p.view_count}</td>
                    <td className="num">{p.leads}</td>
                    <td className="num">{p.view_count ? `${((p.leads / p.view_count) * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="لا توجد برامج بعد" action={catalog ? <LinkButton href="/staff/programs/new/" variant="primary">أنشئ أول برنامج</LinkButton> : undefined} />
          )}
        </Card>

        <Card aria-labelledby="upcoming-groups">
          <CardHeader id="upcoming-groups" title="مواعيد البرامج العامة القادمة" actions={<LinkButton href="/staff/groups/" size="sm">كل المواعيد</LinkButton>} />
          {s.departures.length ? (
            <ul role="list" className="divide-y divide-line">
              {s.departures.map((d) => {
                const used = d.seats_total - d.seatsLeft;
                return (
                  <li key={d.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-brand-950">{d.title_ar}</p>
                        <p className="text-xs text-muted">
                          {formatDay(d.depart_date, "ar")} · <span className="num">{d.code}</span>
                        </p>
                      </div>
                      <p className="num shrink-0 text-sm font-bold text-brand-900">
                        {d.seatsLeft} / {d.seats_total} متاح
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist" aria-hidden="true">
                      <div className={`h-full rounded-full ${d.seatsLeft <= 5 ? "bg-accent-500" : "bg-brand-500"}`} style={{ width: `${Math.min(100, (used / d.seats_total) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="لا توجد مواعيد قادمة" text="أضف مواعيد السفر من معالج البرنامج (خطوة الطيران والتواريخ)." />
          )}
        </Card>
      </div>
    </>
  );
}

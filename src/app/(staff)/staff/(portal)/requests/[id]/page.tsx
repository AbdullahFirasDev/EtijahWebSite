import { ArrowLeftRight, CircleDot, MessageSquareText, UserCheck } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LeadPanel } from "@/components/staff/LeadPanel";
import { LeadStatusBadge } from "@/components/staff/StatusBadge";
import { Card, CardHeader, PageHeader } from "@/components/staff/ui";
import { asset } from "@/lib/asset";
import { formatDateTime, formatDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { LEAD_STATUS_LABELS, ROOM_TYPE_LABELS, type LeadStatus, type RoomType } from "@/lib/travel-labels";
import { requireStaffPage } from "@/server/auth/session";
import { all } from "@/server/db";
import { getLead } from "@/server/repo/leads";

export const metadata = { title: "تفاصيل الطلب" };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-t border-line px-5 py-3 first:border-t-0">
      <dt className="text-sm font-bold text-muted">{label}</dt>
      <dd className="text-[0.95rem] text-brand-950">{children}</dd>
    </div>
  );
}

const EVENT_ICONS: Record<string, ReactNode> = {
  created: <CircleDot className="size-4" />,
  status: <ArrowLeftRight className="size-4" />,
  note: <MessageSquareText className="size-4" />,
  assigned: <UserCheck className="size-4" />,
  contact: <MessageSquareText className="size-4" />,
};

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage("leads.view");
  const data = getLead(Number((await params).id));
  if (!data) notFound();
  const { lead, events } = data;
  const team = all<{ id: number; name: string }>("SELECT id, name FROM staff_users WHERE active = 1 ORDER BY name");

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{lead.ref}</span> <LeadStatusBadge status={lead.status} />
          </span>
        }
        description={`${lead.full_name} · وصل ${formatDateTime(lead.created_at)}`}
        back={{ href: "/staff/requests/", label: "طلبات المسافرين" }}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader title="بيانات الرحلة" />
            <dl>
              <Row label="البرنامج">
                {lead.program_slug && lead.program_status === "published" ? (
                  <a href={asset(`/programs/${lead.program_slug}/`)} target="_blank" rel="noopener" className="font-bold text-brand-700 hover:underline">
                    {lead.program_title}
                  </a>
                ) : (
                  lead.program_title
                )}
              </Row>
              <Row label="الموعد">{lead.departure_label ?? (lead.preferred_date ? `تاريخ مفضل: ${formatDay(lead.preferred_date, "ar")}` : "مرن / لم يحدد")}</Row>
              <Row label="المسافرون">
                <span className="num">{lead.adults}</span> بالغ · <span className="num">{lead.children}</span> طفل · <span className="num">{lead.infants}</span> رضيع
              </Row>
              <Row label="الغرف">
                <span className="num">{lead.rooms}</span> غرفة {lead.room_type ? `· ${ROOM_TYPE_LABELS[lead.room_type as RoomType]?.ar ?? lead.room_type}` : ""}
              </Row>
              <Row label="لغة الطلب">{lead.locale === "ar" ? "العربية" : "English"}</Row>
            </dl>
          </Card>
          <Card>
            <CardHeader title="بيانات التواصل" />
            <dl>
              <Row label="الاسم">{lead.full_name}</Row>
              <Row label="الهاتف">
                <a href={`tel:${lead.phone}`} dir="ltr" className="num font-bold text-brand-700 hover:underline">
                  {formatPhone(lead.phone)}
                </a>
              </Row>
              <Row label="البريد">{lead.email ? <a href={`mailto:${lead.email}`} dir="ltr" className="text-brand-700 hover:underline">{lead.email}</a> : "—"}</Row>
              <Row label="ملاحظات المسافر">{lead.notes ? <p className="leading-[1.9] whitespace-pre-line">{lead.notes}</p> : "—"}</Row>
            </dl>
          </Card>
          <Card>
            <CardHeader title="سجل المتابعة" />
            <ol className="grid gap-0 p-5">
              {events.map((e) => (
                <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                  <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">{EVENT_ICONS[e.kind]}</span>
                  <div className="min-w-0 pt-1">
                    <p className="text-sm font-bold text-brand-950">
                      {e.kind === "status"
                        ? `تغيير الحالة: ${LEAD_STATUS_LABELS[e.from_status as LeadStatus] ?? e.from_status} ← ${LEAD_STATUS_LABELS[e.to_status as LeadStatus] ?? e.to_status}`
                        : e.kind === "created"
                          ? "وصل الطلب من الموقع"
                          : e.kind === "assigned" || e.kind === "contact"
                            ? e.body
                            : "ملاحظة"}
                    </p>
                    {e.body && e.kind !== "assigned" && e.kind !== "contact" && e.kind !== "created" ? <p className="mt-1 text-sm leading-[1.8] whitespace-pre-line text-ink">{e.body}</p> : null}
                    <p className="mt-0.5 text-xs text-muted">
                      {e.user_name ?? "النظام"} · {formatDateTime(e.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <LeadPanel
            canManage={can(staff.role, "leads.manage")}
            staff={team}
            lead={{ id: lead.id, ref: lead.ref, status: lead.status, assigned_to: lead.assigned_to, full_name: lead.full_name, phone: lead.phone, email: lead.email, program_title: lead.program_title, locale: lead.locale }}
          />
        </aside>
      </div>
    </>
  );
}

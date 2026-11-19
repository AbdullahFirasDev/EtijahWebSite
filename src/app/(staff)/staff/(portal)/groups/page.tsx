import { UsersRound } from "lucide-react";
import Link from "next/link";
import { DeparturesTable } from "@/components/staff/DeparturesTable";
import { Card, EmptyState, PageHeader } from "@/components/staff/ui";
import { formatDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { listDeparturesStaff } from "@/server/repo/programs";

export const metadata = { title: "الكروبات والمقاعد" };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const staff = await requireStaffPage("programs.view");
  const { scope } = await searchParams;
  const s = scope === "past" || scope === "all" ? scope : "upcoming";
  const items = await listDeparturesStaff({ scope: s });
  const tabs = [
    ["upcoming", "القادمة"],
    ["past", "السابقة"],
    ["all", "الكل"],
  ] as const;

  return (
    <>
      <PageHeader title="الكروبات والمقاعد" description="كل مواعيد الانطلاق مع المقاعد المتاحة. عند تأكيد طلب مسافر تُخصم مقاعده تلقائياً." />
      <Card>
        <nav aria-label="تصفية المواعيد" className="flex gap-1 border-b border-line p-3">
          {tabs.map(([key, label]) => (
            <Link key={key} href={`/staff/groups/?scope=${key}`} prefetch={false} aria-current={s === key ? "page" : undefined} className={`rounded-lg px-3.5 py-1.5 text-sm font-bold ${s === key ? "bg-brand-600 text-white" : "text-brand-900 hover:bg-brand-50"}`}>
              {label}
            </Link>
          ))}
        </nav>
        {items.length ? (
          <DeparturesTable
            canEdit={can(staff.role, "programs.edit")}
            items={items.map((d) => ({
              id: d.id,
              code: d.code,
              program_id: d.program_id,
              title: d.title_ar,
              depart: formatDay(d.depart_date, "ar"),
              return: formatDay(d.return_date, "ar"),
              seats_total: d.seats_total,
              seats_held: d.seats_held,
              confirmed: d.confirmed,
              seatsLeft: d.seatsLeft,
              status: d.status,
              requests: d.requests,
            }))}
          />
        ) : (
          <EmptyState icon={<UsersRound className="size-6" />} title="لا توجد مواعيد" text="أضف مواعيد الكروبات من محرر البرنامج، قسم «الكروبات ومواعيد الانطلاق»." />
        )}
      </Card>
    </>
  );
}

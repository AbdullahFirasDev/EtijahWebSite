import { FilePlus2, FileStack } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyHotelsManager, CompanyUsersManager } from "@/components/staff/B2bManagers";
import { CompanyEditor, ContactsManager } from "@/components/staff/CompanyEditor";
import { RulesManager } from "@/components/staff/RulesManager";
import { QuoteStatusBadge } from "@/components/staff/StatusBadge";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Table } from "@/components/staff/ui";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { mediaById } from "@/server/media";
import { airlineOptions, listRules } from "@/server/repo/airlines";
import { B2B_REQUEST_STATUS_LABELS, listB2bRequests } from "@/server/repo/b2b";
import { hotelPickerOptions } from "@/server/repo/catalog";
import { getCompany, listCompanyHotels, listCompanyUsers } from "@/server/repo/companies";
import { listQuotes } from "@/server/repo/quotes";
import { getSettings } from "@/server/repo/settings";

export const metadata = { title: "الشركة" };

const TABS = [
  { id: "profile", label: "البيانات والهوية" },
  { id: "users", label: "حسابات المستخدمين" },
  { id: "hotels", label: "الفنادق والأسعار" },
  { id: "commissions", label: "العمولات حسب الخطوط" },
  { id: "quotes", label: "العروض والطلبات" },
] as const;

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const staff = await requireStaffPage("b2b.view");
  const id = Number((await params).id);
  const company = Number.isInteger(id) ? await getCompany(id) : null;
  if (!company) notFound();
  const requested = (await searchParams).tab;
  const tab = TABS.some((t) => t.id === requested) ? requested! : "profile";
  const canManage = can(staff.role, "b2b.manage");

  return (
    <>
      <PageHeader
        title={company.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {company.name_en ? <span dir="ltr">{company.name_en}</span> : null}
            {company.status === "archived" ? <Badge tone="muted">مؤرشفة</Badge> : company.portal.enabled ? <Badge tone="success">البوابة مفعّلة</Badge> : <Badge tone="neutral">البوابة غير مفعّلة</Badge>}
          </span>
        }
        back={{ href: "/staff/companies/", label: "الشركات" }}
        actions={
          <>
            <LinkButton href={`/staff/branding/?company=${company._id}`} variant="outline" size="sm">
              <FileStack className="size-4" aria-hidden="true" /> معاينة قالب PDF
            </LinkButton>
            {can(staff.role, "quotes.manage") ? (
              <LinkButton href={`/staff/quotes/new/?company=${company._id}`} variant="accent" size="sm">
                <FilePlus2 className="size-4" aria-hidden="true" /> إنشاء عرض سعر للشركة
              </LinkButton>
            ) : null}
          </>
        }
      />
      <nav aria-label="أقسام ملف الشركة" className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 ring-1 ring-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/staff/companies/${company._id}/?tab=${t.id}`}
            prefetch={false}
            aria-current={tab === t.id ? "page" : undefined}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold ${tab === t.id ? "bg-brand-600 text-white" : "text-brand-900 hover:bg-brand-50"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "profile" ? <ProfileTab company={company} canManage={canManage} canDelete={can(staff.role, "b2b.delete")} /> : null}
      {tab === "users" ? (
        can(staff.role, "b2b.users") ? (
          <CompanyUsersManager companyId={company._id} portalEnabled={company.portal.enabled && company.status === "active"} users={(await listCompanyUsers(company._id)).map((u) => ({ ...u }))} />
        ) : (
          <EmptyState title="لا تملك صلاحية إدارة حسابات الشركات" />
        )
      ) : null}
      {tab === "hotels" ? <HotelsTab companyId={company._id} canManage={canManage} /> : null}
      {tab === "commissions" ? <CommissionsTab companyId={company._id} companyName={company.name} canEdit={can(staff.role, "commissions.manage")} /> : null}
      {tab === "quotes" ? <QuotesTab companyId={company._id} /> : null}
    </>
  );
}

async function ProfileTab({ company, canManage, canDelete }: { company: NonNullable<Awaited<ReturnType<typeof getCompany>>>; canManage: boolean; canDelete: boolean }) {
  const logo = await mediaById(company.branding?.logo_media_id);
  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <fieldset disabled={!canManage} className="min-w-0">
        <CompanyEditor
          key={company.updated_at}
          canDelete={canDelete}
          initial={{
            id: company._id,
            name: company.name,
            name_en: company.name_en,
            industry: company.industry,
            city: company.city,
            address: company.address,
            website: company.website,
            phone: company.phone,
            email: company.email,
            notes: company.notes,
            terms: company.terms,
            status: company.status,
            portal_enabled: company.portal.enabled,
            branding: { ...company.branding, logo },
          }}
        />
      </fieldset>
      <div className="content-start">
        <ContactsManager companyId={company._id} contacts={company.contacts} />
      </div>
    </div>
  );
}

async function HotelsTab({ companyId, canManage }: { companyId: number; canManage: boolean }) {
  const [items, hotels, settings] = await Promise.all([listCompanyHotels(companyId), hotelPickerOptions({ includeCosts: false }), getSettings()]);
  if (!canManage) return <EmptyState title="لا تملك صلاحية إدارة فنادق الشركة" />;
  return (
    <CompanyHotelsManager
      companyId={companyId}
      currencies={settings.currencies}
      hotels={hotels.map((h) => ({ id: h.id, name: h.name, city: h.city, stars: h.stars }))}
      items={items.map((it) => ({
        hotel_id: it.hotel_id,
        name: it.hotel.name_ar,
        city: hotels.find((h) => h.id === it.hotel_id)?.city ?? "",
        stars: it.hotel.stars,
        note: it.note,
        rates: it.rates,
        library: it.hotel.rates
          .filter((r) => r.active)
          .map((r) => ({ id: r.id, room: it.hotel.room_types.find((x) => x.id === r.room_type_id)?.name_ar ?? "—", board: r.board, basis: r.basis, occupancy: r.occupancy, currency: r.currency, price: r.price })),
      }))}
    />
  );
}

async function CommissionsTab({ companyId, companyName, canEdit }: { companyId: number; companyName: string; canEdit: boolean }) {
  const [rules, airlines, settings] = await Promise.all([listRules({ scope: "company", companyId }), airlineOptions(), getSettings()]);
  return (
    <RulesManager
      scope="company"
      title={`عمولات ${companyName} حسب الخطوط الجوية`}
      description="عمولة هذه الشركة من كل خط طيران على حدة، مستقلة تماماً عن عمولة الاتجاه. تعديل النسبة يضيف إصداراً جديداً ويحفظ السجل التاريخي."
      rules={rules}
      airlines={airlines}
      companies={[{ id: companyId, name: companyName }]}
      currencies={settings.currencies}
      fixedCompanyId={companyId}
      canEdit={canEdit}
    />
  );
}

async function QuotesTab({ companyId }: { companyId: number }) {
  const [quotes, requests] = await Promise.all([listQuotes({ companyId }), listB2bRequests({ companyId })]);
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader title="سجل عروض الأسعار" description="كل العروض المعدّة لهذه الشركة وحالتها." />
        {quotes.length ? (
          <Table label="عروض الشركة">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>العنوان</th>
                <th>الحالة</th>
                <th>الإجمالي</th>
                <th>أُرسل</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td>
                    <Link href={`/staff/quotes/${q.id}/`} prefetch={false} className="num font-bold text-brand-700 hover:underline">
                      {q.ref}
                    </Link>
                  </td>
                  <td className="max-w-[16rem] truncate">{q.title}</td>
                  <td>
                    <QuoteStatusBadge status={q.status} />
                  </td>
                  <td className="num whitespace-nowrap">{formatMoney(q.total, q.currency, "ar")}</td>
                  <td className="text-xs whitespace-nowrap">{q.sent_at ? formatDay(q.sent_at.slice(0, 10), "ar") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="لا توجد عروض بعد" />
        )}
      </Card>
      <Card>
        <CardHeader title="سجل البرامج والعروض التي طلبتها الشركة" description="الطلبات المرسلة من بوابة الشركة." />
        {requests.length ? (
          <Table label="طلبات الشركة">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>الطلب</th>
                <th>المستخدم</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="num font-bold">
                    <Link href={`/staff/b2b-requests/?open=${r.id}`} prefetch={false} className="text-brand-700 hover:underline">
                      {r.ref}
                    </Link>
                  </td>
                  <td>{r.title}</td>
                  <td>{r.user_name}</td>
                  <td>
                    <Badge tone={r.status === "new" ? "accent" : r.status === "quoted" ? "success" : "neutral"}>{B2B_REQUEST_STATUS_LABELS[r.status].ar}</Badge>
                  </td>
                  <td className="text-xs">{formatDay(r.created_at.slice(0, 10), "ar")}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="لا توجد طلبات من الشركة" />
        )}
      </Card>
    </div>
  );
}

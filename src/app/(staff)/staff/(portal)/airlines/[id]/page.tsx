import Link from "next/link";
import { notFound } from "next/navigation";
import { AirlineEditor } from "@/components/staff/AirlineEditor";
import { RulesManager } from "@/components/staff/RulesManager";
import { Card, CardHeader, PageHeader, Table } from "@/components/staff/ui";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { airlineToForm, countryOptions } from "@/server/airline-form";
import { airlineOptions, getAirline, listRules } from "@/server/repo/airlines";
import { listCompanies } from "@/server/repo/companies";
import { getSettings } from "@/server/repo/settings";
import { listTickets } from "@/server/repo/tickets";

export const metadata = { title: "شركة طيران" };

export default async function AirlinePage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage("airlines.view");
  const id = Number((await params).id);
  const airline = Number.isInteger(id) ? await getAirline(id) : null;
  if (!airline) notFound();
  const commissions = can(staff.role, "commissions.manage");
  const [form, ours, theirs, airlines, companies, settings, tickets] = await Promise.all([
    airlineToForm(airline),
    commissions ? listRules({ scope: "etijah", airlineId: id }) : Promise.resolve([]),
    commissions ? listRules({ scope: "company", airlineId: id }) : Promise.resolve([]),
    airlineOptions(),
    listCompanies(),
    getSettings(),
    can(staff.role, "tickets.view") ? listTickets({ airlineId: id }, 10) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title={airline.name_ar}
        description={
          <span dir="ltr">
            {airline.name_en}
            {airline.iata ? ` · ${airline.iata}` : ""}
          </span>
        }
        back={{ href: "/staff/airlines/", label: "شركات الطيران" }}
      />
      <div className="grid gap-6">
        <AirlineEditor key={airline.updated_at} initial={form} canEdit={can(staff.role, "airlines.edit")} countries={countryOptions()} />
        {commissions ? (
          <>
            <RulesManager
              scope="etijah"
              title="عمولة الاتجاه من هذه الشركة"
              description="هل تدفع الشركة عمولة للاتجاه؟ النسبة وأساس احتسابها وطريقة التسوية، مع السجل التاريخي. لا يُفترض وجود عمولة."
              rules={ours}
              airlines={airlines}
              companies={[]}
              currencies={settings.currencies}
              fixedAirlineId={id}
              canEdit
            />
            <RulesManager
              scope="company"
              title="عمولات الشركات على هذا الخط"
              description="عمولة كل شركة B2B من هذا الخط، مستقلة عن عمولة الاتجاه."
              rules={theirs}
              airlines={airlines}
              companies={companies.map((c) => ({ id: c.id, name: c.name }))}
              currencies={settings.currencies}
              fixedAirlineId={id}
              canEdit
            />
          </>
        ) : null}
        {tickets.length ? (
          <Card>
            <CardHeader title="آخر عمليات الإصدار" />
            <Table label="آخر التذاكر">
              <thead>
                <tr>
                  <th>المرجع</th>
                  <th>رقم التذكرة</th>
                  <th>الشركة</th>
                  <th>التاريخ</th>
                  <th>القيمة</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/staff/tickets/${t.id}/`} prefetch={false} className="num font-bold text-brand-700 hover:underline">
                        {t.ref}
                      </Link>
                    </td>
                    <td className="num" dir="ltr">
                      {t.ticket_number}
                    </td>
                    <td>{t.company_name ?? "مباشر"}</td>
                    <td className="text-xs">{formatDay(t.issued_at, "ar")}</td>
                    <td className="num">{formatMoney(t.total_fare, t.currency, "ar")}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ) : null}
      </div>
    </>
  );
}

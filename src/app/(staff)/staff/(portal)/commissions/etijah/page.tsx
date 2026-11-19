import { RulesManager } from "@/components/staff/RulesManager";
import { Card, PageHeader } from "@/components/staff/ui";
import { requireStaffPage } from "@/server/auth/session";
import { airlineOptions, listRules } from "@/server/repo/airlines";
import { getSettings } from "@/server/repo/settings";

export const metadata = { title: "عمولات شركة الاتجاه" };

export default async function EtijahCommissionsPage() {
  await requireStaffPage("commissions.manage");
  const [rules, airlines, settings] = await Promise.all([listRules({ scope: "etijah" }), airlineOptions(), getSettings()]);
  const withRule = new Set(rules.filter((r) => r.current).map((r) => r.airline_id));
  const missing = airlines.filter((a) => !withRule.has(a.id));
  return (
    <>
      <PageHeader
        title="عمولات شركة الاتجاه من الخطوط الجوية"
        description="هل تدفع كل شركة طيران عمولة للاتجاه؟ ونسبتها وأساس احتسابها والتسوية. منفصلة تماماً عن عمولات الشركات المتعاملة معنا. لا توجد نسب افتراضية."
      />
      {missing.length ? (
        <Card className="mb-6 border-accent-200 bg-accent-50 p-4 text-sm font-bold text-accent-700">
          لا توجد قاعدة سارية اليوم لـ: {missing.map((a) => a.name).join("، ")}. التذاكر على هذه الخطوط ستُسجّل «بدون عمولة» حتى تحديد القاعدة.
        </Card>
      ) : null}
      <RulesManager
        scope="etijah"
        title="القواعد والسجل التاريخي"
        description="لكل خط: توجد عمولة / لا توجد / سعر صافي، النسبة، تُحتسب على السعر الأساسي أو الإجمالي أو أساس آخر، والعملة والتسوية."
        rules={rules}
        airlines={airlines}
        companies={[]}
        currencies={settings.currencies}
        canEdit
      />
    </>
  );
}

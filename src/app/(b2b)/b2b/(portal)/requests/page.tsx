import { Inbox } from "lucide-react";
import Link from "next/link";
import { PortalRequestForm } from "@/components/b2b/PortalForms";
import { Badge, Card, CardHeader, EmptyState } from "@/components/staff/ui";
import { countryName } from "@/lib/countries";
import { formatDay } from "@/lib/dates";
import { companyCan, requireCompanyPage } from "@/server/auth/session";
import { B2B_REQUEST_STATUS_LABELS, listB2bRequests, portalHotels } from "@/server/repo/b2b";

export const metadata = { title: "طلباتنا" };

export default async function PortalRequestsPage({ searchParams }: { searchParams: Promise<{ new?: string; hotel?: string }> }) {
  const user = await requireCompanyPage("requests.create");
  const sp = await searchParams;
  const [requests, hotels] = await Promise.all([listB2bRequests({ companyId: user.companyId }), companyCan(user, "hotels.view") ? portalHotels(user.companyId, "ar") : Promise.resolve([])]);
  const countries = [...new Set(hotels.map((h) => h.hotel.countryCode))];
  const preselect = Number(sp.hotel);
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader title="طلب برنامج أو عرض سعر" description="أرسلوا تفاصيل الرحلة وسيعدّ فريق الاتجاه العرض ويتيحه في بوابتكم." />
        <div className="p-5">
          <PortalRequestForm
            hotels={hotels.map((h) => ({ id: h.hotel.id, name: h.hotel.name, city: h.hotel.city }))}
            countries={(countries.length ? countries : ["TR", "AE", "GE", "EG", "MY"]).map((c) => ({ code: c, name: countryName(c, "ar") }))}
            preselectHotel={hotels.some((h) => h.hotel.id === preselect) ? preselect : null}
          />
        </div>
      </Card>
      <Card>
        <CardHeader title="طلباتنا السابقة" />
        {requests.length ? (
          <ul role="list" className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5" data-portal-request={r.ref}>
                <span>
                  <span className="font-bold text-brand-950">{r.title}</span>
                  <span className="block text-xs text-muted">
                    <span className="num">{r.ref}</span> · {formatDay(r.created_at.slice(0, 10), "ar")} · {r.user_name}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={r.status === "quoted" ? "success" : r.status === "new" ? "accent" : "neutral"}>{B2B_REQUEST_STATUS_LABELS[r.status].ar}</Badge>
                  {r.quote_id && r.status === "quoted" && companyCan(user, "quotes.view") ? (
                    <Link href={`/b2b/quotes/${r.quote_id}/`} prefetch={false} className="text-sm font-bold text-brand-700 hover:underline">
                      العرض
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Inbox className="size-6" />} title="لا توجد طلبات بعد" />
        )}
      </Card>
    </div>
  );
}

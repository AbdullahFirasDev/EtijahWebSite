import Link from "next/link";
import { notFound } from "next/navigation";
import { HotelEditor } from "@/components/staff/HotelEditor";
import { HotelRatesEditor } from "@/components/staff/HotelRatesEditor";
import { Badge, Card, CardHeader, PageHeader } from "@/components/staff/ui";
import { countryName } from "@/lib/countries";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { PROGRAM_STATUS_LABELS, QUOTE_STATUS_LABELS, TYPE_LABELS, type ProgramStatus, type ProgramType, type QuoteStatus } from "@/lib/travel-labels";
import { requireStaffPage } from "@/server/auth/session";
import { mediaList } from "@/server/media";
import { destinationOptions } from "@/server/editor-options";
import { getHotel, hotelUsedBy } from "@/server/repo/catalog";
import { getSettings } from "@/server/repo/settings";
import { recentAudit } from "@/server/security";

export const metadata = { title: "فندق" };

export default async function EditHotelPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage("hotels.view");
  const id = Number((await params).id);
  const hotel = Number.isInteger(id) ? await getHotel(id) : null;
  if (!hotel) notFound();
  const showCosts = can(staff.role, "hotels.costs");
  const [media, geo, usage, settings, history] = await Promise.all([
    mediaList(hotel.media),
    destinationOptions(),
    hotelUsedBy(hotel._id),
    getSettings(),
    can(staff.role, "audit.view") || can(staff.role, "hotels.rates") ? recentAudit("hotel", hotel._id, 15) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title={hotel.name_ar}
        description={
          <>
            <span dir="ltr">{hotel.name_en}</span> · {countryName(hotel.country_code, "ar")}
          </>
        }
        back={{ href: "/staff/hotels/", label: "مكتبة الفنادق" }}
      />
      <div className="grid gap-6">
        <HotelEditor
          destinations={geo.destinations}
          countries={geo.countries}
          canDelete={can(staff.role, "programs.delete")}
          canEdit={can(staff.role, "hotels.edit")}
          initial={{
            id: hotel._id,
            destination_id: hotel.destination_id,
            name_ar: hotel.name_ar,
            name_en: hotel.name_en,
            stars: hotel.stars,
            category_ar: hotel.category_ar,
            category_en: hotel.category_en,
            website_url: hotel.website_url,
            maps_url: hotel.maps_url,
            address_ar: hotel.address_ar,
            address_en: hotel.address_en,
            description_ar: hotel.description_ar,
            description_en: hotel.description_en,
            rooms_ar: hotel.rooms_ar,
            rooms_en: hotel.rooms_en,
            amenities: hotel.amenities ?? [],
            contact: hotel.contact ?? { phone: null, email: null, person: null },
            internal_notes: hotel.internal_notes,
            status: hotel.status,
            media,
            room_types: hotel.room_types,
          }}
        />

        <HotelRatesEditor
          key={hotel.rates_updated_at ?? "none"}
          hotelId={hotel._id}
          roomTypes={hotel.room_types}
          currencies={settings.currencies}
          canEdit={can(staff.role, "hotels.rates")}
          showCosts={showCosts}
          initial={hotel.rates.map((r) => ({ ...r, cost: showCosts ? r.cost : null }))}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="البرامج التي تستخدم الفندق" description={`${usage.programs.length} برنامج`} />
            {usage.programs.length ? (
              <ul role="list" className="divide-y divide-line">
                {usage.programs.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link href={`/staff/programs/${p.id}/`} prefetch={false} className="font-bold text-brand-900 hover:underline">
                      {p.title} <span className="num text-xs text-muted">{p.code}</span>
                    </Link>
                    <span className="flex gap-1.5">
                      <Badge tone="brand">{TYPE_LABELS[p.type as ProgramType]?.ar ?? p.type}</Badge>
                      <Badge tone={p.status === "published" ? "success" : "muted"}>{PROGRAM_STATUS_LABELS[p.status as ProgramStatus] ?? p.status}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">لم يُستخدم هذا الفندق في أي برنامج بعد.</p>
            )}
            {usage.quotes.length ? (
              <>
                <p className="border-t border-line px-5 pt-4 text-xs font-bold text-muted">عروض أسعار تتضمنه</p>
                <ul role="list" className="divide-y divide-line">
                  {usage.quotes.map((q) => (
                    <li key={q.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                      <Link href={`/staff/quotes/${q.id}/`} prefetch={false} className="font-bold text-brand-900 hover:underline">
                        <span className="num">{q.ref}</span> — {q.title}
                      </Link>
                      <Badge tone="neutral">{QUOTE_STATUS_LABELS[q.status as QuoteStatus]?.ar ?? q.status}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Card>
          <Card>
            <CardHeader title="سجل تعديلات الفندق والأسعار" description="آخر 15 عملية (Audit Log)." />
            {history.length ? (
              <ul role="list" className="divide-y divide-line text-sm">
                {history.map((h, i) => {
                  const changes = (h.meta as { changes?: { change: string; rate_id: string; diff?: Record<string, [unknown, unknown]>; after?: { price: number; currency: string } }[] } | null)?.changes;
                  return (
                    <li key={i} className="px-5 py-3">
                      <p className="font-bold text-brand-950">
                        {h.action === "rates" ? "تعديل الأسعار" : h.action === "create" ? "إنشاء" : h.action.startsWith("status:") ? "تغيير الحالة" : "تعديل البيانات"}
                        <span className="ms-2 text-xs font-normal text-muted">
                          {h.user_name ?? "النظام"} · {formatDateTime(h.created_at)}
                        </span>
                      </p>
                      {changes?.length ? (
                        <ul className="mt-1 grid gap-0.5 text-xs text-muted">
                          {changes.slice(0, 6).map((c, j) => (
                            <li key={j}>
                              {c.change === "added" && c.after
                                ? `سعر جديد: ${formatMoney(c.after.price, c.after.currency, "ar")}`
                                : Object.entries(c.diff ?? {})
                                    .filter(([k]) => showCosts || k !== "cost")
                                    .map(([k, [a, b]]) => `${k === "price" ? "سعر البيع" : k === "cost" ? "التكلفة" : k}: ${typeof a === "number" ? a / 100 : String(a)} ← ${typeof b === "number" ? b / 100 : String(b)}`)
                                    .join(" · ")}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">لا توجد تعديلات مسجلة بعد.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

import { BedDouble, Globe, MapPinned, Plus, Star } from "lucide-react";
import Link from "next/link";
import { QuickRates } from "@/components/staff/QuickRates";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, Select, Table } from "@/components/staff/ui";
import { COUNTRY_CODES, countryName, flag } from "@/lib/countries";
import { mediaSrc } from "@/lib/media";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { mediaByIds } from "@/server/media";
import { listDestinations, listHotels } from "@/server/repo/catalog";

export const metadata = { title: "مكتبة الفنادق" };

export default async function HotelsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaffPage("hotels.view");
  const sp = await searchParams;
  const q = sp.q?.slice(0, 80) || undefined;
  const country = /^[A-Z]{2}$/.test(sp.country ?? "") ? sp.country : undefined;
  const destinationId = /^\d+$/.test(sp.city ?? "") ? Number(sp.city) : undefined;
  const stars = /^[1-5]$/.test(sp.stars ?? "") ? Number(sp.stars) : undefined;
  const status = sp.status === "archived" || sp.status === "all" ? sp.status : "active";
  const [hotels, destinations] = await Promise.all([listHotels({ q, country, destinationId, stars, status }), listDestinations()]);
  const media = await mediaByIds(hotels.map((h) => h.cover));
  const canEdit = can(staff.role, "hotels.edit");
  const canRates = can(staff.role, "hotels.rates");
  const showCosts = can(staff.role, "hotels.costs");
  // Only places that have hotels (hundreds of reference destinations would drown the filters).
  const order = new Map(COUNTRY_CODES.map((c, i) => [c, i]));
  const withHotels = destinations.filter((d) => d.hotels > 0 || d.id === destinationId);
  const countries = [...new Set([...withHotels.map((d) => d.country_code), ...(country ? [country] : [])])].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
  const cityCountries = countries.filter((c) => !country || c === country);
  const cities = withHotels;

  return (
    <>
      <PageHeader
        title="مكتبة الفنادق"
        description="قاعدة بيانات الشركة لكل الفنادق التي نتعامل معها: البيانات والصور والروابط وأسعار الغرف. تُستخدم مباشرة في البرامج وعروض الأسعار دون إعادة إدخال."
        actions={
          canEdit ? (
            <LinkButton href="/staff/hotels/new/" variant="primary">
              <Plus className="size-4" aria-hidden="true" /> فندق جديد
            </LinkButton>
          ) : null
        }
      />
      <Card>
        <form className="grid gap-2 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr_auto]" role="search">
          <Input name="q" defaultValue={q} placeholder="ابحث باسم الفندق…" aria-label="بحث" />
          <Select name="country" defaultValue={country ?? ""} aria-label="الدولة">
            <option value="">كل الدول</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {countryName(c, "ar")}
              </option>
            ))}
          </Select>
          <Select name="city" defaultValue={destinationId ?? ""} aria-label="المدينة">
            <option value="">كل المدن</option>
            {cityCountries.map((c) => (
              <optgroup key={c} label={countryName(c, "ar")}>
                {cities
                  .filter((d) => d.country_code === c)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name_ar}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
          <Select name="stars" defaultValue={stars ?? ""} aria-label="النجوم">
            <option value="">كل التصنيفات</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} نجوم
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={status} aria-label="الحالة">
            <option value="active">المفعّلة</option>
            <option value="archived">المؤرشفة</option>
            <option value="all">الكل</option>
          </Select>
          <button className="h-11 rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">تصفية</button>
        </form>
        {hotels.length ? (
          <Table label="الفنادق">
            <thead>
              <tr>
                <th>الفندق</th>
                <th>المدينة</th>
                <th>التصنيف</th>
                <th>أسعار الليلة</th>
                <th>الروابط</th>
                <th>في البرامج</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {hotels.map((h) => {
                const cover = h.cover ? media.get(h.cover) : null;
                return (
                  <tr key={h.id} data-hotel-row={h.id}>
                    <td>
                      <Link href={`/staff/hotels/${h.id}/`} prefetch={false} className="flex items-center gap-3">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaSrc(cover, 480)} alt="" className="size-12 rounded-lg object-cover" />
                        ) : (
                          <span className="grid size-12 place-items-center rounded-lg bg-mist text-muted">
                            <BedDouble className="size-5" aria-hidden="true" />
                          </span>
                        )}
                        <span>
                          <span className="block font-bold text-brand-950 hover:underline">{h.name_ar}</span>
                          <span className="block text-xs text-muted" dir="ltr">
                            {h.name_en}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span aria-hidden="true">{flag(h.country_code)}</span> {h.dest_name_ar}، {countryName(h.country_code, "ar")}
                    </td>
                    <td>
                      {h.stars ? (
                        <span className="inline-flex items-center gap-0.5 text-accent-600" aria-label={`${h.stars} نجوم`}>
                          {Array.from({ length: h.stars }, (_, i) => (
                            <Star key={i} className="size-3.5 fill-current" aria-hidden="true" />
                          ))}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <QuickRates
                        hotelId={h.id}
                        hotelName={h.name_ar}
                        canEdit={canRates}
                        showCosts={showCosts}
                        rates={h.rates
                          .filter((r) => r.active)
                          .map((r) => ({
                            id: r.id,
                            room: h.room_types.find((x) => x.id === r.room_type_id)?.name_ar ?? "—",
                            board: r.board,
                            basis: r.basis,
                            occupancy: r.occupancy,
                            currency: r.currency,
                            price: r.price,
                            cost: showCosts ? r.cost : null,
                          }))}
                      />
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        {h.website_url ? (
                          <Badge tone="brand">
                            <Globe className="size-3" aria-hidden="true" /> الموقع
                          </Badge>
                        ) : null}
                        {h.maps_url ? (
                          <Badge tone="brand">
                            <MapPinned className="size-3" aria-hidden="true" /> الخريطة
                          </Badge>
                        ) : null}
                        {!h.website_url && !h.maps_url ? <Badge tone="accent">بلا رابط</Badge> : null}
                      </div>
                    </td>
                    <td className="num">
                      {h.programs ? (
                        <Link href={`/staff/programs/?hotel=${h.id}`} prefetch={false} className="font-bold text-brand-700 hover:underline">
                          {h.programs}
                        </Link>
                      ) : (
                        0
                      )}
                    </td>
                    <td>{h.status === "active" ? <Badge tone="success">مفعّل</Badge> : <Badge tone="muted">مؤرشف</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            icon={<BedDouble className="size-6" />}
            title={q || country || stars || destinationId ? "لا توجد نتائج" : "لا توجد فنادق بعد"}
            text="أضف الفنادق المعتمدة مع أنواع غرفها وأسعارها وروابطها الرسمية وصورها لتستخدمها في البرامج وعروض الأسعار."
            action={canEdit && !q ? <LinkButton href="/staff/hotels/new/" variant="primary">إضافة فندق</LinkButton> : undefined}
          />
        )}
      </Card>
    </>
  );
}

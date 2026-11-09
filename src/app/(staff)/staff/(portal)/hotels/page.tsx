import { BedDouble, Globe, MapPinned, Plus, Star } from "lucide-react";
import Link from "next/link";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, Table } from "@/components/staff/ui";
import { countryName, flag } from "@/lib/countries";
import { mediaSrc } from "@/lib/media";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { mediaByIds } from "@/server/media";
import { listHotels } from "@/server/repo/catalog";

export const metadata = { title: "الفنادق" };

export default async function HotelsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requireStaffPage("catalog.view");
  const { q } = await searchParams;
  const hotels = listHotels({ q: q?.slice(0, 80) });
  const media = mediaByIds(hotels.map((h) => h.cover).filter((m): m is string => !!m));
  const canEdit = can(staff.role, "hotels.edit");

  return (
    <>
      <PageHeader
        title="الفنادق"
        description="الفنادق المعتمدة مع تصنيفها وصورها وروابطها الرسمية. تُستخدم في البرامج وعروض أسعار الشركات."
        actions={
          canEdit ? (
            <LinkButton href="/staff/hotels/new/" variant="primary">
              <Plus className="size-4" aria-hidden="true" /> فندق جديد
            </LinkButton>
          ) : null
        }
      />
      <Card>
        <form className="flex gap-2 border-b border-line p-4" role="search">
          <Input name="q" defaultValue={q} placeholder="ابحث باسم الفندق…" aria-label="بحث" className="max-w-sm" />
          <button className="rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">بحث</button>
        </form>
        {hotels.length ? (
          <Table label="الفنادق">
            <thead>
              <tr>
                <th>الفندق</th>
                <th>المدينة</th>
                <th>التصنيف</th>
                <th>الروابط</th>
                <th>في البرامج</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {hotels.map((h) => {
                const cover = h.cover ? media.get(h.cover) : null;
                return (
                  <tr key={h.id}>
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
                    <td className="num">{h.programs}</td>
                    <td>{h.active ? <Badge tone="success">مفعّل</Badge> : <Badge tone="muted">موقوف</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            icon={<BedDouble className="size-6" />}
            title={q ? "لا توجد نتائج" : "لا توجد فنادق بعد"}
            text="أضف الفنادق المعتمدة مع روابطها الرسمية وصورها لتستخدمها في البرامج وعروض الأسعار."
            action={canEdit && !q ? <LinkButton href="/staff/hotels/new/" variant="primary">إضافة فندق</LinkButton> : undefined}
          />
        )}
      </Card>
    </>
  );
}

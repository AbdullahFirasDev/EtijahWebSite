import { BedDouble, Star } from "lucide-react";
import Link from "next/link";
import { MediaImage } from "@/components/travel/MediaImage";
import { EmptyState } from "@/components/staff/ui";
import { formatMoney } from "@/lib/money";
import { RATE_BASIS_LABELS } from "@/lib/travel-labels";
import { requireCompanyPage } from "@/server/auth/session";
import { portalHotels } from "@/server/repo/b2b";

export const metadata = { title: "الفنادق" };

/** Hotels the administration made available to this company, at this company's prices only. */
export default async function PortalHotelsPage() {
  const user = await requireCompanyPage("hotels.view");
  const hotels = await portalHotels(user.companyId, "ar");
  return (
    <>
      <h1 className="text-2xl font-extrabold text-brand-950">الفنادق المتاحة لشركتكم</h1>
      <p className="mt-1 text-muted">الأسعار المعروضة هي الأسعار المخصصة لشركتكم لليلة الواحدة.</p>
      {hotels.length ? (
        <ul role="list" className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {hotels.map(({ hotel, rates }) => {
            const lowest = rates.length ? rates.reduce((m, r) => (r.price < m.price ? r : m)) : null;
            return (
              <li key={hotel.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-line" data-portal-hotel={hotel.id}>
                <Link href={`/b2b/hotels/${hotel.id}/`} prefetch={false} className="block">
                  <div className="aspect-[16/10] bg-brand-100">
                    {hotel.images[0] ? <MediaImage media={hotel.images[0]} alt={hotel.name} sizes="24rem" className="h-full w-full object-cover" /> : (
                      <div className="grid h-full place-items-center text-brand-300">
                        <BedDouble className="size-10" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="flex items-center justify-between gap-2 font-extrabold text-brand-950">
                      {hotel.name}
                      {hotel.stars ? (
                        <span className="inline-flex text-accent-500" aria-label={`${hotel.stars} نجوم`}>
                          {Array.from({ length: hotel.stars }, (_, i) => (
                            <Star key={i} className="size-3.5 fill-current" aria-hidden="true" />
                          ))}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted">
                      {hotel.city}، {hotel.country}
                    </p>
                    {lowest ? (
                      <p className="mt-2 text-sm">
                        يبدأ من <span className="num font-black text-brand-700">{formatMoney(lowest.price, lowest.currency, "ar")}</span> {RATE_BASIS_LABELS[lowest.basis].ar}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<BedDouble className="size-6" />} title="لا توجد فنادق متاحة بعد" text="سيتيح فريق الاتجاه الفنادق المتفق عليها لشركتكم." />
      )}
    </>
  );
}

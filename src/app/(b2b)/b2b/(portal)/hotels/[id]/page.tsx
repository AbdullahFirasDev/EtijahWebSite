import { ExternalLink, MapPinned, Star } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaImage } from "@/components/travel/MediaImage";
import { formatMoney } from "@/lib/money";
import { BOARD_LABELS, RATE_BASIS_LABELS } from "@/lib/travel-labels";
import { requireCompanyPage } from "@/server/auth/session";
import { portalHotel } from "@/server/repo/b2b";

export const metadata = { title: "فندق" };

export default async function PortalHotelPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCompanyPage("hotels.view");
  const id = Number((await params).id);
  // Only hotels granted to this user's company are found; anything else is "not found".
  const item = Number.isInteger(id) ? await portalHotel(user.companyId, id, "ar") : null;
  if (!item) notFound();
  const { hotel, rates, note } = item;
  return (
    <>
      <Link href="/b2b/hotels/" prefetch={false} className="text-sm font-bold text-brand-600 hover:underline">
        → الفنادق
      </Link>
      <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-extrabold text-brand-950">
        {hotel.name}
        {hotel.stars ? (
          <span className="inline-flex text-accent-500">
            {Array.from({ length: hotel.stars }, (_, i) => (
              <Star key={i} className="size-4 fill-current" aria-hidden="true" />
            ))}
          </span>
        ) : null}
      </h1>
      <p className="text-muted">
        {hotel.city}، {hotel.country}
        {hotel.address ? ` — ${hotel.address}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {hotel.websiteUrl ? (
          <a href={hotel.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold text-brand-700 ring-1 ring-line">
            <ExternalLink className="size-4" aria-hidden="true" /> الموقع الرسمي
          </a>
        ) : null}
        {hotel.mapsUrl ? (
          <a href={hotel.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold text-brand-700 ring-1 ring-line">
            <MapPinned className="size-4" aria-hidden="true" /> الخريطة
          </a>
        ) : null}
      </div>
      {hotel.images.length ? (
        <ul role="list" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {hotel.images.slice(0, 8).map((m) => (
            <li key={m.id} className="aspect-[4/3] overflow-hidden rounded-xl bg-brand-100">
              <MediaImage media={m} alt="" sizes="16rem" className="h-full w-full object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
      {hotel.description ? <p className="mt-6 leading-[2] whitespace-pre-line text-ink/90">{hotel.description}</p> : null}
      <section className="mt-8 overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        <h2 className="border-b border-line px-5 py-3 font-extrabold text-brand-950">أسعار شركتكم لليلة</h2>
        {rates.length ? (
          <table className="w-full text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_th]:bg-mist [&_th]:px-4 [&_th]:py-2 [&_th]:text-start [&_th]:text-xs [&_th]:text-muted">
            <thead>
              <tr>
                <th>الغرفة</th>
                <th>الوجبات</th>
                <th>الأشخاص</th>
                <th>السعر لليلة</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r, i) => (
                <tr key={i} data-portal-rate>
                  <td className="font-bold">{r.room ?? "—"}</td>
                  <td>{r.board ? BOARD_LABELS[r.board].ar : "—"}</td>
                  <td className="num">{r.occupancy}</td>
                  <td>
                    <span className="num font-black text-brand-700">{formatMoney(r.price, r.currency, "ar")}</span> <span className="text-xs text-muted">{RATE_BASIS_LABELS[r.basis].ar}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">لم تُحدد أسعار بعد. تواصل مع فريق الاتجاه.</p>
        )}
        {note ? <p className="border-t border-line px-5 py-3 text-sm text-muted">{note}</p> : null}
      </section>
      {hotel.amenities.length ? (
        <p className="mt-4 text-sm text-muted">
          <span className="font-bold text-brand-950">المرافق: </span>
          {hotel.amenities.join("، ")}
        </p>
      ) : null}
      <p className="mt-6">
        <Link href={`/b2b/requests/?new=1&hotel=${hotel.id}`} prefetch={false} className="inline-flex h-11 items-center rounded-xl px-5 font-bold text-white" style={{ background: "var(--pp)" }}>
          طلب عرض سعر بهذا الفندق
        </Link>
      </p>
    </>
  );
}

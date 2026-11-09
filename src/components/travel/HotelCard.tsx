import { BedDouble, ExternalLink, MapPinned, Moon, Star, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/content/site";
import { localePath, travel } from "@/content/travel";
import { BOARD_LABELS, type Board } from "@/lib/travel-labels";
import type { HotelPublic } from "@/server/repo/catalog";
import { MediaImage } from "./MediaImage";

export function Stars({ n, className = "size-4" }: { n: number | null; className?: string }) {
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-accent-500" role="img" aria-label={`${n} ★`}>
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} className={`${className} fill-current`} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Hotel within a program. The hotel name always links to its page on the site. */
export function HotelCard({ hotel, locale }: { hotel: HotelPublic & { nights: number; room: string | null; board: Board | null }; locale: Locale }) {
  const t = travel[locale].detail;
  const cover = hotel.images[0];
  return (
    <article className="group flex flex-col overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-brand-950/5 shadow-[0_18px_40px_-30px_rgb(5_28_51/0.5)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-brand-100">
        {cover ? <MediaImage media={cover} alt={hotel.name} sizes="(min-width: 1024px) 24rem, (min-width: 640px) 45vw, 92vw" className="h-full w-full object-cover transition-transform duration-[1.4s] ease-out-expo group-hover:scale-105" /> : (
          <div className="grid h-full place-items-center text-brand-300">
            <BedDouble className="size-10" aria-hidden="true" />
          </div>
        )}
        {hotel.images.length > 1 ? <span className="num absolute end-3 bottom-3 rounded-full bg-brand-950/70 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">+{hotel.images.length - 1}</span> : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <Stars n={hotel.stars} />
          {hotel.category ? <span className="text-xs font-bold text-muted">{hotel.category}</span> : null}
        </div>
        <h3 className="mt-2 text-lg leading-[1.45] font-extrabold text-brand-950">
          <Link href={localePath(locale, `/hotels/${hotel.slug}/`)} prefetch={false} className="underline decoration-brand-200 decoration-2 underline-offset-[6px] transition-colors hover:text-brand-700 hover:decoration-accent-500" data-hotel-link>
            {hotel.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">
          {hotel.city}، {hotel.country}
        </p>
        <ul role="list" className="mt-4 grid gap-2 text-sm">
          <li className="flex items-center gap-2 font-semibold text-brand-900">
            <Moon className="size-4 text-brand-500" aria-hidden="true" /> {t.nightsAt(hotel.nights)}
          </li>
          {hotel.room ? (
            <li className="flex items-center gap-2 text-ink/85">
              <BedDouble className="size-4 text-brand-500" aria-hidden="true" /> {hotel.room}
            </li>
          ) : null}
          {hotel.board ? (
            <li className="flex items-center gap-2 text-ink/85">
              <UtensilsCrossed className="size-4 text-brand-500" aria-hidden="true" /> {BOARD_LABELS[hotel.board][locale]}
            </li>
          ) : null}
        </ul>
        {hotel.websiteUrl || hotel.mapsUrl ? (
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            {hotel.websiteUrl ? (
              <a href={hotel.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-bold text-brand-800 hover:border-brand-300 hover:bg-brand-50">
                <ExternalLink className="size-3.5" aria-hidden="true" /> {t.website}
              </a>
            ) : null}
            {hotel.mapsUrl ? (
              <a href={hotel.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-bold text-brand-800 hover:border-brand-300 hover:bg-brand-50">
                <MapPinned className="size-3.5" aria-hidden="true" /> {t.map}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

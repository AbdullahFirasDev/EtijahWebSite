import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/content/site";
import { localePath, travel } from "@/content/travel";
import { dayParts, daysBetween } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { DeparturePublic, ProgramCard } from "@/server/repo/programs";
import { MediaImage } from "./MediaImage";

/** A group departure as a compact "ticket": big date block, program, seat meter. */
export function DepartureCard({ program, departure, locale }: { program: ProgramCard; departure: DeparturePublic; locale: Locale }) {
  const t = travel[locale];
  const p = dayParts(departure.departDate, locale);
  const back = dayParts(departure.returnDate, locale);
  const used = departure.seatsTotal - departure.seatsLeft;
  const pct = Math.min(100, Math.round((used / Math.max(1, departure.seatsTotal)) * 100));
  const price = departure.price ?? program.priceFrom;

  return (
    <article className="group relative flex w-[19rem] shrink-0 snap-start overflow-hidden rounded-[1.5rem] bg-white shadow-[0_18px_40px_-26px_rgb(5_28_51/0.5)] ring-1 ring-brand-950/5 sm:w-[22rem]">
      <div className="relative w-24 shrink-0 overflow-hidden bg-brand-950 text-center text-white sm:w-28">
        {program.cover ? <MediaImage media={program.cover} alt="" sizes="7rem" max={480} className="absolute inset-0 h-full w-full object-cover opacity-35" /> : null}
        <div className="relative flex h-full flex-col items-center justify-center gap-0.5 px-2 py-5">
          <span className="text-xs font-bold text-accent-300">{p.weekday}</span>
          <span className="num text-4xl leading-none font-black">{p.day}</span>
          <span className="text-sm font-bold">{p.month}</span>
          <span className="num text-xs text-white/70">{p.year}</span>
        </div>
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col p-4">
        <h3 className="line-clamp-2 leading-[1.5] font-extrabold text-brand-950">
          <Link href={`${localePath(locale, `/programs/${program.slug}/`)}?departure=${departure.id}`} prefetch={false} className="after:absolute after:inset-0 after:content-['']">
            {program.title}
          </Link>
        </h3>
        <p className="mt-1 text-xs font-semibold text-muted">
          {t.card.days(daysBetween(departure.departDate, departure.returnDate) + 1)} · {t.detail.return} {back.day} {back.month}
        </p>
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={`inline-flex items-center gap-1 ${departure.soldOut ? "text-muted" : departure.seatsLeft <= 8 ? "text-accent-700" : "text-brand-700"}`}>
              <Users className="size-3.5" aria-hidden="true" />
              {departure.soldOut ? t.card.soldOut : t.card.seatsLeft(departure.seatsLeft)}
            </span>
            {price != null ? <span className="num text-sm font-black text-brand-900">{formatMoney(price, program.currency, locale)}</span> : null}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist" role="meter" aria-valuemin={0} aria-valuemax={departure.seatsTotal} aria-valuenow={used} aria-label={t.detail.seats}>
            <div className={`h-full rounded-full ${departure.seatsLeft <= 8 ? "bg-accent-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <ArrowLeft aria-hidden="true" className="absolute end-3 top-3 size-4 text-muted transition-transform group-hover:text-accent-600 ltr:-scale-x-100 motion-safe:rtl:group-hover:-translate-x-0.5" />
      </div>
    </article>
  );
}

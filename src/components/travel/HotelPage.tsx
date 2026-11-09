import { ChevronLeft, ExternalLink, MapPin, MapPinned } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion/Reveal";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import type { Locale } from "@/content/site";
import { localePath, travel } from "@/content/travel";
import { asset } from "@/lib/asset";
import { mediaUrl } from "@/lib/media";
import { travelPageMetadata } from "@/lib/seo";
import { publicHotelBySlug } from "@/server/repo/catalog";
import { programsWithHotel } from "@/server/repo/programs";
import { Stars } from "./HotelCard";
import { MediaImage } from "./MediaImage";
import { OfferCard } from "./OfferCard";
import { TravelShell } from "./TravelShell";

export function hotelMetadata(locale: Locale, slug: string): Metadata {
  const h = publicHotelBySlug(slug, locale);
  if (!h) return { robots: { index: false } };
  return travelPageMetadata({
    locale,
    title: `${h.name} — ${h.city}`,
    description: h.description?.slice(0, 160) ?? `${h.name}, ${h.city}, ${h.country}`,
    path: `/hotels/${h.slug}/`,
    image: h.images[0] ? mediaUrl(h.images[0].id, h.images[0].widths.at(-1)!) : null,
  });
}

export function HotelPage({ locale, slug }: { locale: Locale; slug: string }) {
  const h = publicHotelBySlug(slug, locale);
  if (!h) notFound();
  const t = travel[locale];
  const programs = programsWithHotel(h.id, locale);
  const [cover, ...rest] = h.images;

  return (
    <TravelShell dict={locale === "ar" ? ar : en} languageHref={locale === "ar" ? `/en/hotels/${h.slug}/` : `/hotels/${h.slug}/`}>
      <section id="top" aria-labelledby="hotel-title" className="surface-dark relative isolate flex min-h-[62svh] items-end overflow-hidden bg-brand-950">
        {cover ? (
          <div className="absolute inset-0 -z-10" data-hero-image>
            <MediaImage media={cover} alt="" priority sizes="100vw" max={1600} className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-brand-950 via-brand-950/50 to-brand-950/40" />
        <div className="container-site pt-36 pb-14">
          <nav aria-label={t.detail.breadcrumbs}>
            <ol className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-white/70">
              <li>
                <Link href={localePath(locale, "/programs/")} prefetch={false} className="hover:text-white">
                  {t.nav.programs}
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronLeft className="size-4 ltr:-scale-x-100" />
              </li>
              <li aria-current="page" className="text-white">
                {h.name}
              </li>
            </ol>
          </nav>
          <p className="mt-6 text-sm font-bold text-accent-300">{t.hotel.eyebrow}</p>
          <h1 id="hotel-title" className="mt-2 text-[2.2rem] leading-[1.2] font-black text-white sm:text-[3.2rem]">
            {h.name}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-bold text-white/90">
            <Stars n={h.stars} className="size-5" />
            {h.category ? <span>{h.category}</span> : null}
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-5 text-accent-400" aria-hidden="true" />
              {h.city}، {h.country}
            </span>
          </div>
          {h.websiteUrl || h.mapsUrl ? (
            <div className="mt-7 flex flex-wrap gap-3">
              {h.websiteUrl ? (
                <a href={h.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-full bg-accent-500 px-6 font-bold text-brand-950 transition-colors hover:bg-accent-400">
                  <ExternalLink className="size-4" aria-hidden="true" /> {t.detail.website}
                </a>
              ) : null}
              {h.mapsUrl ? (
                <a href={h.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/40 px-6 font-bold text-white transition-colors hover:bg-white/10">
                  <MapPinned className="size-4" aria-hidden="true" /> {t.detail.map}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <Reveal className="container-site grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-8">
          {h.description ? (
            <section aria-labelledby="hotel-about">
              <h2 id="hotel-about" data-reveal className="text-2xl font-extrabold text-brand-950">
                {t.hotel.about}
              </h2>
              <p data-reveal className="mt-4 text-[1.05rem] leading-[2.05] whitespace-pre-line text-ink/90">
                {h.description}
              </p>
            </section>
          ) : null}
          {h.rooms ? (
            <section aria-labelledby="hotel-rooms" data-reveal className="rounded-[1.5rem] bg-white p-6 ring-1 ring-brand-950/5">
              <h2 id="hotel-rooms" className="text-lg font-extrabold text-brand-950">
                {t.hotel.rooms}
              </h2>
              <p className="mt-3 leading-[2] whitespace-pre-line text-ink/85">{h.rooms}</p>
            </section>
          ) : null}
          {h.address ? (
            <p data-reveal className="flex items-start gap-2 text-muted">
              <MapPin className="mt-1 size-4 shrink-0 text-brand-500" aria-hidden="true" />
              <span>
                <span className="font-bold text-brand-950">{t.hotel.address}: </span>
                {h.address}
              </span>
            </p>
          ) : null}
        </div>
        {rest.length ? (
          <ul role="list" className="grid auto-rows-[10rem] grid-cols-2 gap-3 content-start">
            {rest.slice(0, 6).map((m, i) => (
              <li key={m.id} data-reveal className={`overflow-hidden rounded-2xl bg-brand-100 ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
                <MediaImage media={m} alt={`${h.name} — ${i + 2}`} sizes="(min-width: 1024px) 28rem, 92vw" className="h-full w-full object-cover" />
              </li>
            ))}
          </ul>
        ) : null}
      </Reveal>

      {programs.length ? (
        <Reveal as="section" aria-labelledby="hotel-programs" className="border-t border-line bg-white py-16">
          <div className="container-site">
            <h2 id="hotel-programs" data-reveal className="text-2xl font-extrabold text-brand-950 sm:text-3xl">
              {t.hotel.inPrograms}
            </h2>
            <ul role="list" className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {programs.map((c) => (
                <li key={c.id} data-reveal className="flex">
                  <OfferCard card={c} locale={locale} />
                </li>
              ))}
            </ul>
            <a href={asset(localePath(locale, "/programs/"))} className="mt-8 inline-flex font-bold text-brand-700 hover:underline">
              {t.hotel.back}
            </a>
          </div>
        </Reveal>
      ) : null}
    </TravelShell>
  );
}

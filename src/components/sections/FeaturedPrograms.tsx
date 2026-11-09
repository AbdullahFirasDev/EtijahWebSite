"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OfferCard } from "@/components/travel/OfferCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Locale } from "@/content/site";
import { localePath, travel } from "@/content/travel";
import { asset } from "@/lib/asset";
import type { ProgramCard } from "@/server/repo/programs";

/**
 * Home page strip of published offers. The home page itself stays fully static; the offers
 * are fetched in the browser, so they are always current and the page never depends on the
 * database. Renders nothing until offers are published (or if the request fails).
 */
export function FeaturedPrograms({ locale }: { locale: Locale }) {
  const [cards, setCards] = useState<ProgramCard[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(asset(`/api/programs/featured/?locale=${locale}`), { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ cards: ProgramCard[] }>) : { cards: [] }))
      .then((data) => setCards(data.cards ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [locale]);

  if (!cards.length) return null;
  const t = travel[locale].featured;
  return (
    <section id="offers" aria-labelledby="offers-title" className="bg-mist py-24 motion-safe:animate-[hero-fade_1s_var(--ease-out-expo)_both] sm:py-32">
      <div className="container-site">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading id="offers-title" eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
          <Link href={localePath(locale, "/programs/")} prefetch={false} className="group inline-flex h-12 items-center gap-2 rounded-full bg-brand-600 px-6 font-bold text-white transition-colors hover:bg-brand-700">
            {t.all}
            <ArrowLeft className="size-4 transition-transform ltr:-scale-x-100 motion-safe:rtl:group-hover:-translate-x-1" aria-hidden="true" />
          </Link>
        </div>
        <ul role="list" className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <li key={c.id} className="flex">
              <OfferCard card={c} locale={locale} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

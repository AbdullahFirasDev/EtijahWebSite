import { CalendarDays, Check, ChevronLeft, Clock3, MapPin, ShieldCheck, Sparkles, UsersRound, UtensilsCrossed, X, BedDouble, Headset } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { WhatsAppIcon } from "@/components/ui/icons";
import { site, whatsappUrl, type Locale } from "@/content/site";
import { localePath, travel } from "@/content/travel";
import { asset } from "@/lib/asset";
import { dayParts, daysBetween, formatDay } from "@/lib/dates";
import { CURRENCIES, formatAmount, formatMoney, type CurrencyCode } from "@/lib/money";
import { BOARD_LABELS, DEPARTURE_STATUS_LABELS } from "@/lib/travel-labels";
import type { ProgramCard, ProgramDetail } from "@/server/repo/programs";
import { ItineraryProgress, ViewTracker } from "./ClientBits";
import { HotelCard } from "./HotelCard";
import { MediaImage } from "./MediaImage";
import { OfferCard } from "./OfferCard";
import { RequestButton, TripRequestProvider, type RequestProgram } from "./TripRequest";

function Section({ id, title, children, className = "" }: { id: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-28 ${className}`}>
      <h2 id={`${id}-title`} data-reveal className="flex items-center gap-3 text-2xl font-extrabold text-brand-950 sm:text-[1.75rem]">
        <span aria-hidden="true" className="h-7 w-1.5 rounded-full bg-accent-500" />
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

const ctaPrimary =
  "inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-accent-500 px-7 text-[1.05rem] font-bold text-brand-950 transition-[background-color,box-shadow,transform] duration-300 hover:bg-accent-400 hover:shadow-glow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export function ProgramDetailView({ p, locale, related, preview, initialDeparture }: { p: ProgramDetail; locale: Locale; related: ProgramCard[]; preview?: boolean; initialDeparture?: number | null }) {
  const t = travel[locale];
  const d = t.detail;
  const currencyLabel = CURRENCIES[p.currency as CurrencyCode]?.[locale] ?? p.currency;
  const next = p.nextDeparture;
  const requestProgram: RequestProgram = {
    id: p.id,
    title: p.title,
    kind: p.kind,
    cover: p.cover,
    departures: p.departures.map((x) => ({
      id: x.id,
      label: `${formatDay(x.departDate, locale, { day: "numeric", month: "long" })} — ${formatDay(x.returnDate, locale)}`,
      sub: `${t.card.days(daysBetween(x.departDate, x.returnDate) + 1)}${x.price != null ? ` · ${formatMoney(x.price, p.currency, locale)}` : ""}`,
      seatsLeft: x.seatsLeft,
      bookable: x.bookable,
      seatsText: x.soldOut ? t.card.soldOut : x.bookable ? t.card.seatsLeft(x.seatsLeft) : DEPARTURE_STATUS_LABELS[x.status][locale],
    })),
  };
  const ask = whatsappUrl(locale === "ar" ? `مرحباً، أرغب بالاستفسار عن عرض «${p.title}».` : `Hello, I'd like to ask about the "${p.title}" offer.`);
  const bookDisabled = preview;

  const priceBlock = p.priceFrom != null ? (
    <div>
      <p className="text-sm font-bold text-muted">{t.card.from}</p>
      <p className="mt-1 flex items-baseline gap-1.5 text-brand-700">
        <span className="num text-[2.6rem] leading-none font-black">{formatAmount(p.priceFrom)}</span>
        <span className="text-lg font-extrabold">{currencyLabel}</span>
      </p>
      {p.priceNote ? <p className="mt-1.5 text-sm text-muted">{p.priceNote}</p> : null}
    </div>
  ) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: p.title,
    description: p.summary ?? p.description ?? undefined,
    ...(site.url ? { url: `${site.url}${localePath(locale, `/programs/${p.slug}/`)}` } : {}),
    touristType: p.kind === "group" ? "Group" : undefined,
    itinerary: { "@type": "ItemList", numberOfItems: p.itinerary.length, itemListElement: p.itinerary.map((x) => ({ "@type": "ListItem", position: x.day, name: x.title })) },
    provider: { "@type": "TravelAgency", name: locale === "ar" ? site.nameAr : site.nameEn, telephone: site.phone.e164 },
    ...(p.priceFrom != null
      ? {
          offers: {
            "@type": "Offer",
            price: (p.priceFrom / 100).toFixed(2),
            priceCurrency: p.currency,
            availability: p.kind === "group" && !p.departures.some((x) => x.bookable) ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
          },
        }
      : {}),
  };

  return (
    <TripRequestProvider program={requestProgram} locale={locale} initialDeparture={initialDeparture}>
      {preview ? null : <ViewTracker programId={p.id} />}

      {/* Hero */}
      <section id="top" aria-labelledby="program-title" className="surface-dark relative isolate flex min-h-[74svh] items-end overflow-hidden bg-brand-950 sm:min-h-[80svh]">
        {p.cover ? (
          <div className="absolute inset-0 -z-10" data-hero-image>
            <MediaImage media={p.cover} alt="" priority sizes="100vw" max={1600} className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-brand-950 via-brand-950/55 to-brand-950/30" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-brand-950/70 to-transparent" />
        <div className="container-site pt-36 pb-14 sm:pb-20">
          <nav aria-label={d.breadcrumbs} data-hero-fade>
            <ol className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-white/70">
              <li>
                <a href={asset(locale === "ar" ? "/" : "/en/")} className="hover:text-white">
                  {t.nav.home}
                </a>
              </li>
              <li aria-hidden="true">
                <ChevronLeft className="size-4 ltr:-scale-x-100" />
              </li>
              <li>
                <Link href={localePath(locale, "/programs/")} prefetch={false} className="hover:text-white">
                  {t.nav.programs}
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronLeft className="size-4 ltr:-scale-x-100" />
              </li>
              <li aria-current="page" className="line-clamp-1 max-w-[16rem] text-white">
                {p.title}
              </li>
            </ol>
          </nav>
          <div data-hero-fade style={{ ["--delay" as string]: "80ms" }} className="mt-6 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3.5 py-1.5 text-sm font-extrabold ${p.kind === "group" ? "bg-accent-500 text-brand-950" : "bg-white text-brand-950"}`}>{p.kind === "group" ? t.card.group : t.card.package}</span>
            {p.countries.map((c) => (
              <span key={c.code} className="rounded-full bg-white/12 px-3.5 py-1.5 text-sm font-bold text-white ring-1 ring-white/20 backdrop-blur-md">
                {c.name}
              </span>
            ))}
            {p.featured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-950/50 px-3 py-1.5 text-sm font-bold text-accent-300 ring-1 ring-accent-400/30 backdrop-blur-md">
                <Sparkles className="size-4" aria-hidden="true" /> {t.card.featured}
              </span>
            ) : null}
          </div>
          <h1 id="program-title" data-hero-fade style={{ ["--delay" as string]: "140ms" }} className="mt-5 max-w-4xl text-[2.3rem] leading-[1.2] font-black text-balance text-white sm:text-[3.4rem] lg:text-[4.1rem]">
            {p.title}
          </h1>
          {p.summary ? (
            <p data-hero-fade style={{ ["--delay" as string]: "200ms" }} className="mt-5 max-w-2xl text-[1.05rem] leading-[1.95] text-white/85 sm:text-lg">
              {p.summary}
            </p>
          ) : null}
          <ul data-hero-fade style={{ ["--delay" as string]: "260ms" }} role="list" className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-[0.95rem] font-bold text-white">
            <li className="inline-flex items-center gap-2">
              <Clock3 className="size-5 text-accent-400" aria-hidden="true" /> {t.card.days(p.days)} · {t.card.nights(p.nights)}
            </li>
            <li className="inline-flex items-center gap-2">
              <MapPin className="size-5 text-accent-400" aria-hidden="true" /> {p.places.join(locale === "ar" ? "، " : ", ")}
            </li>
            <li className="inline-flex items-center gap-2">
              <CalendarDays className="size-5 text-accent-400" aria-hidden="true" />
              {next ? `${d.depart}: ${formatDay(next.departDate, locale)}` : t.card.flexible}
            </li>
          </ul>
        </div>
      </section>

      <div className="container-site grid gap-10 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-14">
        <Reveal className="grid min-w-0 content-start gap-16 sm:gap-20">
          {/* Overview */}
          <Section id="overview" title={d.overview}>
            {p.description ? <p data-reveal className="text-[1.05rem] leading-[2.05] whitespace-pre-line text-ink/90">{p.description}</p> : null}
            <dl data-reveal className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: <Clock3 className="size-5" />, label: d.duration, value: `${t.card.days(p.days)}` },
                { icon: <MapPin className="size-5" />, label: d.destinations, value: p.places.join(locale === "ar" ? "، " : ", ") },
                { icon: <BedDouble className="size-5" />, label: d.hotelsCount, value: p.hotels.length ? String(p.hotels.length) : "—" },
                { icon: <UtensilsCrossed className="size-5" />, label: d.meals, value: p.meals ?? ([...new Set(p.hotels.map((h) => h.board).filter((b): b is NonNullable<typeof b> => !!b))].map((b) => BOARD_LABELS[b][locale]).join(" · ") || "—") },
              ].map((x) => (
                <div key={x.label} className="rounded-2xl bg-white p-4 ring-1 ring-brand-950/5">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600" aria-hidden="true">
                    {x.icon}
                  </span>
                  <dt className="mt-3 text-xs font-bold text-muted">{x.label}</dt>
                  <dd className="mt-0.5 line-clamp-3 text-[0.95rem] font-extrabold text-brand-950">{x.value}</dd>
                </div>
              ))}
            </dl>
          </Section>

          {/* Gallery */}
          {p.gallery.length ? (
            <Section id="gallery" title={d.gallery}>
              <ul role="list" className={`grid gap-3 ${p.gallery.length >= 3 ? "auto-rows-[9rem] grid-cols-2 sm:auto-rows-[11rem] sm:grid-cols-4" : p.gallery.length === 2 ? "auto-rows-[14rem] sm:grid-cols-2 sm:auto-rows-[18rem]" : "auto-rows-[18rem] sm:auto-rows-[24rem]"}`}>
                {p.gallery.slice(0, 7).map((m, i) => (
                  <li key={m.id} data-reveal className={`overflow-hidden rounded-2xl bg-brand-100 ${i === 0 && p.gallery.length >= 3 ? "col-span-2 row-span-2" : ""}`}>
                    <MediaImage media={m} alt={`${p.title} — ${i + 1}`} sizes={i === 0 ? "(min-width: 1024px) 40rem, 92vw" : "(min-width: 1024px) 20rem, 46vw"} className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out-expo hover:scale-105" />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Itinerary */}
          {p.itinerary.length ? (
            <Section id="itinerary" title={d.itinerary}>
              <ol id="itinerary-list" className="relative grid gap-5">
                <span aria-hidden="true" className="absolute inset-y-2 start-[1.2rem] w-0.5 rounded-full bg-brand-100" />
                <ItineraryProgress targetId="itinerary-list" />
                {p.itinerary.map((x) => (
                  <li key={x.day} data-reveal className="relative flex gap-5">
                    <span className="num relative z-10 grid size-10 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-black text-white ring-4 ring-mist">{x.day}</span>
                    <div className="min-w-0 flex-1 rounded-2xl bg-white p-5 ring-1 ring-brand-950/5">
                      <p className="text-xs font-bold text-accent-700">
                        {d.day} <span className="num">{x.day}</span>
                      </p>
                      <h3 className="mt-1 text-lg font-extrabold text-brand-950">{x.title}</h3>
                      {x.body ? <p className="mt-2 leading-[1.95] whitespace-pre-line text-ink/85">{x.body}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          {/* Hotels */}
          {p.hotels.length ? (
            <Section id="hotels" title={d.hotels}>
              <ul role="list" className="grid gap-5 sm:grid-cols-2">
                {p.hotels.map((h, i) => (
                  <li key={`${h.id}-${i}`} data-reveal className="flex">
                    <HotelCard hotel={h} locale={locale} />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Included / excluded */}
          {p.included.length || p.excluded.length ? (
            <Section id="included" title={d.included}>
              <div className="grid gap-5 md:grid-cols-2">
                {p.included.length ? (
                  <ul role="list" aria-label={d.included} data-reveal className="grid content-start gap-3 rounded-[1.5rem] bg-white p-6 ring-1 ring-brand-950/5">
                    {p.included.map((s) => (
                      <li key={s.name} className="flex items-start gap-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                          <Check className="size-4" aria-hidden="true" strokeWidth={2.5} />
                        </span>
                        <span>
                          <span className="font-bold text-brand-950">{s.name}</span>
                          {s.note ? <span className="block text-sm text-muted">{s.note}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {p.excluded.length ? (
                  <div data-reveal className="rounded-[1.5rem] bg-white p-6 ring-1 ring-brand-950/5">
                    <p className="mb-3 text-sm font-extrabold text-muted">{d.excluded}</p>
                    <ul role="list" aria-label={d.excluded} className="grid gap-3">
                      {p.excluded.map((s) => (
                        <li key={s.name} className="flex items-start gap-3">
                          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-100 text-accent-700">
                            <X className="size-4" aria-hidden="true" strokeWidth={2.5} />
                          </span>
                          <span>
                            <span className="font-bold text-brand-950">{s.name}</span>
                            {s.note ? <span className="block text-sm text-muted">{s.note}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Section>
          ) : null}

          {/* Departures */}
          {p.departures.length || p.kind === "group" ? (
            <Section id="departures" title={d.departures}>
              <p data-reveal className="-mt-2 mb-5 text-muted">{p.departures.length ? d.departuresLead : d.noDates}</p>
              <ul role="list" className="grid gap-3">
                {p.departures.map((x) => {
                  const a = dayParts(x.departDate, locale);
                  const used = x.seatsTotal - x.seatsLeft;
                  return (
                    <li key={x.id} data-reveal className={`grid items-center gap-4 rounded-[1.5rem] bg-white p-4 ring-1 sm:grid-cols-[auto_1fr_auto] sm:p-5 ${initialDeparture === x.id ? "ring-2 ring-accent-500" : "ring-brand-950/5"}`}>
                      <div className="flex items-center gap-4">
                        <div className="grid w-16 shrink-0 place-items-center rounded-2xl bg-brand-950 py-2.5 text-white">
                          <span className="num text-2xl leading-none font-black">{a.day}</span>
                          <span className="mt-0.5 text-xs font-bold text-accent-300">{a.month}</span>
                        </div>
                        <div className="sm:hidden">
                          <p className="font-extrabold text-brand-950">{formatDay(x.departDate, locale)}</p>
                          <p className="text-sm text-muted">→ {formatDay(x.returnDate, locale)}</p>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="hidden font-extrabold text-brand-950 sm:block">
                          {formatDay(x.departDate, locale)} <span className="font-normal text-muted">→ {formatDay(x.returnDate, locale)}</span>
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span className={`inline-flex items-center gap-1.5 font-bold ${x.soldOut ? "text-muted" : x.seatsLeft <= 8 ? "text-accent-700" : "text-brand-700"}`}>
                            <UsersRound className="size-4" aria-hidden="true" /> {x.soldOut ? t.card.soldOut : x.bookable ? t.card.seatsLeft(x.seatsLeft) : DEPARTURE_STATUS_LABELS[x.status][locale]}
                          </span>
                          {x.status === "guaranteed" ? (
                            <span className="inline-flex items-center gap-1 font-bold text-brand-700">
                              <ShieldCheck className="size-4" aria-hidden="true" /> {d.guaranteed}
                            </span>
                          ) : null}
                          {x.price != null ? <span className="num font-black text-brand-900">{formatMoney(x.price, p.currency, locale)}</span> : null}
                        </div>
                        <div className="mt-2.5 h-1.5 max-w-xs overflow-hidden rounded-full bg-mist" aria-hidden="true">
                          <div className={`h-full rounded-full ${x.seatsLeft <= 8 ? "bg-accent-500" : "bg-brand-500"}`} style={{ width: `${Math.min(100, (used / Math.max(1, x.seatsTotal)) * 100)}%` }} />
                        </div>
                        {x.note ? <p className="mt-2 text-sm text-muted">{x.note}</p> : null}
                      </div>
                      <RequestButton
                        departureId={x.id}
                        disabled={!x.bookable || bookDisabled}
                        className="inline-flex h-11 items-center justify-center rounded-full border-2 border-brand-600 px-5 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-600 hover:text-white disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:hover:bg-transparent"
                      >
                        {d.choose}
                      </RequestButton>
                    </li>
                  );
                })}
              </ul>
            </Section>
          ) : null}

          {/* Prices */}
          {p.prices.length > 1 ? (
            <Section id="prices" title={d.prices}>
              <dl data-reveal className="divide-y divide-line overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-brand-950/5">
                {p.prices.map((x) => (
                  <div key={x.label} className="flex items-center justify-between gap-4 px-5 py-4">
                    <dt className="font-bold text-brand-950">{x.label}</dt>
                    <dd className="num text-lg font-black text-brand-700">{formatMoney(x.amount, p.currency, locale)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-sm text-muted">{d.priceNote}</p>
            </Section>
          ) : null}

          {/* Terms */}
          {p.terms ? (
            <Section id="terms" title={d.terms}>
              <div data-reveal className="rounded-[1.5rem] bg-white p-6 leading-[2] whitespace-pre-line text-ink/85 ring-1 ring-brand-950/5">{p.terms}</div>
            </Section>
          ) : null}
        </Reveal>

        {/* Booking card */}
        <aside className="hidden lg:block">
          <div className="sticky top-28 grid gap-4">
            <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_30px_70px_-40px_rgb(5_28_51/0.6)] ring-1 ring-brand-950/5">
              {priceBlock}
              {p.prices.length > 1 ? (
                <ul role="list" className="mt-4 grid gap-1.5 border-t border-line pt-4 text-sm">
                  {p.prices.slice(0, 4).map((x) => (
                    <li key={x.label} className="flex justify-between gap-3">
                      <span className="text-muted">{x.label}</span>
                      <span className="num font-bold text-brand-950">{formatMoney(x.amount, p.currency, locale)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-5 rounded-2xl bg-mist p-4 text-sm">
                <p className="font-bold text-muted">{t.card.nextDeparture}</p>
                <p className="mt-1 font-extrabold text-brand-950">{next ? formatDay(next.departDate, locale) : t.card.flexible}</p>
                {next ? <p className={`mt-0.5 font-bold ${next.seatsLeft <= 8 ? "text-accent-700" : "text-brand-700"}`}>{next.soldOut ? t.card.soldOut : t.card.seatsLeft(next.seatsLeft)}</p> : null}
              </div>
              <RequestButton className={`${ctaPrimary} mt-5`} disabled={bookDisabled}>
                {d.book}
              </RequestButton>
              <a href={ask} target="_blank" rel="noopener noreferrer" className="mt-2.5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line font-bold text-brand-900 transition-colors hover:border-brand-300 hover:bg-brand-50">
                <WhatsAppIcon className="size-5 text-[#1fa855]" /> {d.ask}
              </a>
            </div>
            <ul role="list" className="grid gap-2.5 rounded-[1.5rem] bg-white/70 p-5 text-sm text-ink/80 ring-1 ring-brand-950/5">
              {(locale === "ar"
                ? ["رد سريع من مستشار سفر مختص", "إرسال الطلب لا يُلزمك بالدفع", "متابعة شخصية حتى تأكيد الحجز"]
                : ["Quick reply from a travel consultant", "Sending a request doesn't commit you to pay", "Personal follow-up until your booking is confirmed"]
              ).map((x) => (
                <li key={x} className="flex items-center gap-2.5">
                  <Headset className="size-4 shrink-0 text-brand-500" aria-hidden="true" /> {x}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* Related */}
      {related.length ? (
        <Reveal as="section" aria-labelledby="related-title" className="border-t border-line bg-white py-16 sm:py-20">
          <div className="container-site">
            <h2 id="related-title" data-reveal className="text-2xl font-extrabold text-brand-950 sm:text-3xl">
              {d.related}
            </h2>
            <ul role="list" className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {related.map((c) => (
                <li key={c.id} data-reveal className="flex">
                  <OfferCard card={c} locale={locale} />
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      ) : null}

      {/* Mobile booking bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_30px_-18px_rgb(5_28_51/0.45)] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {p.priceFrom != null ? (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-muted">{t.card.from}</p>
              <p className="num truncate text-xl leading-tight font-black text-brand-700">
                {formatAmount(p.priceFrom)} <span className="text-sm">{currencyLabel}</span>
              </p>
            </div>
          ) : null}
          <a href={ask} target="_blank" rel="noopener noreferrer" aria-label={d.ask} className="grid size-12 shrink-0 place-items-center rounded-full border border-line text-[#1fa855]">
            <WhatsAppIcon className="size-6" />
          </a>
          <RequestButton disabled={bookDisabled} className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-accent-500 px-6 font-bold text-brand-950 active:scale-[0.98] disabled:opacity-50">
            {d.book}
          </RequestButton>
        </div>
      </div>
      <div className="h-20 lg:hidden" aria-hidden="true" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </TripRequestProvider>
  );
}

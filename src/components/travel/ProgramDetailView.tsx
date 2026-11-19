import { BedDouble, CalendarDays, Check, ChevronLeft, Clock3, ExternalLink, FileDown, Headset, MapPin, Plane, PlaneTakeoff, ShieldCheck, Sparkles, Star, UsersRound, UtensilsCrossed, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { WhatsAppIcon } from "@/components/ui/icons";
import { site, whatsappUrl, type Locale } from "@/content/site";
import { localePath, travel } from "@/content/travel";
import { asset } from "@/lib/asset";
import { dayParts, daysBetween, formatDay } from "@/lib/dates";
import { CURRENCIES, formatAmount, formatMoney, type CurrencyCode } from "@/lib/money";
import { BOARD_LABELS, DEPARTURE_STATUS_LABELS, RATE_BASIS_LABELS } from "@/lib/travel-labels";
import type { HotelChoice, ProgramCard, ProgramDetail } from "@/server/repo/programs";
import { ItineraryProgress, ViewTracker } from "./ClientBits";
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

/** Side-by-side hotel options of one program: same trip, different hotel, clear total per person. */
function HotelChoices({ choices, locale, currency, custom, disabled }: { choices: HotelChoice[]; locale: Locale; currency: string; custom: boolean; disabled?: boolean }) {
  const d = travel[locale].detail;
  const money = (n: number) => formatMoney(n, currency, locale);
  const cheapest = custom ? null : choices.reduce<HotelChoice | null>((m, c) => (c.pricePerPerson != null && (!m || c.pricePerPerson < (m.pricePerPerson ?? Infinity)) ? c : m), null);
  return (
    <ul role="list" className={`grid gap-5 ${choices.length > 1 ? "md:grid-cols-2" : ""} ${choices.length > 2 ? "xl:grid-cols-3" : ""}`} data-hotel-choices>
      {choices.map((c) => {
        const link = c.hotel.websiteUrl || c.hotel.mapsUrl;
        return (
          <li key={c.id} data-reveal className={`relative flex flex-col overflow-hidden rounded-[1.5rem] bg-white ring-1 ${cheapest?.id === c.id && choices.length > 1 ? "ring-2 ring-accent-500" : "ring-brand-950/5"}`} data-hotel-choice={c.id}>
            {cheapest?.id === c.id && choices.length > 1 ? <span className="absolute top-3 start-3 z-10 rounded-full bg-accent-500 px-3 py-1 text-xs font-extrabold text-brand-950">{d.cheapest}</span> : null}
            <div className="aspect-[16/10] bg-brand-100">
              {c.hotel.images[0] ? <MediaImage media={c.hotel.images[0]} alt={c.hotel.name} sizes="(min-width: 1024px) 24rem, 92vw" className="h-full w-full object-cover" /> : (
                <div className="grid h-full place-items-center text-brand-300"><BedDouble className="size-10" aria-hidden="true" /></div>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold text-brand-950">
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-brand-600 hover:underline">
                        {c.hotel.name} <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                      </a>
                    ) : (
                      c.hotel.name
                    )}
                  </h3>
                  <p className="text-sm text-muted">
                    {c.hotel.city}، {c.hotel.country}
                  </p>
                </div>
                {c.hotel.stars ? (
                  <span className="inline-flex shrink-0 text-accent-500" aria-label={d.stars(c.hotel.stars)}>
                    {Array.from({ length: c.hotel.stars }, (_, i) => (
                      <Star key={i} className="size-4 fill-current" aria-hidden="true" />
                    ))}
                  </span>
                ) : null}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {c.room ? (
                  <div className="col-span-2">
                    <dt className="text-xs font-bold text-muted">{d.room}</dt>
                    <dd className="font-bold text-brand-950">{c.room}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs font-bold text-muted">{d.roomFor}</dt>
                  <dd className="font-bold text-brand-950">{d.persons(c.occupancy)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-muted">{d.board}</dt>
                  <dd className="font-bold text-brand-950">{c.board ? BOARD_LABELS[c.board][locale] : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-muted">{travel[locale].request.nights}</dt>
                  <dd className="font-bold text-brand-950">{d.nightsAt(c.nights)}</dd>
                </div>
                {c.nightPrice != null ? (
                  <div>
                    <dt className="text-xs font-bold text-muted">{d.nightPrice}</dt>
                    <dd className="num font-bold text-brand-950">
                      {money(c.nightPrice)} <span className="text-xs font-semibold text-muted">{RATE_BASIS_LABELS[c.basis][locale]}</span>
                    </dd>
                  </div>
                ) : null}
                {c.hotelPerPerson != null ? (
                  <div className="col-span-2">
                    <dt className="text-xs font-bold text-muted">{d.stay}</dt>
                    <dd className="num font-bold text-brand-950">{money(c.hotelPerPerson)}</dd>
                  </div>
                ) : null}
              </dl>
              {c.note ? <p className="mt-3 text-sm text-muted">{c.note}</p> : null}
              <div className="mt-auto pt-5">
                {c.pricePerPerson != null ? (
                  <div className="mb-3 rounded-2xl bg-brand-50 px-4 py-3">
                    <p className="text-xs font-bold text-muted">{d.totalPerPerson}</p>
                    <p className="num text-2xl font-black text-brand-700" data-option-price>
                      {money(c.pricePerPerson)}
                    </p>
                  </div>
                ) : null}
                <RequestButton hotelOptionId={custom ? undefined : c.id} disabled={disabled} className="inline-flex h-11 w-full items-center justify-center rounded-full border-2 border-brand-600 px-5 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-600 hover:text-white disabled:opacity-50">
                  {custom ? d.customCta : d.chooseHotel}
                </RequestButton>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ProgramDetailView({ p, locale, related, preview, initialDeparture, pdfHref }: { p: ProgramDetail; locale: Locale; related: ProgramCard[]; preview?: boolean; initialDeparture?: number | null; pdfHref?: string | null }) {
  const t = travel[locale];
  const d = t.detail;
  const currencyLabel = CURRENCIES[p.currency as CurrencyCode]?.[locale] ?? p.currency;
  const next = p.nextDeparture;
  const custom = p.type === "custom";
  const money = (n: number) => formatMoney(n, p.currency, locale);
  const requestProgram: RequestProgram = {
    id: p.id,
    title: p.title,
    type: p.type,
    cover: p.cover,
    currency: p.currency,
    countries: p.countries,
    services: [...p.included, ...p.excluded].map((s) => s.name),
    hotels: p.hotelChoices.map((c) => ({
      id: c.id,
      label: c.hotel.name,
      stars: c.hotel.stars,
      sub: [c.room, d.persons(c.occupancy), c.board ? BOARD_LABELS[c.board][locale] : null].filter(Boolean).join(" · "),
      price: c.pricePerPerson != null ? money(c.pricePerPerson) : null,
    })),
    departures: p.departures.map((x) => ({
      id: x.id,
      label: `${formatDay(x.departDate, locale, { day: "numeric", month: "long" })} — ${formatDay(x.returnDate, locale)}`,
      sub: `${t.card.days(daysBetween(x.departDate, x.returnDate) + 1)}${x.priceSupplement ? ` · ${x.priceSupplement > 0 ? "+" : "−"}${money(Math.abs(x.priceSupplement))}` : ""}`,
      seatsLeft: x.seatsLeft,
      bookable: x.bookable,
      seatsText: x.soldOut ? t.card.soldOut : x.bookable ? t.card.seatsLeft(x.seatsLeft) : DEPARTURE_STATUS_LABELS[x.status][locale],
    })),
  };
  const ask = whatsappUrl(locale === "ar" ? `مرحباً، أرغب بالاستفسار عن عرض «${p.title}».` : `Hello, I'd like to ask about the "${p.title}" offer.`);
  const bookDisabled = preview;

  const priceBlock = custom ? (
    <div>
      <p className="text-sm font-bold text-muted">{t.card.custom}</p>
      <p className="mt-1 text-2xl font-black text-brand-700">{t.card.onRequest}</p>
      <p className="mt-1.5 text-sm leading-[1.8] text-muted">{d.customLead}</p>
    </div>
  ) : p.priceFrom != null ? (
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
    touristType: p.type === "fixed" ? "Group" : undefined,
    itinerary: { "@type": "ItemList", numberOfItems: p.itinerary.length, itemListElement: p.itinerary.map((x) => ({ "@type": "ListItem", position: x.day, name: x.title })) },
    provider: { "@type": "TravelAgency", name: locale === "ar" ? site.nameAr : site.nameEn, telephone: site.phone.e164 },
    ...(p.priceFrom != null && !custom
      ? {
          offers: {
            "@type": "Offer",
            price: (p.priceFrom / 100).toFixed(2),
            priceCurrency: p.currency,
            availability: p.type === "fixed" && !p.departures.some((x) => x.bookable) ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
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
            <span className={`rounded-full px-3.5 py-1.5 text-sm font-extrabold ${custom ? "bg-white text-brand-950" : "bg-accent-500 text-brand-950"}`}>{custom ? t.card.custom : t.card.fixed}</span>
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
            {p.departureAirport ? (
              <li className="inline-flex items-center gap-2">
                <PlaneTakeoff className="size-5 text-accent-400" aria-hidden="true" /> {p.departureAirport}
              </li>
            ) : null}
            {p.airlines.length ? (
              <li className="inline-flex items-center gap-2">
                <Plane className="size-5 text-accent-400" aria-hidden="true" /> {p.airlines.map((a) => a.name).join(locale === "ar" ? "، " : ", ")}
              </li>
            ) : null}
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
                { icon: <BedDouble className="size-5" />, label: d.hotelsCount, value: p.hotelChoices.length ? String(p.hotelChoices.length) : "—" },
                { icon: <UtensilsCrossed className="size-5" />, label: d.meals, value: p.meals ?? ([...new Set(p.hotelChoices.map((h) => h.board).filter((b): b is NonNullable<typeof b> => !!b))].map((b) => BOARD_LABELS[b][locale]).join(" · ") || "—") },
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
            {p.flights.length ? (
              <div data-reveal className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-brand-950/5">
                <p className="mb-3 flex items-center gap-2 font-extrabold text-brand-950">
                  <Plane className="size-5 text-brand-600" aria-hidden="true" /> {d.flights}
                </p>
                <ul role="list" className="grid gap-2 text-sm">
                  {p.flights.map((f, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">{d.flightDir[f.direction]}</span>
                      {f.airline ? <span className="font-bold text-brand-950">{f.airline}</span> : null}
                      {f.flightNo ? <span className="num text-muted" dir="ltr">{f.flightNo}</span> : null}
                      {f.from || f.to ? <span>{f.from} ← {f.to}</span> : null}
                      {f.departTime ? <span className="num text-muted" dir="ltr">{f.departTime}{f.arriveTime ? ` – ${f.arriveTime}` : ""}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>

          {/* Hotel options (comparison) */}
          {p.hotelChoices.length ? (
            <Section id="hotels" title={custom ? d.hotelSuggestions : d.hotelOptions}>
              <p data-reveal className="-mt-2 mb-5 text-muted">{custom ? d.hotelSuggestionsLead : d.hotelOptionsLead}</p>
              <HotelChoices choices={p.hotelChoices} locale={locale} currency={p.currency} custom={custom} disabled={preview} />
            </Section>
          ) : null}

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
          {!custom ? (
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
                          {x.priceSupplement ? <span className="num font-bold text-brand-900">{d.supplement(`${x.priceSupplement > 0 ? "+" : "−"}${money(Math.abs(x.priceSupplement))}`)}</span> : null}
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

          {/* Extra prices (child, single supplement…) */}
          {p.extraPrices.length ? (
            <Section id="prices" title={d.extraPrices}>
              <dl data-reveal className="divide-y divide-line overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-brand-950/5">
                {p.extraPrices.map((x) => (
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
              {p.hotelChoices.length > 1 && !custom ? (
                <ul role="list" className="mt-4 grid gap-1.5 border-t border-line pt-4 text-sm">
                  {p.hotelChoices.slice(0, 4).map((x) => (
                    <li key={x.id} className="flex justify-between gap-3">
                      <span className="truncate text-muted">{x.hotel.name}</span>
                      <span className="num shrink-0 font-bold text-brand-950">{x.pricePerPerson != null ? money(x.pricePerPerson) : "—"}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!custom ? (
                <div className="mt-5 rounded-2xl bg-mist p-4 text-sm">
                  <p className="font-bold text-muted">{t.card.nextDeparture}</p>
                  <p className="mt-1 font-extrabold text-brand-950">{next ? formatDay(next.departDate, locale) : t.card.flexible}</p>
                  {next ? <p className={`mt-0.5 font-bold ${next.seatsLeft <= 8 ? "text-accent-700" : "text-brand-700"}`}>{next.soldOut ? t.card.soldOut : t.card.seatsLeft(next.seatsLeft)}</p> : null}
                </div>
              ) : null}
              <RequestButton className={`${ctaPrimary} mt-5`} disabled={bookDisabled}>
                {custom ? d.customCta : d.book}
              </RequestButton>
              {pdfHref ? (
                <a href={pdfHref} className="mt-2.5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line font-bold text-brand-900 transition-colors hover:border-brand-300 hover:bg-brand-50" data-program-pdf>
                  <FileDown className="size-5 text-brand-600" aria-hidden="true" /> {d.pdf}
                </a>
              ) : null}
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
          {p.priceFrom != null && !custom ? (
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
            {custom ? d.customCta : d.book}
          </RequestButton>
        </div>
      </div>
      <div className="h-20 lg:hidden" aria-hidden="true" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </TripRequestProvider>
  );
}

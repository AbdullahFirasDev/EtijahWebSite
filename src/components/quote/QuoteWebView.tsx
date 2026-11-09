import { BedDouble, CalendarDays, Check, CircleAlert, Clock3, Download, Eye, MapPin, Moon, Phone, UsersRound, UtensilsCrossed, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { MediaImage } from "@/components/travel/MediaImage";
import { WhatsAppIcon } from "@/components/ui/icons";
import { quoteDict } from "@/content/quote";
import { site, telUrl, whatsappUrl } from "@/content/site";
import { asset } from "@/lib/asset";
import { daysBetween, formatDay, todayDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { QuoteView } from "@/server/repo/quotes";
import { QuoteRespond, QuoteViewBeacon } from "./QuoteClient";
import { boardText, datesText, HotelLinks, HotelName, PricingTable, StarsInline, travelersText } from "./shared";

export function QuoteWebView({ q, token, mode, editorHref }: { q: QuoteView; token: string; mode: "client" | "staff"; editorHref?: string }) {
  const t = quoteDict[q.locale];
  const m = (v: number) => formatMoney(v, q.currency, q.locale);
  const daysLeft = daysBetween(todayDay(), q.validUntil);
  const pdfHref = asset(`/q/${token}/pdf/`);
  const ask = whatsappUrl(q.locale === "ar" ? `مرحباً، بخصوص عرض السعر رقم ${q.ref} (${q.title}).` : `Hello, regarding quotation ${q.ref} (${q.title}).`);
  const options = q.items.filter((i) => i.kind === "option");
  const nights = q.startDate && q.endDate ? daysBetween(q.startDate, q.endDate) : null;

  const banner =
    q.status === "expired"
      ? { tone: "bg-accent-50 text-accent-700 ring-accent-200", icon: <CircleAlert className="size-5" />, text: t.expired(formatDay(q.validUntil, q.locale)) }
      : q.status === "accepted"
        ? { tone: "bg-[#e9f7ef] text-[#17663a] ring-[#c9ebd6]", icon: <Check className="size-5" />, text: t.acceptedBanner(q.responseName ?? "", formatDay(q.respondedAt?.slice(0, 10), q.locale)) }
        : q.status === "changes_requested"
          ? { tone: "bg-brand-50 text-brand-800 ring-brand-100", icon: <CircleAlert className="size-5" />, text: t.changesBanner }
          : q.status === "rejected"
            ? { tone: "bg-mist text-muted ring-line", icon: <X className="size-5" />, text: t.rejectedBanner }
            : null;

  return (
    <div className="min-h-svh bg-mist">
      {mode === "client" ? <QuoteViewBeacon token={token} /> : null}
      {mode === "staff" ? (
        <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-accent-500 px-4 py-2 text-sm font-bold text-brand-950">
          <Eye className="size-4" aria-hidden="true" /> {t.staffPreview}
          {editorHref ? (
            <a href={asset(editorHref)} className="underline">
              {t.backToEditor}
            </a>
          ) : null}
        </div>
      ) : null}

      <header className="border-b border-line bg-white">
        <div className="container-site flex items-center justify-between gap-4 py-4">
          <Logo locale={q.locale} idSuffix="quote" />
          <div className="text-end">
            <p className="text-xs font-bold text-muted">{t.ref}</p>
            <p className="num font-black text-brand-950" dir="ltr">
              {q.ref}
              {q.revision > 1 ? <span className="text-xs font-bold text-muted"> · {t.revision} {q.revision}</span> : null}
            </p>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="surface-dark relative isolate overflow-hidden bg-brand-950">
          {q.cover ? (
            <div className="absolute inset-0 -z-10">
              <MediaImage media={q.cover} alt="" priority sizes="100vw" max={1600} className="h-full w-full object-cover opacity-55" />
            </div>
          ) : null}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-brand-950 via-brand-950/70 to-brand-950/30" />
          <div className="container-site py-14 sm:py-20">
            <p className="text-sm font-bold text-accent-300">
              {t.docTitle} · {t.preparedFor}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-white sm:text-3xl" data-company-name>
              {q.company.name}
            </p>
            {q.contact ? (
              <p className="mt-1 text-white/70">
                {t.attention}: {q.contact.name}
                {q.contact.position ? ` — ${q.contact.position}` : ""}
              </p>
            ) : null}
            <h1 className="mt-8 max-w-4xl text-[2.1rem] leading-[1.25] font-black text-balance text-white sm:text-[3rem]">{q.title}</h1>
            <ul role="list" className="mt-7 flex flex-wrap gap-x-7 gap-y-3 font-bold text-white">
              {q.destination ? (
                <li className="inline-flex items-center gap-2">
                  <MapPin className="size-5 text-accent-400" aria-hidden="true" /> {q.destination}
                </li>
              ) : null}
              <li className="inline-flex items-center gap-2">
                <CalendarDays className="size-5 text-accent-400" aria-hidden="true" /> {datesText(q)}
                {nights ? <span className="font-normal text-white/70">({t.nights(nights)})</span> : null}
              </li>
              <li className="inline-flex items-center gap-2">
                <UsersRound className="size-5 text-accent-400" aria-hidden="true" /> {travelersText(q, t)}
              </li>
            </ul>
          </div>
        </section>

        <div className="container-site grid gap-8 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="grid min-w-0 content-start gap-8">
            {banner ? (
              <p role="status" className={`flex items-start gap-3 rounded-2xl p-4 font-bold ring-1 ${banner.tone}`}>
                <span className="mt-0.5 shrink-0" aria-hidden="true">
                  {banner.icon}
                </span>
                {banner.text}
              </p>
            ) : null}

            {q.intro ? (
              <section aria-labelledby="q-overview" className="rounded-[1.5rem] bg-white p-6 ring-1 ring-brand-950/5 sm:p-8">
                <h2 id="q-overview" className="text-xl font-extrabold text-brand-950">
                  {t.overview}
                </h2>
                <p className="mt-3 text-[1.02rem] leading-[2] whitespace-pre-line text-ink/90">{q.intro}</p>
              </section>
            ) : null}

            {q.days.length ? (
              <section aria-labelledby="q-itinerary" className="rounded-[1.5rem] bg-white p-6 ring-1 ring-brand-950/5 sm:p-8">
                <h2 id="q-itinerary" className="text-xl font-extrabold text-brand-950">
                  {t.itinerary}
                </h2>
                <ol className="relative mt-6 grid gap-5">
                  <span aria-hidden="true" className="absolute inset-y-2 start-[1.1rem] w-0.5 rounded-full bg-brand-100" />
                  {q.days.map((d) => (
                    <li key={d.day} className="relative flex gap-4">
                      <span className="num relative z-10 grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-black text-white ring-4 ring-white">{d.day}</span>
                      <div className="pt-1">
                        <h3 className="font-extrabold text-brand-950">{d.title}</h3>
                        {d.body ? <p className="mt-1 leading-[1.95] whitespace-pre-line text-ink/85">{d.body}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {q.hotels.length ? (
              <section aria-labelledby="q-hotels">
                <h2 id="q-hotels" className="text-xl font-extrabold text-brand-950">
                  {t.hotels}
                </h2>
                <ul role="list" className="mt-4 grid gap-4">
                  {q.hotels.map((h, i) => (
                    <li key={`${h.id}-${i}`} className="grid overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-brand-950/5 sm:grid-cols-[14rem_1fr]">
                      <div className="aspect-[16/10] bg-brand-100 sm:aspect-auto">
                        {h.images[0] ? <MediaImage media={h.images[0]} alt={h.name} sizes="(min-width: 640px) 14rem, 92vw" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <StarsInline n={h.stars} />
                          <span className="text-xs font-bold text-muted">
                            {h.city}، {h.country} · {t.nights(h.nights)}
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-lg font-extrabold">
                          <HotelName hotel={h} className="text-brand-950 underline decoration-brand-200 decoration-2 underline-offset-[6px] hover:text-brand-700 hover:decoration-accent-500" />
                        </h3>
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                          {[
                            { icon: <CalendarDays className="size-4" />, label: t.checkIn, value: h.checkIn ? formatDay(h.checkIn, q.locale) : "—" },
                            { icon: <Moon className="size-4" />, label: t.checkOut, value: h.checkOut ? formatDay(h.checkOut, q.locale) : "—" },
                            { icon: <BedDouble className="size-4" />, label: t.room, value: `${h.roomType ?? "—"}${h.roomsCount ? ` × ${h.roomsCount}` : ""}` },
                            { icon: <UtensilsCrossed className="size-4" />, label: t.board, value: boardText(h.board, q.locale) },
                          ].map((x) => (
                            <div key={x.label}>
                              <dt className="flex items-center gap-1.5 text-xs font-bold text-muted">
                                <span className="text-brand-500" aria-hidden="true">
                                  {x.icon}
                                </span>
                                {x.label}
                              </dt>
                              <dd className="mt-0.5 font-bold text-brand-950">{x.value}</dd>
                            </div>
                          ))}
                        </dl>
                        <div className="mt-3">
                          <HotelLinks hotel={h} t={t} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {q.inclusions.length || q.exclusions.length ? (
              <section className="grid gap-4 md:grid-cols-2" aria-label={`${t.included} / ${t.excluded}`}>
                {q.inclusions.length ? (
                  <div className="rounded-[1.5rem] bg-white p-6 ring-1 ring-brand-950/5">
                    <h2 className="font-extrabold text-brand-950">{t.included}</h2>
                    <ul role="list" className="mt-3 grid gap-2.5">
                      {q.inclusions.map((x) => (
                        <li key={x} className="flex items-start gap-2.5">
                          <Check className="mt-1 size-4 shrink-0 text-brand-600" strokeWidth={2.5} aria-hidden="true" /> {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {q.exclusions.length ? (
                  <div className="rounded-[1.5rem] bg-white p-6 ring-1 ring-brand-950/5">
                    <h2 className="font-extrabold text-brand-950">{t.excluded}</h2>
                    <ul role="list" className="mt-3 grid gap-2.5">
                      {q.exclusions.map((x) => (
                        <li key={x} className="flex items-start gap-2.5">
                          <X className="mt-1 size-4 shrink-0 text-accent-600" strokeWidth={2.5} aria-hidden="true" /> {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section aria-labelledby="q-pricing" className="overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-brand-950/5">
              <h2 id="q-pricing" className="px-6 pt-6 text-xl font-extrabold text-brand-950 sm:px-8">
                {t.pricing}
              </h2>
              <div className="mt-4 overflow-x-auto">
                <PricingTable q={q} t={t} />
              </div>
              {options.length ? (
                <div className="border-t border-line px-6 py-5 sm:px-8">
                  <h3 className="font-extrabold text-brand-950">{t.optional}</h3>
                  <p className="text-sm text-muted">{t.optionalNote}</p>
                  <ul role="list" className="mt-3 divide-y divide-line">
                    {options.map((o, i) => (
                      <li key={i} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                        <span>
                          <span className="font-bold text-brand-950">{o.label}</span>
                          {o.description ? <span className="block text-xs text-muted">{o.description}</span> : null}
                        </span>
                        <span className="num shrink-0 font-bold">
                          {m(o.unitPrice)} <span className="font-normal text-muted">× {o.quantity}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {q.notes ? (
              <section aria-labelledby="q-notes" className="rounded-[1.5rem] bg-white p-6 ring-1 ring-brand-950/5 sm:p-8">
                <h2 id="q-notes" className="text-xl font-extrabold text-brand-950">
                  {t.notes}
                </h2>
                <p className="mt-3 leading-[2] whitespace-pre-line text-ink/85">{q.notes}</p>
              </section>
            ) : null}
            {q.terms ? (
              <section aria-labelledby="q-terms" className="rounded-[1.5rem] bg-white p-6 ring-1 ring-brand-950/5 sm:p-8">
                <h2 id="q-terms" className="text-xl font-extrabold text-brand-950">
                  {t.terms}
                </h2>
                <p className="mt-3 text-sm leading-[2] whitespace-pre-line text-ink/80">{q.terms}</p>
              </section>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_30px_70px_-40px_rgb(5_28_51/0.6)] ring-1 ring-brand-950/5">
              <p className="text-sm font-bold text-muted">{t.headline[q.totals.headline.basis]}</p>
              <p className="num mt-1 text-[2.4rem] leading-none font-black text-brand-700">{m(q.totals.headline.amount)}</p>
              <dl className="mt-5 grid gap-2 border-t border-line pt-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t.total}</dt>
                  <dd className="num font-extrabold text-brand-950">{m(q.totals.total)}</dd>
                </div>
                {q.totals.headline.basis !== "person" && q.totals.perPerson != null ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t.avgPerPerson}</dt>
                    <dd className="num font-bold">{m(q.totals.perPerson)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t.validUntil}</dt>
                  <dd className="font-bold">{formatDay(q.validUntil, q.locale)}</dd>
                </div>
              </dl>
              {q.status !== "expired" && q.status !== "accepted" ? (
                <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${daysLeft <= 2 ? "bg-accent-50 text-accent-700" : "bg-brand-50 text-brand-700"}`}>
                  <Clock3 className="size-3.5" aria-hidden="true" /> {t.daysLeft(daysLeft)}
                </p>
              ) : null}
              {q.canRespond ? (
                <div className="mt-5">
                  <QuoteRespond token={token} locale={q.locale} disabled={mode === "staff"} />
                </div>
              ) : null}
              <div className="mt-3 grid gap-2.5">
                <a href={pdfHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-600 font-bold text-white transition-colors hover:bg-brand-700" data-pdf-link>
                  <Download className="size-5" aria-hidden="true" /> {t.downloadPdf}
                </a>
                <a href={ask} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line font-bold text-brand-900 hover:bg-brand-50">
                  <WhatsAppIcon className="size-5 text-[#1fa855]" /> {t.whatsapp}
                </a>
              </div>
            </div>
            <div className="mt-4 rounded-[1.5rem] bg-white p-5 text-sm ring-1 ring-brand-950/5">
              <p className="font-extrabold text-brand-950">{t.contact}</p>
              {q.preparedBy ? (
                <p className="mt-1 text-muted">
                  {t.preparedBy}: <span className="font-bold text-ink">{q.preparedBy}</span>
                </p>
              ) : null}
              <a href={telUrl} className="mt-3 flex items-center gap-2 font-bold text-brand-700">
                <Phone className="size-4" aria-hidden="true" /> <span dir="ltr" className="num">{site.phone.display}</span>
              </a>
              <p className="mt-2 leading-[1.8] text-muted">
                {q.locale === "ar" ? site.nameAr : site.nameEn} — {q.locale === "ar" ? `${site.address.streetAr}، ${site.address.cityAr}` : `${site.address.streetEn}, ${site.address.cityEn}`}
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

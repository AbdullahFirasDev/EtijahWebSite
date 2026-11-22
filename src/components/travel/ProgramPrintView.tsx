import { BedDouble, CalendarDays, Check, Clock3, ExternalLink, MapPin, Phone, Plane, PlaneTakeoff, Star, X } from "lucide-react";
import type { ReactNode } from "react";
import { LogoBadge } from "@/components/brand/Logo";
import { site, type Locale } from "@/content/site";
import { travel } from "@/content/travel";
import { formatDay } from "@/lib/dates";
import { mediaSrc } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import { BOARD_LABELS, RATE_BASIS_LABELS, TYPE_LABELS } from "@/lib/travel-labels";
import type { ProgramDetail } from "@/server/repo/programs";

function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 text-[15pt] font-extrabold text-brand-950 [break-after:avoid]">
      <span aria-hidden="true" className="h-[6mm] w-[1.6mm] rounded-full bg-accent-500" />
      {children}
    </h2>
  );
}

/**
 * A4 program document (Etijah identity) for PDF export. Built from the public read model only,
 * so internal costs and margins cannot appear. Hotel names are real links in the PDF.
 */
export function ProgramPrintView({ p, locale, url }: { p: ProgramDetail; locale: Locale; url: string | null }) {
  const t = travel[locale];
  const d = t.detail;
  const ar = locale === "ar";
  const money = (n: number) => formatMoney(n, p.currency, locale);
  const custom = p.type === "custom";
  const cover = p.cover ?? p.gallery[0] ?? null;

  return (
    <div className="program-print bg-white text-ink" dir={ar ? "rtl" : "ltr"} lang={locale}>
      <style>{`
        @page { size: A4; margin: 14mm 0 16mm; }
        @page :first { margin: 0; }
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .program-print { font-size: 10.5pt; line-height: 1.75; }
        .program-print .px-page { padding-inline: 14mm; }
        .program-print .avoid { break-inside: avoid; page-break-inside: avoid; }
        .program-print tr { break-inside: avoid; }
        @media screen { body { background: #dfe7ef; } .program-print { width: 210mm; margin: 6mm auto 14mm; box-shadow: 0 30px 80px -30px rgb(5 28 51 / 0.45); } .program-print .content { padding-block: 12mm 14mm; } }
        .program-print .cover { height: 297mm; }
      `}</style>

      <section className="cover relative flex flex-col overflow-hidden [break-after:page]">
        <div className="relative h-[60%] overflow-hidden bg-brand-950">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaSrc(cover, 1600)} alt="" loading="eager" className="h-full w-full object-cover" />
          ) : null}
          <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-brand-950/70 via-brand-950/10 to-brand-950/85" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-[14mm] pt-[12mm] text-white">
            <div className="flex items-center gap-3">
              <LogoBadge className="size-[15mm]" idSuffix="ppdf" />
              <div className="leading-tight">
                <p className="text-[15pt] font-black">{ar ? "الاتجاه" : "Etijah"}</p>
                <p className="text-[8.5pt] font-bold text-white/85">{ar ? "للسفر والسياحة" : "Travel & Tourism"}</p>
              </div>
            </div>
            <span className="rounded-full bg-accent-500 px-4 py-1.5 text-[10pt] font-extrabold text-brand-950">{TYPE_LABELS[p.type][locale]}</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-[14mm] pb-[10mm] text-white">
            <p className="flex items-center gap-1.5 text-[11pt] font-bold text-white/90">
              <MapPin className="size-[4.5mm] text-accent-400" aria-hidden="true" /> {[p.countries.map((c) => c.name).join(" · "), p.places.join(ar ? "، " : ", ")].filter(Boolean).join(" — ")}
            </p>
            <h1 className="mt-2 text-[27pt] leading-[1.25] font-black" data-print-title>
              {p.title}
            </h1>
            {p.summary ? <p className="mt-2 max-w-[160mm] text-[11pt] text-white/85">{p.summary}</p> : null}
          </div>
        </div>
        <div className="flex flex-1 flex-col px-[14mm] pt-[8mm] pb-[10mm]">
          <dl className="grid grid-cols-3 gap-[4mm] text-[9.5pt]">
            {[
              { icon: <Clock3 className="size-[4.5mm]" />, k: d.duration, v: `${t.card.days(p.days)} / ${t.card.nights(p.nights)}` },
              { icon: <CalendarDays className="size-[4.5mm]" />, k: custom ? t.card.custom : t.card.nextDeparture, v: custom ? t.card.flexible : p.nextDeparture ? `${formatDay(p.nextDeparture.departDate, locale)} ← ${formatDay(p.nextDeparture.returnDate, locale)}` : "—" },
              { icon: <PlaneTakeoff className="size-[4.5mm]" />, k: d.departureAirport, v: p.departureAirport ?? "—" },
              { icon: <Plane className="size-[4.5mm]" />, k: d.airlines, v: p.airlines.map((a) => a.name).join(ar ? "، " : ", ") || "—" },
              { icon: <BedDouble className="size-[4.5mm]" />, k: d.hotelsCount, v: p.hotelChoices.length ? String(p.hotelChoices.length) : "—" },
              { icon: <Star className="size-[4.5mm]" />, k: custom ? d.price : t.card.from, v: custom ? t.card.onRequest : p.priceFrom != null ? `${money(p.priceFrom)} ${d.perPerson}` : "—" },
            ].map((x) => (
              <div key={x.k} className="avoid rounded-[3mm] border border-line px-[4mm] py-[3mm]">
                <dt className="flex items-center gap-1.5 text-[7.5pt] font-bold text-muted">
                  <span className="text-brand-600" aria-hidden="true">
                    {x.icon}
                  </span>
                  {x.k}
                </dt>
                <dd className="mt-0.5 font-extrabold text-brand-950">{x.v}</dd>
              </div>
            ))}
          </dl>
          {!custom && p.departures.length > 1 ? (
            <p className="mt-[4mm] text-[9pt] text-muted">
              {d.departures}: {p.departures.map((x) => `${formatDay(x.departDate, locale, { day: "numeric", month: "short" })} – ${formatDay(x.returnDate, locale, { day: "numeric", month: "short" })}`).join(" · ")}
            </p>
          ) : null}
          <div className="mt-auto flex items-end justify-between border-t border-line pt-[5mm] text-[8.5pt] text-muted">
            <div>
              <p className="font-extrabold text-brand-950">{ar ? site.nameAr : site.nameEn}</p>
              <p>{ar ? `${site.address.streetAr}، ${site.address.cityAr}` : `${site.address.streetEn}, ${site.address.cityEn}`}</p>
            </div>
            <div className="text-end">
              <a href={`tel:${site.phone.e164}`} className="num block font-bold text-brand-800" dir="ltr">
                {site.phone.display}
              </a>
              <span className="num" dir="ltr">
                {p.code}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="content grid gap-[9mm]">
        {p.description ? (
          <section className="px-page">
            <H2>{d.overview}</H2>
            <p className="whitespace-pre-line text-ink/90">{p.description}</p>
          </section>
        ) : null}

        {p.hotelChoices.length ? (
          <section className="px-page">
            <H2>{custom ? d.hotelSuggestions : d.hotelOptions}</H2>
            <table className="w-full border-collapse text-[9pt] [&_td]:border-b [&_td]:border-line [&_td]:px-[2.5mm] [&_td]:py-[2.5mm] [&_td]:align-top [&_th]:bg-brand-950 [&_th]:px-[2.5mm] [&_th]:py-[2mm] [&_th]:text-start [&_th]:text-white">
              <thead>
                <tr>
                  <th>{t.request.hotel}</th>
                  <th>{d.room}</th>
                  <th>{t.request.nights}</th>
                  {!custom ? <th>{d.nightPrice}</th> : null}
                  {!custom ? <th>{d.stay}</th> : null}
                  {!custom ? <th>{d.totalPerPerson}</th> : null}
                </tr>
              </thead>
              <tbody>
                {[...new Set(p.hotelChoices.map((h) => h.hotel.id))].flatMap((hid) => {
                  const rooms = p.hotelChoices.filter((h) => h.hotel.id === hid);
                  return rooms.map((h, ri) => ({ h, span: ri === 0 ? rooms.length : 0 }));
                }).map(({ h, span }) => {
                  const link = h.hotel.websiteUrl || h.hotel.mapsUrl;
                  return (
                    <tr key={h.id}>
                      {span ? (
                      <td rowSpan={span}>
                        {link ? (
                          <a href={link} className="inline-flex items-center gap-1 font-extrabold text-brand-800 underline">
                            {h.hotel.name} <ExternalLink className="size-[3mm]" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="font-extrabold text-brand-950">{h.hotel.name}</span>
                        )}
                        <span className="block text-muted">
                          {h.hotel.stars ? `${"★".repeat(h.hotel.stars)} · ` : ""}
                          {h.hotel.city}
                        </span>
                      </td>
                      ) : null}
                      <td>
                        {h.room ?? "—"}
                        <span className="block text-muted">
                          {d.persons(h.occupancy)}
                          {h.board ? ` · ${BOARD_LABELS[h.board][locale]}` : ""}
                        </span>
                      </td>
                      <td className="num">{h.nights}</td>
                      {!custom ? (
                        <td className="num">
                          {h.nightPrice != null ? money(h.nightPrice) : "—"}
                          <span className="block text-muted">{RATE_BASIS_LABELS[h.basis][locale]}</span>
                        </td>
                      ) : null}
                      {!custom ? <td className="num">{h.hotelPerPerson != null ? money(h.hotelPerPerson) : "—"}</td> : null}
                      {!custom ? <td className="num text-[10.5pt] font-black text-brand-700">{h.pricePerPerson != null ? money(h.pricePerPerson) : "—"}</td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!custom ? <p className="mt-2 text-[8.5pt] text-muted">{d.hotelOptionsLead}</p> : <p className="mt-2 text-[8.5pt] text-muted">{d.customLead}</p>}
            {p.extraPrices.length ? (
              <ul className="mt-3 grid gap-1 text-[9pt]">
                {p.extraPrices.map((x) => (
                  <li key={x.label} className="flex justify-between border-b border-dashed border-line py-1">
                    <span>{x.label}</span>
                    <span className="num font-bold">{money(x.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {p.flights.length ? (
          <section className="px-page avoid">
            <H2>{d.flights}</H2>
            <ul className="grid gap-1.5 text-[9.5pt]">
              {p.flights.map((f, i) => (
                <li key={i} className="flex flex-wrap gap-x-3">
                  <span className="font-bold text-brand-700">{d.flightDir[f.direction]}</span>
                  {f.airline ? <span className="font-bold">{f.airline}</span> : null}
                  {f.flightNo ? <span className="num" dir="ltr">{f.flightNo}</span> : null}
                  {f.from || f.to ? <span>{f.from} ← {f.to}</span> : null}
                  {f.departTime ? <span className="num" dir="ltr">{f.departTime}{f.arriveTime ? ` – ${f.arriveTime}` : ""}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {p.itinerary.length ? (
          <section className="px-page">
            <H2>{d.itinerary}</H2>
            <ol className="grid gap-[3mm]">
              {p.itinerary.map((x) => (
                <li key={x.day} className="avoid flex gap-[4mm]">
                  <span className="num grid size-[9mm] shrink-0 place-items-center rounded-full bg-brand-600 text-[9pt] font-black text-white">{x.day}</span>
                  <div>
                    <p className="font-extrabold text-brand-950">{x.title}</p>
                    {x.body ? <p className="whitespace-pre-line text-ink/85">{x.body}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {p.included.length || p.excluded.length ? (
          <section className="px-page avoid">
            <div className="grid grid-cols-2 gap-[6mm]">
              <div>
                <H2>{d.included}</H2>
                <ul className="grid gap-1.5">
                  {p.included.map((s) => (
                    <li key={s.name} className="flex gap-2">
                      <Check className="mt-1 size-[4mm] shrink-0 text-brand-600" aria-hidden="true" />
                      <span>
                        {s.name}
                        {s.note ? <span className="text-muted"> — {s.note}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <H2>{d.excluded}</H2>
                <ul className="grid gap-1.5">
                  {p.excluded.map((s) => (
                    <li key={s.name} className="flex gap-2">
                      <X className="mt-1 size-[4mm] shrink-0 text-accent-600" aria-hidden="true" />
                      <span>
                        {s.name}
                        {s.note ? <span className="text-muted"> — {s.note}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {p.terms || p.meals ? (
          <section className="px-page avoid">
            <H2>{d.terms}</H2>
            {p.meals ? (
              <p className="mb-2">
                <span className="font-bold">{d.meals}: </span>
                {p.meals}
              </p>
            ) : null}
            {p.terms ? <p className="whitespace-pre-line text-ink/85">{p.terms}</p> : null}
          </section>
        ) : null}

        <section className="px-page avoid">
          <div className="rounded-[4mm] bg-brand-950 px-[6mm] py-[5mm] text-white">
            <p className="text-[12pt] font-extrabold">{ar ? "للحجز والاستفسار" : "Bookings & questions"}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10pt]">
              <a href={`tel:${site.phone.e164}`} className="num inline-flex items-center gap-1.5 font-bold" dir="ltr">
                <Phone className="size-[4mm]" aria-hidden="true" /> {site.phone.display}
              </a>
              {url ? (
                <a href={url} className="inline-flex items-center gap-1.5 font-bold text-accent-300 underline">
                  <ExternalLink className="size-[4mm]" aria-hidden="true" /> {ar ? "تفاصيل البرنامج والحجز أونلاين" : "Program details & online booking"}
                </a>
              ) : null}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

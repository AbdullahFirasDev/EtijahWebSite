import { Check, Download, Globe, MapPin, Phone, Printer, X } from "lucide-react";
import type { ReactNode } from "react";
import { WhatsAppIcon } from "@/components/ui/icons";
import { quoteDict } from "@/content/quote";
import { site, whatsappUrl } from "@/content/site";
import { asset } from "@/lib/asset";
import { daysBetween, formatDay } from "@/lib/dates";
import { mediaSrc } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import type { QuoteView } from "@/server/repo/quotes";
import { boardText, BrandMark, brandStyle, datesText, DestinationsTable, HotelLinks, HotelName, PricingTable, StarsInline, travelersText } from "./shared";

function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 text-[15pt] font-extrabold text-brand-950 [break-after:avoid]">
      <span aria-hidden="true" className="h-[6mm] w-[1.6mm] rounded-full bg-accent-500" />
      {children}
    </h2>
  );
}

/**
 * A4 print layout used for the PDF (rendered by headless Chromium) and for the on-screen
 * "PDF preview". Every link is a real <a href>, so it stays clickable inside the PDF.
 */
export function QuotePrintView({ q, token, onlineUrl, showToolbar }: { q: QuoteView; token: string; onlineUrl: string | null; showToolbar: boolean }) {
  const t = quoteDict[q.locale];
  const ar = q.locale === "ar";
  const m = (v: number) => formatMoney(v, q.currency, q.locale);
  const nights = q.startDate && q.endDate ? daysBetween(q.startDate, q.endDate) : null;
  const options = q.items.filter((i) => i.kind === "option");
  const cover = q.cover ?? q.hotels.find((h) => h.images[0])?.images[0] ?? null;
  const gallery = q.gallery.slice(0, 6);
  const etijah = q.brand.kind === "etijah";

  return (
    <div className="quote-print bg-white text-ink" style={brandStyle(q.brand)} data-brand={q.brand.kind}>
      <style>{`
        @page { size: A4; margin: 14mm 0 16mm; }
        @page :first { margin: 0; }
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .quote-print { font-size: 10.5pt; line-height: 1.75; }
        .quote-print .px-page { padding-inline: 14mm; }
        .quote-print .avoid { break-inside: avoid; page-break-inside: avoid; }
        .quote-print section { break-inside: auto; }
        .quote-print thead { display: table-header-group; }
        .quote-print tr { break-inside: avoid; page-break-inside: avoid; }
        @media screen {
          body { background: #dfe7ef; }
          .quote-print { width: 210mm; margin: 6mm auto 14mm; box-shadow: 0 30px 80px -30px rgb(5 28 51 / 0.45); }
          .quote-print .cover { height: 297mm; }
          .quote-print .content { padding-block: 12mm 14mm; }
        }
        @media print {
          .quote-print .cover { height: 297mm; }
          .no-print { display: none !important; }
        }
      `}</style>

      {showToolbar ? (
        <div className="no-print fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-brand-950 px-4 py-2.5 text-sm font-bold text-white">
          <span>
            {t.docTitle} <span className="num">{q.ref}</span> — A4
          </span>
          <a href={asset(`/q/${token}/pdf/`)} className="inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-1.5 text-brand-950">
            <Download className="size-4" aria-hidden="true" /> {t.downloadPdf}
          </a>
          <a href={asset(`/q/${token}/`)} className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-4 py-1.5">
            <Printer className="size-4" aria-hidden="true" /> {ar ? "الصفحة التفاعلية" : "Interactive page"}
          </a>
        </div>
      ) : null}

      {/* ------------------------------------------------------------ Cover page */}
      <section className="cover relative flex flex-col overflow-hidden [break-after:page]">
        <div className="relative h-[58%] overflow-hidden bg-[var(--qp)]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaSrc(cover, 1600)} alt="" loading="eager" className="h-full w-full object-cover" />
          ) : null}
          <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-brand-950/70 via-brand-950/10 to-brand-950/80" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-[14mm] pt-[12mm]">
            <div className="text-white">
              <BrandMark brand={q.brand} locale={q.locale} size="lg" idSuffix="pdf" />
            </div>
            <span className="rounded-full bg-[var(--qs)] px-4 py-1.5 text-[10pt] font-extrabold text-[var(--qs-on)]">{t.docTitle}</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-[14mm] pb-[10mm] text-white">
            {q.destination ? (
              <p className="flex items-center gap-1.5 text-[11pt] font-bold text-white/90">
                <MapPin className="size-[4.5mm] text-accent-400" aria-hidden="true" /> {q.destination}
              </p>
            ) : null}
            <h1 className="mt-2 text-[27pt] leading-[1.25] font-black">{q.title}</h1>
          </div>
        </div>
        <div className="flex flex-1 flex-col px-[14mm] pt-[9mm] pb-[10mm]">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[9pt] font-bold text-muted">{t.preparedFor}</p>
              <p className="text-[19pt] leading-tight font-black text-brand-950" data-recipient>{q.recipient.name}</p>
              {q.recipient.contact ? (
                <p className="mt-1 text-[10pt] text-muted">
                  {t.attention}: <span className="font-bold text-ink">{q.recipient.contact}</span>
                </p>
              ) : null}
              {q.beneficiary ? (
                <p className="mt-1 text-[10pt] text-muted" data-beneficiary>
                  {t.beneficiary}: <span className="font-bold text-ink">{[q.beneficiary.name, q.beneficiary.note].filter(Boolean).join(" — ")}</span>
                </p>
              ) : null}
            </div>
            <div className="shrink-0 rounded-[5mm] bg-[var(--qp)] px-[7mm] py-[5mm] text-[var(--qp-on)]">
              <p className="text-[8.5pt] font-bold opacity-80">{t.headline[q.totals.headline.basis]}</p>
              <p className="num text-[21pt] leading-tight font-black">{m(q.totals.headline.amount)}</p>
              <p className="num text-[8.5pt] opacity-70">
                {t.total}: {m(q.totals.total)}
              </p>
            </div>
          </div>
          <dl className="mt-[8mm] grid grid-cols-4 overflow-hidden rounded-[4mm] border border-line text-[9pt]">
            {[
              { k: t.ref, v: <span className="num" dir="ltr">{q.ref}{q.revision > 1 ? ` · R${q.revision}` : ""}</span> },
              { k: t.issued, v: formatDay(q.issuedAt.slice(0, 10), q.locale) },
              { k: t.validUntil, v: formatDay(q.validUntil, q.locale) },
              { k: t.travelers, v: travelersText(q, t) },
              { k: t.travelDates, v: datesText(q) },
              { k: t.duration, v: nights ? t.nights(nights) : "—" },
              { k: t.rooms, v: q.rooms ? `${t.roomsCount(q.rooms)}${q.roomsNote ? ` (${q.roomsNote})` : ""}` : (q.roomsNote ?? "—") },
              { k: t.hotels, v: q.hotels.length ? String(q.hotels.length) : "—" },
            ].map((x, i) => (
              <div key={i} className={`px-[4mm] py-[3mm] ${i < 4 ? "border-b border-line" : ""} ${i % 4 !== 3 ? "border-e border-line" : ""}`}>
                <dt className="text-[7.5pt] font-bold text-muted">{x.k}</dt>
                <dd className="mt-0.5 font-bold text-brand-950">{x.v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-auto flex items-end justify-between gap-6 border-t border-line pt-[5mm] text-[8.5pt] text-muted">
            <div>
              <p className="font-extrabold text-brand-950">{q.brand.name}</p>
              {q.brand.contactLines.slice(1).map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
            <div className="text-end">
              <p className="num block font-bold text-brand-800" dir="ltr">
                {q.brand.contactLines[0] ?? ""}
              </p>
              {q.preparedBy ? (
                <p>
                  {t.preparedBy}: {q.preparedBy}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Content */}
      <div className="content grid gap-[9mm]">
        {q.intro ? (
          <section className="px-page avoid">
            <H2>{t.overview}</H2>
            <p className="whitespace-pre-line text-ink/90">{q.intro}</p>
          </section>
        ) : null}

        {q.destinations.length ? (
          <section className="px-page avoid">
            <H2>{t.destinations}</H2>
            <div className="overflow-hidden rounded-[3mm] border border-line">
              <DestinationsTable q={q} t={t} compact />
            </div>
          </section>
        ) : null}

        {q.days.length ? (
          <section className="px-page">
            <H2>{t.itinerary}</H2>
            <ol className="grid gap-[3.5mm]">
              {q.days.map((d) => (
                <li key={d.day} className="avoid flex gap-[4mm]">
                  <span className="num grid size-[8mm] shrink-0 place-items-center rounded-full bg-brand-600 text-[9pt] font-black text-white">{d.day}</span>
                  <div className="min-w-0 flex-1 border-b border-line pb-[3mm]">
                    <p className="font-extrabold text-brand-950">
                      {t.day} {d.day}: {d.title}
                    </p>
                    {d.body ? <p className="mt-0.5 whitespace-pre-line text-ink/85">{d.body}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {q.hotels.length ? (
          <section className="px-page">
            <H2>{t.hotels}</H2>
            <ul className="grid gap-[4mm]">
              {q.hotels.map((h, i) => (
                <li key={`${h.id}-${i}`} className="avoid flex gap-[5mm] overflow-hidden rounded-[4mm] border border-line">
                  <div className="w-[48mm] shrink-0 bg-brand-100">
                    {h.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaSrc(h.images[0], 960)} alt="" loading="eager" className="h-full min-h-[36mm] w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 py-[3.5mm] pe-[4mm]">
                    <div className="flex items-center gap-2">
                      <StarsInline n={h.stars} />
                      <span className="text-[8.5pt] text-muted">
                        {h.city}، {h.country}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12.5pt] font-extrabold">
                      <HotelName hotel={h} className="text-brand-700 underline decoration-[0.5mm] underline-offset-[1.2mm]" />
                    </p>
                    <table className="mt-[2mm] w-full text-[8.5pt]">
                      <tbody>
                        <tr>
                          <td className="py-0.5 text-muted">{t.checkIn}</td>
                          <td className="py-0.5 font-bold">{h.checkIn ? formatDay(h.checkIn, q.locale) : "—"}</td>
                          <td className="py-0.5 text-muted">{t.checkOut}</td>
                          <td className="py-0.5 font-bold">{h.checkOut ? formatDay(h.checkOut, q.locale) : "—"}</td>
                        </tr>
                        <tr>
                          <td className="py-0.5 text-muted">{t.room}</td>
                          <td className="py-0.5 font-bold">
                            {h.roomType ?? "—"}
                            {h.roomsCount ? ` × ${h.roomsCount}` : ""} · {t.nights(h.nights)}
                          </td>
                          <td className="py-0.5 text-muted">{t.board}</td>
                          <td className="py-0.5 font-bold">{boardText(h.board, q.locale)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="mt-[1.5mm]">
                      <HotelLinks hotel={h} t={t} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {gallery.length ? (
          <section className="px-page avoid">
            <div className={`grid gap-[3mm] ${gallery.length >= 3 ? "grid-cols-3" : gallery.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
              {gallery.map((g) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={g.id} src={mediaSrc(g, 960)} alt="" loading="eager" className="h-[48mm] w-full rounded-[3mm] object-cover" />
              ))}
            </div>
          </section>
        ) : null}

        {q.inclusions.length || q.exclusions.length ? (
          <section className="px-page avoid grid grid-cols-2 gap-[6mm]">
            {q.inclusions.length ? (
              <div>
                <H2>{t.included}</H2>
                <ul className="grid gap-1.5">
                  {q.inclusions.map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <Check className="mt-[1mm] size-[3.5mm] shrink-0 text-brand-600" strokeWidth={3} aria-hidden="true" /> {x}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {q.exclusions.length ? (
              <div>
                <H2>{t.excluded}</H2>
                <ul className="grid gap-1.5">
                  {q.exclusions.map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <X className="mt-[1mm] size-[3.5mm] shrink-0 text-accent-600" strokeWidth={3} aria-hidden="true" /> {x}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="px-page">
          <H2>{t.pricing}</H2>
          <div className="overflow-hidden rounded-[3mm] border border-line">
            <PricingTable q={q} t={t} compact />
          </div>
          <p className="mt-2 text-[8.5pt] text-muted">
            {t.currencyNote(q.currency)} {q.totals.perPerson != null && q.totals.headline.basis !== "person" ? `${t.avgPerPerson}: ${m(q.totals.perPerson)}` : ""}
          </p>
          {options.length ? (
            <div className="avoid mt-[5mm] rounded-[3mm] bg-mist p-[4mm]">
              <p className="font-extrabold text-brand-950">{t.optional}</p>
              <p className="text-[8.5pt] text-muted">{t.optionalNote}</p>
              <table className="mt-2 w-full text-[9pt]">
                <tbody>
                  {options.map((o, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-1.5">
                        <span className="font-bold">{o.label}</span>
                        {o.description ? <span className="text-muted"> — {o.description}</span> : null}
                      </td>
                      <td className="num py-1.5 text-end font-bold whitespace-nowrap">
                        {m(o.unitPrice)} × {o.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="avoid mt-[5mm] flex items-center justify-between rounded-[4mm] bg-[var(--qp)] px-[6mm] py-[4mm] text-[var(--qp-on)]">
            <div>
              <p className="text-[9pt] font-bold opacity-80">{t.total}</p>
              <p className="text-[8pt] opacity-70">
                {t.validUntil}: {formatDay(q.validUntil, q.locale)}
              </p>
            </div>
            <p className="num text-[20pt] font-black">{m(q.totals.total)}</p>
          </div>
          <div className="avoid mt-[4mm] rounded-[4mm] border-2 border-brand-100 px-[6mm] py-[4mm]">
            <p className="text-[11pt] font-extrabold text-brand-950">{t.contact}</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-[6mm] gap-y-1.5 text-[9pt]">
              {!etijah
                ? q.brand.contactLines.map((l) => (
                    <li key={l} className="flex items-center gap-2">
                      <Phone className="size-[4mm] shrink-0 text-brand-600" aria-hidden="true" />
                      <span className="font-bold text-brand-800">{l}</span>
                    </li>
                  ))
                : null}
              {etijah ? (
              <>
              <li className="flex items-center gap-2">
                <Phone className="size-[4mm] shrink-0 text-brand-600" aria-hidden="true" />
                <a href={`tel:${site.phone.e164}`} className="num font-bold text-brand-800 underline" dir="ltr">
                  {site.phone.display}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <WhatsAppIcon className="size-[4mm] shrink-0 text-[#1fa855]" />
                <a href={whatsappUrl(ar ? `مرحباً، بخصوص عرض السعر ${q.ref}` : `Hello, regarding quotation ${q.ref}`)} className="font-bold text-brand-800 underline">
                  WhatsApp
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="size-[4mm] shrink-0 text-brand-600" aria-hidden="true" />
                <a href={site.maps.url} className="text-brand-800 underline">
                  {ar ? `${site.address.streetAr}، ${site.address.cityAr}` : `${site.address.streetEn}, ${site.address.cityEn}`}
                </a>
              </li>
              </>
              ) : null}
              {onlineUrl ? (
                <li className="flex items-center gap-2">
                  <Globe className="size-[4mm] shrink-0 text-brand-600" aria-hidden="true" />
                  <a href={onlineUrl} className="font-bold text-brand-800 underline">
                    {t.onlineVersion}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </section>

        {q.notes ? (
          <section className="px-page avoid">
            <H2>{t.notes}</H2>
            <p className="whitespace-pre-line text-ink/85">{q.notes}</p>
          </section>
        ) : null}
        {q.terms ? (
          <section className="px-page">
            <H2>{t.terms}</H2>
            <p className="text-[9pt] leading-[1.9] whitespace-pre-line text-ink/80">{q.terms}</p>
          </section>
        ) : null}

      </div>
    </div>
  );
}

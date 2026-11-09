import { Compass, Globe2, UsersRound } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { WhatsAppIcon } from "@/components/ui/icons";
import { whatsappUrl, type Locale } from "@/content/site";
import { travel } from "@/content/travel";
import { formatDay } from "@/lib/dates";
import { CURRENCIES, formatAmount, type CurrencyCode } from "@/lib/money";
import { listPublicPrograms, publicFacets, upcomingDepartures, type ProgramFilters as Filters } from "@/server/repo/programs";
import { DepartureCard } from "./DepartureCard";
import { OfferCard } from "./OfferCard";
import { ProgramFilters, SortSelect } from "./ProgramFilters";
import { RouteLines } from "./TravelShell";

const BUDGETS: Record<string, number[]> = {
  USD: [500, 750, 1000, 1500, 2000, 3000],
  EUR: [500, 750, 1000, 1500, 2000, 3000],
  IQD: [750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 4_000_000],
};

type Search = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined, max = 60) => (typeof v === "string" ? v.slice(0, max) : "");

export function parseFilters(sp: Search) {
  const values = {
    q: str(sp.q),
    country: /^[A-Z]{2}$/.test(str(sp.country)) ? str(sp.country) : "",
    kind: ["group", "package"].includes(str(sp.kind)) ? str(sp.kind) : "",
    duration: ["short", "week", "long", "extended"].includes(str(sp.duration)) ? str(sp.duration) : "",
    month: /^\d{4}-\d{2}$/.test(str(sp.month)) ? str(sp.month) : "",
    budget: /^\d{1,9}$/.test(str(sp.budget)) ? str(sp.budget) : "",
    sort: ["price-asc", "price-desc", "soonest"].includes(str(sp.sort)) ? str(sp.sort) : "",
  };
  const filters: Filters = {
    q: values.q || undefined,
    country: values.country || undefined,
    kind: (values.kind || undefined) as Filters["kind"],
    duration: (values.duration || undefined) as Filters["duration"],
    month: values.month || undefined,
    maxPrice: values.budget ? Number(values.budget) * 100 : undefined,
    sort: (values.sort || "recommended") as Filters["sort"],
  };
  return { values, filters };
}

export function ProgramsListing({ locale, searchParams }: { locale: Locale; searchParams: Search }) {
  const t = travel[locale];
  const { values, filters } = parseFilters(searchParams);
  const facets = publicFacets(locale);
  const cards = listPublicPrograms(filters, locale);
  const filtered = Object.entries(values).some(([k, v]) => v && k !== "sort");
  const groups = filtered ? [] : upcomingDepartures(locale, 10);
  const budgets = facets.currency && BUDGETS[facets.currency] ? BUDGETS[facets.currency] : [];
  // Client components receive plain data only (the dictionary also holds formatting functions).
  const filterText: Omit<typeof t.list, "results"> = { ...t.list };
  delete (filterText as Partial<typeof t.list>).results;
  const currencyLabel = facets.currency ? (CURRENCIES[facets.currency as CurrencyCode]?.[locale] ?? facets.currency) : "";

  return (
    <>
      {/* Hero */}
      <section id="top" aria-labelledby="offers-title" className="surface-dark relative overflow-hidden bg-brand-950 pt-32 pb-28 sm:pt-40 sm:pb-36">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_34rem_at_85%_-10%,rgb(8_102_178/0.65),transparent_65%),radial-gradient(40rem_28rem_at_0%_110%,rgb(245_130_32/0.22),transparent_60%)]" />
        <RouteLines className="opacity-70" />
        <div className="container-site relative">
          <p data-hero-fade className="flex items-center gap-3 text-sm font-bold text-accent-400 ltr:tracking-[0.16em] ltr:uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-current" />
            {t.list.eyebrow}
          </p>
          <h1 id="offers-title" data-hero-fade style={{ ["--delay" as string]: "80ms" }} className="mt-5 max-w-3xl text-[2.4rem] leading-[1.2] font-black text-balance text-white sm:text-[3.4rem] lg:text-[4rem]">
            {t.list.title}
          </h1>
          <p data-hero-fade style={{ ["--delay" as string]: "160ms" }} className="mt-6 max-w-2xl text-[1.05rem] leading-[1.95] text-brand-100/85 sm:text-lg">
            {t.list.lead}
          </p>
          {facets.total ? (
            <dl data-hero-fade style={{ ["--delay" as string]: "240ms" }} className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {[
                { icon: <Compass className="size-5" />, value: facets.total, label: t.list.stats.offers },
                { icon: <UsersRound className="size-5" />, value: facets.groups, label: t.list.stats.groups },
                { icon: <Globe2 className="size-5" />, value: facets.countries.length, label: t.list.stats.countries },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-accent-400 ring-1 ring-white/15" aria-hidden="true">
                    {s.icon}
                  </span>
                  <div>
                    <dd className="num text-2xl leading-none font-black text-white">{s.value}</dd>
                    <dt className="mt-1 text-sm text-white/65">{s.label}</dt>
                  </div>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>

      {/* Filters overlap the hero */}
      <div className="container-site relative z-10 -mt-16 sm:-mt-20">
        <ProgramFilters
          t={filterText}
          values={values}
          countries={facets.countries}
          months={facets.months.map((m) => ({ value: m, label: formatDay(`${m}-01`, locale, { month: "long", year: "numeric" }) }))}
          budgets={budgets.map((b) => ({ value: String(b), label: `${t.list.upTo} ${formatAmount(b * 100)} ${currencyLabel}` }))}
        />
      </div>

      {/* Upcoming groups */}
      {groups.length ? (
        <section aria-labelledby="groups-title" className="pt-16 sm:pt-20">
          <div className="container-site">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 id="groups-title" className="text-2xl font-extrabold text-brand-950 sm:text-3xl">
                  {t.list.groupsTitle}
                </h2>
                <p className="mt-1 text-muted">{t.list.groupsLead}</p>
              </div>
            </div>
          </div>
          <div className="container-site mt-6">
            <ul role="list" className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pt-1 pb-6 sm:-mx-8 sm:px-8 [scrollbar-width:thin]">
              {groups.map(({ program, departure }) => (
                <li key={departure.id} className="flex">
                  <DepartureCard program={program} departure={departure} locale={locale} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Results */}
      <Reveal as="section" id="results" aria-labelledby="results-title" className="scroll-mt-24 pt-12 pb-24 sm:pt-16 sm:pb-32">
        <div className="container-site">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 id="results-title" className="text-2xl font-extrabold text-brand-950 sm:text-3xl" aria-live="polite">
              {t.list.results(cards.length)}
            </h2>
            {cards.length > 1 ? (
              <SortSelect label={t.list.sort} value={values.sort || "recommended"} options={Object.entries(t.list.sorts).map(([value, label]) => ({ value, label }))} />
            ) : null}
          </div>

          {cards.length ? (
            <ul role="list" className="mt-8 grid gap-6 sm:gap-7 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((c, i) => (
                <li key={c.id} data-reveal className="flex">
                  <OfferCard card={c} locale={locale} priority={i < 2} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-8 flex flex-col items-center rounded-[1.75rem] bg-white px-6 py-16 text-center ring-1 ring-brand-950/5">
              <span className="grid size-16 place-items-center rounded-3xl bg-brand-50 text-brand-600">
                <Compass className="size-8" aria-hidden="true" />
              </span>
              <p className="mt-5 text-xl font-extrabold text-brand-950">{facets.total ? t.list.emptyTitle : t.list.emptyAll}</p>
              {facets.total ? <p className="mt-2 max-w-md leading-[1.9] text-muted">{t.list.emptyText}</p> : null}
              <a
                href={whatsappUrl(locale === "ar" ? "مرحباً، أرغب بتصميم برنامج سياحي خاص." : "Hello, I'd like a tailor-made trip.")}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-accent-500 px-6 font-bold text-brand-950 transition-colors hover:bg-accent-400"
              >
                <WhatsAppIcon className="size-5" /> {t.list.askCustom}
              </a>
            </div>
          )}
        </div>
      </Reveal>
    </>
  );
}

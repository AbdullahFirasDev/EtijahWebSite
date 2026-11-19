// Imports the reference geography (src/data/destinations.ts) into `destinations`.
// Shared by `npm run db:seed-geo` and the "import" button on the destinations page, so it takes the
// database and the data as arguments (no "server-only", no path aliases: Node runs it directly).
//
// Rules: idempotent and non-destructive.
//  * A reference row matches an existing destination of the same country by reference slug, by
//    normalised Arabic name (أ/إ/آ → ا, ة → ه, ى → ي, no diacritics) or by English name.
//  * Matched rows keep every value staff entered; only empty `kind` / `airport_code` / `ref` are filled.
//  * New rows get numeric ids from `counters`, a unique slug, and `active: true`.
import type { Db } from "mongodb";

export interface GeoCountryInput {
  code: string;
  items: readonly (readonly [slug: string, ar: string, en: string, kind: "c" | "a", airport?: string])[];
}

export interface GeoImportReport {
  countries: { code: string; added: number; completed: number; existing: number }[];
  added: number;
  completed: number;
  existing: number;
}

interface DestDoc {
  _id: number;
  slug: string;
  country_code: string;
  name_ar: string;
  name_en: string;
  kind?: "city" | "area";
  airport_code?: string | null;
  ref?: string | null;
}

/** Arabic spelling variants that should count as the same city (إسطنبول = اسطنبول). */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ْٰـ]/g, "") // harakat, dagger alif, tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const normEn = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function importGeo(db: Db, data: readonly GeoCountryInput[], opts: { countries?: string[]; dryRun?: boolean } = {}): Promise<GeoImportReport> {
  const wanted = opts.countries?.length ? new Set(opts.countries.map((c) => c.toUpperCase())) : null;
  const list = data.filter((c) => !wanted || wanted.has(c.code));
  const col = db.collection<DestDoc>("destinations");
  const counters = db.collection<{ _id: string; value: number }>("counters");
  const existingAll = await col.find({}, { projection: { _id: 1, slug: 1, country_code: 1, name_ar: 1, name_en: 1, kind: 1, airport_code: 1, ref: 1 } }).toArray();
  const slugs = new Set(existingAll.map((d) => d.slug));
  const report: GeoImportReport = { countries: [], added: 0, completed: 0, existing: 0 };
  const t = new Date().toISOString();

  for (const country of list) {
    const existing = existingAll.filter((d) => d.country_code === country.code);
    const byRef = new Map(existing.filter((d) => d.ref).map((d) => [d.ref!, d]));
    const byAr = new Map(existing.map((d) => [normalizeArabic(d.name_ar), d]));
    const byEn = new Map(existing.map((d) => [normEn(d.name_en), d]));
    const fresh: DestDoc[] = [];
    const row = { code: country.code, added: 0, completed: 0, existing: 0 };

    for (const [ref, ar, en, k, airport] of country.items) {
      const kind = k === "c" ? "city" : "area";
      const match = byRef.get(ref) ?? byAr.get(normalizeArabic(ar)) ?? byEn.get(normEn(en));
      if (match) {
        const fill: Partial<DestDoc> = {};
        if (!match.kind) fill.kind = kind;
        if (!match.airport_code && airport) fill.airport_code = airport;
        if (!match.ref) fill.ref = ref;
        if (Object.keys(fill).length) {
          row.completed++;
          if (!opts.dryRun) await col.updateOne({ _id: match._id }, { $set: { ...fill, updated_at: t } });
        } else row.existing++;
        continue;
      }
      let slug = ref;
      for (let i = 2; slugs.has(slug); i++) slug = `${ref}-${country.code.toLowerCase()}${i > 2 ? `-${i}` : ""}`;
      slugs.add(slug);
      const doc = { _id: 0, slug, country_code: country.code, name_ar: ar, name_en: en, kind, airport_code: airport ?? null, ref } satisfies DestDoc;
      fresh.push(doc);
      // Later rows of the same batch must see this one too (no duplicates within the data).
      byAr.set(normalizeArabic(ar), doc);
      byEn.set(normEn(en), doc);
    }

    if (fresh.length && !opts.dryRun) {
      // Reserve a block of ids in one atomic step.
      const r = await counters.findOneAndUpdate({ _id: "destinations" }, { $inc: { value: fresh.length } }, { upsert: true, returnDocument: "after" });
      const first = r!.value - fresh.length + 1;
      await col.insertMany(
        fresh.map((d, i) => ({ ...d, _id: first + i, summary_ar: null, summary_en: null, cover_media_id: null, active: true, created_at: t, updated_at: t })),
        { ordered: true },
      );
    }
    row.added = fresh.length;
    report.countries.push(row);
    report.added += row.added;
    report.completed += row.completed;
    report.existing += row.existing;
  }
  return report;
}

/** Per country: how many reference rows are not in the database yet (for the import panel). */
export async function geoCoverage(db: Db, data: readonly GeoCountryInput[]): Promise<{ code: string; total: number; missing: number }[]> {
  const existingAll = await db.collection<DestDoc>("destinations").find({}, { projection: { country_code: 1, name_ar: 1, name_en: 1, ref: 1 } }).toArray();
  return data.map((c) => {
    const ex = existingAll.filter((d) => d.country_code === c.code);
    const refs = new Set(ex.map((d) => d.ref).filter(Boolean));
    const ars = new Set(ex.map((d) => normalizeArabic(d.name_ar)));
    const ens = new Set(ex.map((d) => normEn(d.name_en)));
    const missing = c.items.filter(([ref, ar, en]) => !refs.has(ref) && !ars.has(normalizeArabic(ar)) && !ens.has(normEn(en))).length;
    return { code: c.code, total: c.items.length, missing };
  });
}

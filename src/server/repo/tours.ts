import "server-only";
import { col, nextId, now } from "../db";

/**
 * Pre-registered tours (جولات مسجلة مسبقاً): sightseeing tours, excursions and activities kept
 * once in a library, then added to program days and quotes. Programs and quotes copy the text
 * and price when the tour is added, so editing the library later never changes an existing offer.
 */
export interface TourDoc {
  _id: number;
  country_code: string;
  city_ar: string | null;
  city_en: string | null;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  /** Free text, e.g. "4 ساعات" / "Half day". */
  duration_ar: string | null;
  duration_en: string | null;
  currency: string;
  /** Per person, minor units. */
  price: number;
  /** INTERNAL: per person cost, minor units. */
  cost: number | null;
  active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export type TourInput = Omit<TourDoc, "_id" | "created_by" | "created_at" | "updated_at"> & { id?: number };

const tours = () => col<TourDoc>("tours");

export async function listTours(opts: { activeOnly?: boolean; includeCosts?: boolean } = {}) {
  const rows = await (await tours()).find(opts.activeOnly ? { active: true } : {}).sort({ country_code: 1, city_ar: 1, name_ar: 1 }).toArray();
  return rows.map(({ _id, created_by: _c, cost, ...t }) => ({ id: _id, ...t, cost: opts.includeCosts ? cost : null }));
}
export type TourItem = Awaited<ReturnType<typeof listTours>>[number];

export async function getTour(id: number) {
  return (await tours()).findOne({ _id: id });
}

export async function saveTour(input: TourInput, userId: number): Promise<number> {
  const t = now();
  const { id, ...fields } = input;
  if (id) {
    await (await tours()).updateOne({ _id: id }, { $set: { ...fields, updated_at: t } });
    return id;
  }
  const newId = await nextId("tours");
  await (await tours()).insertOne({ _id: newId, ...fields, created_by: userId, created_at: t, updated_at: t });
  return newId;
}

export async function deleteTour(id: number) {
  await (await tours()).deleteOne({ _id: id });
}

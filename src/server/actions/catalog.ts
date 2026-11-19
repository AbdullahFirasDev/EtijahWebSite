"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { isCurrency } from "@/lib/money";
import { can } from "@/lib/permissions";
import { BOARDS, SERVICE_ICONS } from "@/lib/travel-labels";
import { GEO_COUNTRIES } from "@/data/destinations";
import { db } from "../db";
import { importGeo } from "../db/geo";
import { mediaExist } from "../media";
import {
  deleteDestination,
  deleteHotel,
  deleteService,
  getDestination,
  getHotel,
  getService,
  RATE_BASES,
  saveDestination,
  saveHotel,
  saveHotelRates,
  saveService,
} from "../repo/catalog";
import { audit } from "../security";
import { country, id, int, mediaId, money, optDay, optEmail, optText, optUrl, reqText } from "../validation";
import { staffAction } from "./guard";

const refreshPublic = () => revalidatePath("/", "layout");

// ------------------------------------------------------------------ Destinations
const destinationSchema = z.object({
  id: id.optional(),
  country_code: country,
  name_ar: reqText(2, 80, "اسم الوجهة بالعربية"),
  name_en: reqText(2, 80, "اسم الوجهة بالإنجليزية"),
  kind: z.enum(["city", "area"]).default("city"),
  airport_code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/, "رمز المطار ثلاثة أحرف (IATA)، مثل IST."))
    .nullable()
    .default(null),
  summary_ar: optText(400),
  summary_en: optText(400),
  cover_media_id: mediaId.nullable(),
  active: z.boolean(),
});

export async function saveDestinationAction(input: z.input<typeof destinationSchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("destinations.edit", destinationSchema, input, async (data, staff) => {
    if (data.id && !(await getDestination(data.id))) return { ok: false, error: "الوجهة غير موجودة." };
    if (!(await mediaExist([data.cover_media_id]))) return { ok: false, error: "الصورة غير موجودة." };
    const savedId = await saveDestination(data);
    await audit(staff.id, data.id ? "update" : "create", "destination", savedId);
    refreshPublic();
    return ok({ id: savedId }, "تم حفظ الوجهة.");
  });
}

const geoImportSchema = z.object({ countries: z.array(country).max(300).nullable() });

/** Adds the reference cities and tourist areas (src/data/destinations.ts) of the chosen countries. Never edits or removes existing rows. */
export async function importGeoAction(input: z.input<typeof geoImportSchema>): Promise<ActionResult<{ added: number; completed: number }>> {
  return staffAction("destinations.edit", geoImportSchema, input, async (data, staff) => {
    const r = await importGeo(await db(), GEO_COUNTRIES, { countries: data.countries ?? undefined });
    if (r.added || r.completed) await audit(staff.id, "import", "destination", null, { added: r.added, completed: r.completed, countries: data.countries ?? "all" });
    refreshPublic();
    return ok({ added: r.added, completed: r.completed }, r.added ? `أُضيفت ${r.added} وجهة.` : "كل الوجهات المرجعية موجودة مسبقاً.");
  });
}

export async function deleteDestinationAction(destinationId: number): Promise<ActionResult<null>> {
  return staffAction("programs.delete", id, destinationId, async (did, staff) => {
    const problem = await deleteDestination(did);
    if (problem) return { ok: false, error: problem };
    await audit(staff.id, "delete", "destination", did);
    return ok(null, "تم حذف الوجهة.");
  });
}

// ------------------------------------------------------------------ Hotels
const roomTypeSchema = z.object({
  id: z.string().max(64).nullable(),
  name_ar: reqText(2, 100, "اسم نوع الغرفة"),
  name_en: optText(100),
  max_pax: int(1, 20, "عدد الأشخاص في الغرفة"),
  notes: optText(300),
});

const hotelSchema = z.object({
  id: id.optional(),
  destination_id: id,
  name_ar: reqText(2, 120, "اسم الفندق بالعربية"),
  name_en: reqText(2, 120, "اسم الفندق بالإنجليزية"),
  stars: int(1, 5, "عدد النجوم").nullable(),
  category_ar: optText(60),
  category_en: optText(60),
  website_url: optUrl,
  maps_url: optUrl,
  address_ar: optText(200),
  address_en: optText(200),
  description_ar: optText(3000),
  description_en: optText(3000),
  rooms_ar: optText(1000),
  rooms_en: optText(1000),
  amenities: z.array(z.string().trim().min(1).max(80)).max(40),
  contact: z.object({ phone: optText(40), email: optEmail, person: optText(100) }),
  internal_notes: optText(3000),
  status: z.enum(["active", "archived"]),
  media: z.array(mediaId).max(16),
  room_types: z.array(roomTypeSchema).max(30),
});

export async function saveHotelAction(input: z.input<typeof hotelSchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("hotels.edit", hotelSchema, input, async (data, staff) => {
    if (data.id && !(await getHotel(data.id))) return { ok: false, error: "الفندق غير موجود." };
    if (!(await getDestination(data.destination_id))) return { ok: false, error: "اختر المدينة/الوجهة.", fieldErrors: { destination_id: "مطلوب" } };
    if (!(await mediaExist(data.media))) return { ok: false, error: "إحدى الصور غير موجودة. أعد رفعها." };
    if (data.maps_url && !/(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$|^maps\.app\.goo\.gl$/.test(new URL(data.maps_url).hostname))
      return { ok: false, error: "رابط الخريطة يجب أن يكون من خرائط Google.", fieldErrors: { maps_url: "رابط خرائط Google فقط" } };
    const savedId = await saveHotel(
      { ...data, media: [...new Set(data.media)], room_types: data.room_types.map((r) => ({ ...r, id: r.id || randomUUID() })) },
      staff.id,
    );
    refreshPublic();
    return ok({ id: savedId }, data.id ? "تم حفظ الفندق." : "تمت إضافة الفندق إلى المكتبة. أضف الآن أنواع الغرف وأسعارها.");
  });
}

const rateSchema = z
  .object({
    id: z.string().max(64).nullable(),
    room_type_id: z.string().min(1, "اختر نوع الغرفة.").max(64),
    board: z.enum(BOARDS).nullable(),
    basis: z.enum(RATE_BASES),
    occupancy: int(1, 20, "عدد الأشخاص"),
    currency: z.string().refine(isCurrency, { message: "العملة غير مدعومة." }),
    cost: money.nullable(),
    price: money.refine((v) => v > 0, { message: "سعر البيع يجب أن يكون أكبر من صفر." }),
    season_ar: optText(80),
    valid_from: optDay,
    valid_to: optDay,
    active: z.boolean(),
  })
  .refine((r) => !r.valid_from || !r.valid_to || r.valid_to >= r.valid_from, { message: "نهاية فترة السعر قبل بدايتها.", path: ["valid_to"] });

/** Saves a hotel's nightly rates (price changes are written to the audit log). */
export async function saveHotelRatesAction(input: { hotel_id: number; rates: unknown[] }): Promise<ActionResult<null>> {
  return staffAction("hotels.rates", z.object({ hotel_id: id, rates: z.array(rateSchema).max(200) }), input, async (data, staff) => {
    const hotel = await getHotel(data.hotel_id);
    if (!hotel) return { ok: false, error: "الفندق غير موجود." };
    const rooms = new Set(hotel.room_types.map((r) => r.id));
    if (data.rates.some((r) => !rooms.has(r.room_type_id))) return { ok: false, error: "نوع الغرفة غير موجود. احفظ أنواع الغرف أولاً." };
    for (const r of data.rates) {
      const room = hotel.room_types.find((x) => x.id === r.room_type_id)!;
      if (r.occupancy > room.max_pax) return { ok: false, error: `عدد الأشخاص في سعر «${room.name_ar}» أكبر من سعة الغرفة (${room.max_pax}).` };
    }
    // Staff who may not see costs never send them: keep the stored costs as they are.
    const keepCosts = !can(staff.role, "hotels.costs");
    const oldCost = new Map(hotel.rates.map((r) => [r.id, r.cost]));
    await saveHotelRates(
      data.hotel_id,
      data.rates.map((r) => ({ ...r, cost: keepCosts ? (r.id ? (oldCost.get(r.id) ?? null) : null) : r.cost, valid_from: r.valid_from ?? null, valid_to: r.valid_to ?? null })),
      staff.id,
    );
    return ok(null, "تم حفظ أسعار الفندق. العروض والبرامج السابقة تحتفظ بأسعارها المحفوظة.");
  });
}

/** Quick price edit from the hotels list: one rate's nightly price (and cost). */
export async function quickRateAction(input: { hotel_id: number; rate_id: string; price: number; cost: number | null }): Promise<ActionResult<null>> {
  return staffAction(
    "hotels.rates",
    z.object({ hotel_id: id, rate_id: z.string().max(64), price: money.refine((v) => v > 0, { message: "سعر البيع يجب أن يكون أكبر من صفر." }), cost: money.nullable() }),
    input,
    async (data, staff) => {
      const hotel = await getHotel(data.hotel_id);
      const rate = hotel?.rates.find((r) => r.id === data.rate_id);
      if (!hotel || !rate) return { ok: false, error: "السعر غير موجود." };
      await saveHotelRates(
        hotel._id,
        hotel.rates.map((r) => (r.id === rate.id ? { ...r, price: data.price, cost: can(staff.role, "hotels.costs") ? data.cost : r.cost } : r)),
        staff.id,
      );
      return ok(null, "تم تحديث سعر الليلة.");
    },
  );
}

export async function archiveHotelAction(input: { id: number; archived: boolean }): Promise<ActionResult<null>> {
  return staffAction("hotels.edit", z.object({ id, archived: z.boolean() }), input, async (data, staff) => {
    const hotel = await getHotel(data.id);
    if (!hotel) return { ok: false, error: "الفندق غير موجود." };
    const { _id, slug: _s, created_at: _c, updated_at: _u, rates: _r, rates_updated_at: _ru, country_code: _cc, ...rest } = hotel;
    await saveHotel({ ...rest, id: _id, status: data.archived ? "archived" : "active" }, staff.id);
    refreshPublic();
    return ok(null, data.archived ? "تمت أرشفة الفندق. لن يظهر عند إنشاء برامج جديدة." : "أُعيد تفعيل الفندق.");
  });
}

export async function deleteHotelAction(hotelId: number): Promise<ActionResult<null>> {
  return staffAction("programs.delete", id, hotelId, async (hid, staff) => {
    const problem = await deleteHotel(hid);
    if (problem) return { ok: false, error: problem };
    await audit(staff.id, "delete", "hotel", hid);
    return ok(null, "تم حذف الفندق.");
  });
}

// ------------------------------------------------------------------ Services
const serviceSchema = z.object({
  id: id.optional(),
  icon: z.enum(SERVICE_ICONS),
  name_ar: reqText(2, 80, "اسم الخدمة بالعربية"),
  name_en: reqText(2, 80, "اسم الخدمة بالإنجليزية"),
  sort: int(0, 9999, "الترتيب"),
  active: z.boolean(),
});

export async function saveServiceAction(input: z.input<typeof serviceSchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("services.edit", serviceSchema, input, async (data, staff) => {
    if (data.id && !(await getService(data.id))) return { ok: false, error: "الخدمة غير موجودة." };
    const savedId = await saveService(data);
    await audit(staff.id, data.id ? "update" : "create", "service", savedId);
    refreshPublic();
    return ok({ id: savedId }, "تم حفظ الخدمة.");
  });
}

export async function deleteServiceAction(serviceId: number): Promise<ActionResult<null>> {
  return staffAction("programs.delete", id, serviceId, async (sid, staff) => {
    const problem = await deleteService(sid);
    if (problem) return { ok: false, error: problem };
    await audit(staff.id, "delete", "service", sid);
    return ok(null, "تم حذف الخدمة.");
  });
}


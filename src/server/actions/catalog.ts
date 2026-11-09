"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { SERVICE_ICONS } from "@/lib/travel-labels";
import { get } from "../db";
import { mediaExists } from "../media";
import {
  deleteDestination,
  deleteHotel,
  deleteService,
  getDestination,
  getHotel,
  saveDestination,
  saveHotel,
  saveService,
} from "../repo/catalog";
import { audit } from "../security";
import { country, id, int, mediaId, optText, optUrl, reqText } from "../validation";
import { staffAction } from "./guard";

const refreshPublic = () => {
  revalidatePath("/", "layout");
};

// ------------------------------------------------------------------ Destinations
const destinationSchema = z.object({
  id: id.optional(),
  country_code: country,
  name_ar: reqText(2, 80, "اسم الوجهة بالعربية"),
  name_en: reqText(2, 80, "اسم الوجهة بالإنجليزية"),
  summary_ar: optText(400),
  summary_en: optText(400),
  cover_media_id: mediaId.nullable(),
  active: z.boolean(),
});

export async function saveDestinationAction(input: z.input<typeof destinationSchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("catalog.edit", destinationSchema, input, (data, staff) => {
    if (data.id && !getDestination(data.id)) return { ok: false, error: "الوجهة غير موجودة." };
    if (data.cover_media_id && !mediaExists(data.cover_media_id)) return { ok: false, error: "الصورة غير موجودة." };
    const savedId = saveDestination(data);
    audit(staff.id, data.id ? "update" : "create", "destination", savedId);
    refreshPublic();
    return ok({ id: savedId }, "تم حفظ الوجهة.");
  });
}

export async function deleteDestinationAction(destinationId: number): Promise<ActionResult<null>> {
  return staffAction("catalog.delete", id, destinationId, (did, staff) => {
    const problem = deleteDestination(did);
    if (problem) return { ok: false, error: problem };
    audit(staff.id, "delete", "destination", did);
    return ok(null, "تم حذف الوجهة.");
  });
}

// ------------------------------------------------------------------ Hotels
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
  active: z.boolean(),
  media: z.array(mediaId).max(16),
});

export async function saveHotelAction(input: z.input<typeof hotelSchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("hotels.edit", hotelSchema, input, (data, staff) => {
    if (data.id && !getHotel(data.id)) return { ok: false, error: "الفندق غير موجود." };
    if (!getDestination(data.destination_id)) return { ok: false, error: "اختر المدينة/الوجهة.", fieldErrors: { destination_id: "مطلوب" } };
    if (data.media.some((m) => !mediaExists(m))) return { ok: false, error: "إحدى الصور غير موجودة. أعد رفعها." };
    if (data.maps_url && !/(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$|^maps\.app\.goo\.gl$/.test(new URL(data.maps_url).hostname))
      return { ok: false, error: "رابط الخريطة يجب أن يكون من خرائط Google.", fieldErrors: { maps_url: "رابط خرائط Google فقط" } };
    const savedId = saveHotel({ ...data, media: [...new Set(data.media)] });
    audit(staff.id, data.id ? "update" : "create", "hotel", savedId);
    refreshPublic();
    return ok({ id: savedId }, "تم حفظ الفندق.");
  });
}

export async function deleteHotelAction(hotelId: number): Promise<ActionResult<null>> {
  return staffAction("catalog.delete", id, hotelId, (hid, staff) => {
    const problem = deleteHotel(hid);
    if (problem) return { ok: false, error: problem };
    audit(staff.id, "delete", "hotel", hid);
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
  return staffAction("catalog.edit", serviceSchema, input, (data, staff) => {
    if (data.id && !get("SELECT 1 FROM services WHERE id = ?", data.id)) return { ok: false, error: "الخدمة غير موجودة." };
    const savedId = saveService(data);
    audit(staff.id, data.id ? "update" : "create", "service", savedId);
    refreshPublic();
    return ok({ id: savedId }, "تم حفظ الخدمة.");
  });
}

export async function deleteServiceAction(serviceId: number): Promise<ActionResult<null>> {
  return staffAction("catalog.delete", id, serviceId, (sid, staff) => {
    const problem = deleteService(sid);
    if (problem) return { ok: false, error: problem };
    audit(staff.id, "delete", "service", sid);
    return ok(null, "تم حذف الخدمة.");
  });
}

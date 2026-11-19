import "server-only";
import { randomUUID } from "node:crypto";
import { del, get, put } from "@vercel/blob";
import sharp, { type Metadata } from "sharp";
import { MEDIA_WIDTHS, type MediaRef } from "@/lib/media";
import { col, now } from "./db";

/**
 * Uploaded images live in Vercel Blob (BLOB_READ_WRITE_TOKEN, under "media/") and are served
 * same-origin by app/media/[file]/route.ts, so page URLs never depend on the storage provider.
 * BLOB_ACCESS must match the store type chosen when creating it: "private" (default) or "public".
 */
const BLOB_PREFIX = "media/";
const BLOB_ACCESS: "private" | "public" = process.env.BLOB_ACCESS === "public" ? "public" : "private";
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif", "gif", "tiff"]);
const FILE_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(\d{2,4})\.webp$/;

export class UploadError extends Error {}

export interface MediaDoc {
  _id: string;
  original_name: string | null;
  kind: "photo" | "logo";
  width: number;
  height: number;
  widths: number[];
  blur: string;
  bytes: number;
  alt_ar: string | null;
  alt_en: string | null;
  uploaded_by: number | null;
  created_at: string;
}

const media = () => col<MediaDoc>("media");

/**
 * Validates and stores an uploaded image. The bytes are decoded and re-encoded by sharp
 * (EXIF orientation applied, metadata stripped), so only clean WebP files are ever served,
 * whatever the upload contained.
 */
export async function storeImage(bytes: Buffer, originalName: string, userId: number, kind: "photo" | "logo" = "photo"): Promise<MediaRef> {
  if (bytes.length === 0) throw new UploadError("الملف فارغ.");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new UploadError("حجم الصورة أكبر من 12 ميغابايت.");

  let meta: Metadata;
  try {
    meta = await sharp(bytes, { limitInputPixels: 60_000_000 }).metadata();
  } catch {
    throw new UploadError("الملف ليس صورة صالحة.");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format) || !meta.width || !meta.height) throw new UploadError("صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP.");
  if (kind === "photo" && (meta.width < 400 || meta.height < 260)) throw new UploadError("الصورة صغيرة جداً. يُفضّل عرض 1600 بكسل على الأقل.");
  if (kind === "logo" && (meta.width < 64 || meta.height < 32)) throw new UploadError("الشعار صغير جداً. يُفضّل عرض 400 بكسل على الأقل.");

  const id = randomUUID();
  const base = () => sharp(bytes, { limitInputPixels: 60_000_000, animated: false }).rotate();

  // Oriented dimensions (EXIF rotation can swap width and height).
  const swapped = (meta.orientation ?? 1) >= 5;
  const width = swapped ? meta.height : meta.width;
  const height = swapped ? meta.width : meta.height;

  // Standard widths below the original, plus the original (capped at the largest standard width).
  const largest = Math.min(width, MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1]);
  // Logos keep transparency and are never upscaled; one 480px (or smaller) variant is enough.
  const unique = kind === "logo" ? [Math.min(width, 480)] : [...MEDIA_WIDTHS.filter((w) => w < largest), largest];

  let total = 0;
  for (const w of unique) {
    const out = await base().resize({ width: w, withoutEnlargement: true }).webp(kind === "logo" ? { quality: 92, alphaQuality: 100, effort: 5 } : { quality: 80, effort: 5 }).toBuffer();
    total += out.length;
    await put(`${BLOB_PREFIX}${id}-${w}.webp`, out, { access: BLOB_ACCESS, contentType: "image/webp", addRandomSuffix: false, cacheControlMaxAge: 31_536_000 });
  }
  const blurBuf = await base().resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
  const blur = `data:image/webp;base64,${blurBuf.toString("base64")}`;

  await (await media()).insertOne({
    _id: id,
    original_name: originalName.slice(0, 200),
    kind,
    width,
    height,
    widths: unique,
    blur,
    bytes: total,
    alt_ar: null,
    alt_en: null,
    uploaded_by: userId,
    created_at: now(),
  });
  return { id, width, height, widths: unique, blur };
}

const PROJECTION = { width: 1, height: 1, widths: 1, blur: 1, original_name: 1, kind: 1 } as const;
const toRef = (r: Pick<MediaDoc, "_id" | "width" | "height" | "widths" | "blur">, alt?: string | null): MediaRef => ({
  id: r._id,
  width: r.width,
  height: r.height,
  widths: r.widths,
  blur: r.blur,
  alt: alt ?? null,
});

export async function mediaById(id: string | null | undefined): Promise<MediaRef | null> {
  if (!id) return null;
  const r = await (await media()).findOne({ _id: id }, { projection: PROJECTION });
  return r ? toRef(r) : null;
}

export async function mediaByIds(ids: (string | null | undefined)[]): Promise<Map<string, MediaRef>> {
  const unique = [...new Set(ids.filter((m): m is string => !!m))];
  if (!unique.length) return new Map();
  const rows = await (await media()).find({ _id: { $in: unique } }, { projection: PROJECTION }).toArray();
  return new Map(rows.map((r) => [r._id, toRef(r)]));
}

/** Ordered MediaRefs for a list of ids (missing ones dropped). */
export async function mediaList(ids: string[]): Promise<MediaRef[]> {
  const map = await mediaByIds(ids);
  return ids.map((m) => map.get(m)).filter((m): m is MediaRef => !!m);
}

/** True when every id exists. */
export async function mediaExist(ids: (string | null | undefined)[]): Promise<boolean> {
  const unique = [...new Set(ids.filter((m): m is string => !!m))];
  if (!unique.length) return true;
  return (await (await media()).countDocuments({ _id: { $in: unique } })) === unique.length;
}

/** Recent uploads for the staff media picker. */
export async function recentMedia(limit = 60, kind?: "photo" | "logo"): Promise<(MediaRef & { original_name: string | null })[]> {
  const rows = await (await media())
    .find(kind ? { kind } : {}, { projection: PROJECTION })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
  return rows.map((r) => ({ ...toRef(r), original_name: r.original_name }));
}

/** Streams one stored variant (file names are validated against a strict pattern first). */
export async function readMediaFile(file: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null> {
  if (!FILE_PATTERN.test(file)) return null;
  try {
    const r = await get(`${BLOB_PREFIX}${file}`, { access: BLOB_ACCESS });
    return r && r.statusCode === 200 ? { stream: r.stream, size: r.blob.size } : null;
  } catch (error) {
    console.error("[media]", error);
    return null;
  }
}

export async function deleteMediaFiles(ref: MediaRef) {
  await del(ref.widths.map((w) => `${BLOB_PREFIX}${ref.id}-${w}.webp`)).catch(() => undefined);
}

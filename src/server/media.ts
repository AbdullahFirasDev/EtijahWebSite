import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { MEDIA_WIDTHS, type MediaRef } from "@/lib/media";
import { all, get, now, placeholders, run } from "./db";

/** Uploaded images live outside public/ and are served by app/media/[file]/route.ts. */
export const MEDIA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.MEDIA_DIR || path.join(process.cwd(), "storage", "media"));
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif", "gif", "tiff"]);
const FILE_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(\d{3,4})\.webp$/;

export class UploadError extends Error {}

interface MediaRow {
  id: string;
  width: number;
  height: number;
  widths: string;
  blur: string;
  alt_ar: string | null;
  alt_en: string | null;
}

/**
 * Validates and stores an uploaded image. The bytes are decoded and re-encoded by sharp
 * (EXIF orientation applied, metadata stripped), so only clean WebP files are ever served,
 * whatever the upload contained.
 */
export async function storeImage(bytes: Buffer, originalName: string, userId: number): Promise<MediaRef> {
  if (bytes.length === 0) throw new UploadError("الملف فارغ.");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new UploadError("حجم الصورة أكبر من 12 ميغابايت.");

  let meta: Metadata;
  try {
    meta = await sharp(bytes, { limitInputPixels: 60_000_000 }).metadata();
  } catch {
    throw new UploadError("الملف ليس صورة صالحة.");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format) || !meta.width || !meta.height) throw new UploadError("صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP.");
  if (meta.width < 400 || meta.height < 260) throw new UploadError("الصورة صغيرة جداً. يُفضّل عرض 1600 بكسل على الأقل.");

  const id = randomUUID();
  await mkdir(MEDIA_DIR, { recursive: true });
  const base = () => sharp(bytes, { limitInputPixels: 60_000_000, animated: false }).rotate();

  // Oriented dimensions (EXIF rotation can swap width and height).
  const swapped = (meta.orientation ?? 1) >= 5;
  const width = swapped ? meta.height : meta.width;
  const height = swapped ? meta.width : meta.height;

  // Standard widths below the original, plus the original (capped at the largest standard width).
  const largest = Math.min(width, MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1]);
  const unique = [...MEDIA_WIDTHS.filter((w) => w < largest), largest];

  let total = 0;
  for (const w of unique) {
    const out = await base().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer();
    total += out.length;
    await writeFile(path.join(MEDIA_DIR, `${id}-${w}.webp`), out);
  }
  const blurBuf = await base().resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
  const blur = `data:image/webp;base64,${blurBuf.toString("base64")}`;

  run(
    "INSERT INTO media (id, original_name, width, height, widths, blur, bytes, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    originalName.slice(0, 200),
    width,
    height,
    JSON.stringify(unique),
    blur,
    total,
    userId,
    now(),
  );
  return { id, width, height, widths: unique, blur };
}

const toRef = (r: MediaRow, alt?: string | null): MediaRef => ({
  id: r.id,
  width: r.width,
  height: r.height,
  widths: JSON.parse(r.widths) as number[],
  blur: r.blur,
  alt: alt ?? null,
});

export function mediaById(id: string | null | undefined): MediaRef | null {
  if (!id) return null;
  const r = get<MediaRow>("SELECT id, width, height, widths, blur, alt_ar, alt_en FROM media WHERE id = ?", id);
  return r ? toRef(r) : null;
}

export function mediaByIds(ids: string[]): Map<string, MediaRef> {
  if (!ids.length) return new Map();
  const rows = all<MediaRow>(`SELECT id, width, height, widths, blur, alt_ar, alt_en FROM media WHERE id IN (${placeholders(ids.length)})`, ...ids);
  return new Map(rows.map((r) => [r.id, toRef(r)]));
}

export const mediaExists = (id: string) => !!get("SELECT 1 FROM media WHERE id = ?", id);

/** Recent uploads for the staff media picker. */
export function recentMedia(limit = 60): (MediaRef & { original_name: string | null })[] {
  return all<MediaRow & { original_name: string | null }>(
    "SELECT id, width, height, widths, blur, alt_ar, alt_en, original_name FROM media ORDER BY created_at DESC LIMIT ?",
    limit,
  ).map((r) => ({ ...toRef(r), original_name: r.original_name }));
}

export async function readMediaFile(file: string): Promise<Buffer | null> {
  const match = FILE_PATTERN.exec(file);
  if (!match) return null;
  try {
    return await readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ MEDIA_DIR, file));
  } catch {
    return null;
  }
}

export async function deleteMediaFiles(ref: MediaRef) {
  await Promise.all(ref.widths.map((w) => unlink(path.join(MEDIA_DIR, `${ref.id}-${w}.webp`)).catch(() => undefined)));
}

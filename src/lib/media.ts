import { asset } from "./asset";

/** What pages need to render an uploaded image (never includes uploader or file-system details). */
export interface MediaRef {
  id: string;
  width: number;
  height: number;
  widths: number[];
  blur: string;
  alt?: string | null;
}

export const MEDIA_WIDTHS = [480, 960, 1600] as const;

export const mediaUrl = (id: string, width: number) => asset(`/media/${id}-${width}.webp`);

export function mediaSrcSet(m: MediaRef) {
  return m.widths.map((w) => `${mediaUrl(m.id, w)} ${w}w`).join(", ");
}

/** Largest variant up to `max` px wide. */
export function mediaSrc(m: MediaRef, max = 960) {
  const w = [...m.widths].sort((a, b) => a - b).filter((x) => x <= max).pop() ?? m.widths[0];
  return mediaUrl(m.id, w);
}

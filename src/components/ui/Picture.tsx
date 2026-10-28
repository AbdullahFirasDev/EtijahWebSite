import images from "@/data/images.json";
import { asset } from "@/lib/asset";

export type ImageName = keyof typeof images;

interface PictureProps {
  name: ImageName;
  alt: string;
  /** The `sizes` attribute; describe the rendered width at each breakpoint. */
  sizes: string;
  className?: string;
  /** Above-the-fold image: load eagerly with high fetch priority. */
  priority?: boolean;
  /** Decorative image (empty alt, hidden from assistive tech). */
  decorative?: boolean;
}

const srcSet = (name: ImageName, ext: "avif" | "webp") =>
  images[name].widths.map((w) => `${asset(`/images/${name}-${w}.${ext}`)} ${w}w`).join(", ");

/** Returns the AVIF srcset of an image, for preloading the LCP image. */
export const avifSrcSet = (name: ImageName) => srcSet(name, "avif");

/**
 * Responsive <picture> backed by pre-generated AVIF/WebP variants (scripts/optimize-images.mjs).
 * The static export has no image optimizer, so variants are produced at build time instead.
 */
export function Picture({ name, alt, sizes, className, priority = false, decorative = false }: PictureProps) {
  const meta = images[name];
  const fallbackWidth = meta.widths[Math.min(2, meta.widths.length - 1)];

  return (
    <picture>
      <source type="image/avif" srcSet={srcSet(name, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(name, "webp")} sizes={sizes} />
      <img
        src={asset(`/images/${name}-${fallbackWidth}.webp`)}
        width={meta.width}
        height={meta.height}
        alt={decorative ? "" : alt}
        aria-hidden={decorative || undefined}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding={priority ? "sync" : "async"}
        className={className}
        style={{ backgroundImage: `url(${meta.blur})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
    </picture>
  );
}

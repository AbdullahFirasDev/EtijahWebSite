import { mediaSrc, mediaSrcSet, type MediaRef } from "@/lib/media";

interface Props {
  media: MediaRef;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  /** Largest variant used as the fallback src. */
  max?: number;
}

/** Responsive uploaded image (WebP variants + blurred placeholder). */
export function MediaImage({ media, alt, sizes, className, priority, max = 960 }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaSrc(media, max)}
      srcSet={mediaSrcSet(media)}
      sizes={sizes}
      width={media.width}
      height={media.height}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding={priority ? "sync" : "async"}
      className={className}
      style={{ backgroundImage: `url(${media.blur})`, backgroundSize: "cover", backgroundPosition: "center" }}
    />
  );
}

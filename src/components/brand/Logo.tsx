import type { Locale } from "@/content/site";
import { MARK_COLORS as C, MARK_GRADIENTS as G, MARK_PLANE, MARK_RING, MARK_VIEWBOX } from "./etijah-mark";

interface LogoMarkProps {
  className?: string;
  /** Unique suffix so multiple marks on one page don't share gradient ids. */
  idSuffix?: string;
}

/** The Etijah symbol — blue ring and paper plane — in the logo's original colours. */
export function LogoMark({ className, idSuffix = "m" }: LogoMarkProps) {
  const id = `etijah-${idSuffix}`;
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-ring`} gradientUnits="userSpaceOnUse" x1={G.ring.x1} y1={G.ring.y1} x2={G.ring.x2} y2={G.ring.y2}>
          <stop offset="0" stopColor={C.ringTop} />
          <stop offset="1" stopColor={C.ringBottom} />
        </linearGradient>
        <linearGradient id={`${id}-plane`} gradientUnits="userSpaceOnUse" x1={G.plane.x1} y1={G.plane.y1} x2={G.plane.x2} y2={G.plane.y2}>
          <stop offset="0" stopColor={C.planeNose} />
          <stop offset="0.45" stopColor={C.planeMid} />
          <stop offset="1" stopColor={C.planeTail} />
        </linearGradient>
      </defs>
      <path fill={`url(#${id}-ring)`} d={MARK_RING} />
      {MARK_PLANE.map((d, i) => (
        <path key={i} fill={`url(#${id}-plane)`} d={d} />
      ))}
    </svg>
  );
}

/** The mark on a white disc, so the logo keeps its exact colours on dark surfaces too. */
export function LogoBadge({ className = "size-11 sm:size-12", idSuffix }: { className?: string; idSuffix?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_18px_-8px_rgb(5_28_51/0.45)] ring-1 ring-brand-950/5 ${className}`}>
      <LogoMark className="size-[74%]" idSuffix={idSuffix} />
    </span>
  );
}

interface LogoProps {
  locale: Locale;
  /** Surface the logo sits on; adjusts the tagline colour. */
  tone?: "light" | "dark";
  className?: string;
  badgeClassName?: string;
  idSuffix?: string;
}

/** Badge + live-text wordmark echoing the company lockup (crisp at any size, indexable). */
export function Logo({ locale, tone = "light", className, badgeClassName, idSuffix }: LogoProps) {
  const isAr = locale === "ar";
  return (
    <span className={`flex items-center gap-2.5 sm:gap-3 ${className ?? ""}`}>
      <LogoBadge className={badgeClassName} idSuffix={idSuffix} />
      <span className="flex flex-col leading-none">
        <span
          className={`bg-linear-to-b from-logo-orange to-logo-red bg-clip-text text-transparent ${
            isAr ? "pb-1 text-[1.6rem] leading-[1.05] font-black" : "text-[1.4rem] font-extrabold tracking-tight"
          }`}
        >
          {isAr ? "الاتجاه" : "Etijah"}
        </span>
        <span
          className={`text-[0.72rem] font-bold ${isAr ? "" : "mt-1 tracking-[0.12em] uppercase"} ${
            tone === "dark" ? "text-white/85" : "text-logo-blue"
          }`}
        >
          {isAr ? "للسفر والسياحة" : "Travel & Tourism"}
        </span>
      </span>
    </span>
  );
}

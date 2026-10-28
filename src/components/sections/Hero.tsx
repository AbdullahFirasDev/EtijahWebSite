import { ChevronDown, MapPin, Phone } from "lucide-react";
import type { CSSProperties } from "react";
import { preload } from "react-dom";
import { site, telUrl, whatsappUrl } from "@/content/site";
import { asset } from "@/lib/asset";
import type { Dictionary } from "@/content/types";
import { HeroMotion } from "@/components/motion/HeroMotion";
import { ButtonLink } from "@/components/ui/Button";
import { PLANE_PATH, WhatsAppIcon } from "@/components/ui/icons";
import { Picture, avifSrcSet } from "@/components/ui/Picture";

const HERO_SIZES = "100vw";

/** Stagger offset for the CSS entrance animations (see globals.css). */
const delay = (seconds: number) => ({ "--delay": `${seconds}s` }) as CSSProperties;

/** Decorative flight routes drawn in LTR coordinates; mirrored for RTL so they stay opposite the copy. */
function FlightPaths() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full rtl:-scale-x-100"
    >
      <defs>
        <linearGradient id="hero-trail" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.7" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="1" stopColor="#F7973F" />
        </linearGradient>
        <radialGradient id="hero-pin">
          <stop offset="0" stopColor="#F58220" stopOpacity="0.9" />
          <stop offset="1" stopColor="#F58220" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g fill="none" stroke="#FFFFFF" strokeWidth="1.6">
        <path data-route="main" style={delay(0.5)} className="route-dash" strokeOpacity="0.55" d="M560 940 C 760 720, 940 480, 1180 370 S 1420 250, 1520 170" />
        <path data-route style={delay(0.7)} className="route-dash" strokeOpacity="0.32" d="M840 980 C 990 780, 1180 650, 1520 610" />
        <path data-route style={delay(0.9)} className="route-dash" strokeOpacity="0.25" d="M880 70 C 1070 150, 1250 120, 1520 40" />
      </g>
      <path
        data-trail
        opacity="0"
        fill="none"
        stroke="url(#hero-trail)"
        strokeWidth="2.4"
        strokeLinecap="round"
        d="M560 940 C 760 720, 940 480, 1180 370 S 1420 250, 1520 170"
      />
      <g data-route style={delay(1.1)}>
        <circle cx="1180" cy="370" r="22" fill="url(#hero-pin)" />
        <circle cx="1180" cy="370" r="5" fill="#F58220" stroke="#FFFFFF" strokeWidth="2" />
      </g>
      <g data-plane opacity="0" fill="#FFFFFF">
        <path d={PLANE_PATH} transform="scale(1.35)" />
      </g>
    </svg>
  );
}

export function Hero({ dict }: { dict: Dictionary }) {
  const { hero } = dict;
  // Preload the LCP image (AVIF; browsers without AVIF support skip this hint).
  preload(asset("/images/hero-wing-1280.avif"), {
    as: "image",
    imageSrcSet: avifSrcSet("hero-wing"),
    imageSizes: HERO_SIZES,
    fetchPriority: "high",
    type: "image/avif",
  });

  const quick = [
    { href: telUrl, icon: <Phone className="size-5" strokeWidth={1.8} />, label: hero.call, value: <span dir="ltr" className="num">{site.phone.display}</span> },
    { href: whatsappUrl(dict.general.whatsappText), icon: <WhatsAppIcon className="size-5" />, label: hero.whatsapp, value: <span dir="ltr" className="num">{site.phone.display}</span>, external: true },
    { href: site.maps.url, icon: <MapPin className="size-5" strokeWidth={1.8} />, label: hero.location, value: hero.locationValue, external: true },
  ];

  return (
    <HeroMotion labelledBy="hero-title">
      {/* Media layer */}
      <div data-hero-media className="absolute inset-0 -z-10">
        <div className="absolute inset-0 rtl:-scale-x-100">
          <div data-hero-image className="absolute inset-0">
            <Picture
              name="hero-wing"
              alt={hero.imageAlt}
              sizes={HERO_SIZES}
              priority
              className="h-full w-full object-cover object-[55%_45%]"
            />
          </div>
        </div>
        <div className="absolute inset-0 from-brand-950/95 via-brand-900/60 to-brand-800/0 ltr:bg-linear-to-r rtl:bg-linear-to-l" />
        <div className="absolute inset-x-0 top-0 h-48 bg-linear-to-b from-brand-950/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-brand-950/90 via-brand-950/40 to-transparent" />
        <FlightPaths />
      </div>

      <div data-hero-content className="container-site relative flex flex-1 flex-col justify-center pt-32 pb-14 sm:pt-36 lg:pb-20">
        <div className="max-w-[44rem]">
          <p
            data-hero-fade
            style={delay(0.1)}
            className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/90 backdrop-blur-md"
          >
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent-400" />
              <span className="relative size-2 rounded-full bg-accent-500" />
            </span>
            {hero.eyebrow}
          </p>

          <h1 id="hero-title" className="mt-6 text-[2.6rem] leading-[1.2] font-black text-white sm:text-6xl lg:text-[4.9rem] lg:leading-[1.14]">
            <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
              <span data-hero-line style={delay(0.15)} className="block">
                {hero.titleLine1}
              </span>
            </span>
            <span className="-mb-[0.2em] block overflow-hidden pb-[0.24em]">
              <span data-hero-line style={delay(0.27)} className="block bg-linear-to-l from-accent-300 to-accent-500 bg-clip-text text-transparent ltr:bg-linear-to-r">
                {hero.titleLine2}
              </span>
            </span>
          </h1>

          <p data-hero-fade data-hero-lead style={delay(0.42)} className="mt-6 max-w-[38rem] text-[1.05rem] leading-[2] text-white/85 sm:text-lg">
            {hero.lead}
          </p>

          <div data-hero-fade style={delay(0.52)} className="mt-9 flex flex-wrap items-center gap-3 sm:gap-4">
            <ButtonLink href="#booking" size="lg" variant="accent">
              {hero.primary}
            </ButtonLink>
            <ButtonLink href="#contact" size="lg" variant="glass">
              {hero.secondary}
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="container-site relative pb-6 sm:pb-8">
        <div data-hero-fade style={delay(0.66)} className="flex items-end justify-between gap-6">
          <ul
            role="list"
            className="grid w-full grid-cols-3 divide-x divide-white/15 overflow-hidden rounded-2xl border border-white/15 bg-brand-950/35 backdrop-blur-xl lg:w-auto"
          >
            {quick.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex h-full flex-col items-center gap-1.5 px-3 py-3.5 text-center transition-colors hover:bg-white/10 sm:flex-row sm:gap-3 sm:px-5 sm:text-start"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-accent-300 transition-colors group-hover:bg-accent-500 group-hover:text-brand-950">
                    {item.icon}
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-xs font-semibold text-white/70 sm:text-[0.8rem]">{item.label}</span>
                    <span className="hidden text-sm font-bold text-white sm:block">{item.value}</span>
                  </span>
                  {item.external ? <span className="sr-only">{dict.general.opensInNewTab}</span> : null}
                </a>
              </li>
            ))}
          </ul>

          <a
            href="#services"
            className="hidden shrink-0 items-center gap-3 text-sm font-semibold text-white/75 transition-colors hover:text-white lg:flex"
          >
            {hero.scroll}
            <span className="grid size-10 place-items-center rounded-full border border-white/25">
              <ChevronDown className="size-4 motion-safe:animate-bounce" />
            </span>
          </a>
        </div>
      </div>
    </HeroMotion>
  );
}

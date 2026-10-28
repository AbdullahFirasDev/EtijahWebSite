import { Phone } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { PLANE_PATH, WhatsAppIcon } from "@/components/ui/icons";
import { Picture } from "@/components/ui/Picture";
import { site, telUrl, whatsappUrl } from "@/content/site";
import type { Dictionary } from "@/content/types";

export function FinalCta({ dict }: { dict: Dictionary }) {
  const { cta } = dict;
  return (
    <Reveal as="section" aria-labelledby="cta-title" className="surface-dark relative isolate overflow-hidden py-28 sm:py-40">
      <div className="absolute inset-0 -z-10 bg-brand-900">
        <div data-parallax="9" className="absolute inset-x-0 -inset-y-[12%]">
          <Picture name="cta-sky" alt="" decorative sizes="100vw" className="h-full w-full object-cover object-[50%_62%]" />
        </div>
        <div className="absolute inset-0 bg-linear-to-b from-brand-950/80 via-brand-900/65 to-brand-950/90" />
        <div className="absolute inset-0 bg-[radial-gradient(48rem_26rem_at_50%_55%,rgb(8_102_178/0.45),transparent_70%)]" />
      </div>

      <svg aria-hidden="true" viewBox="0 0 1440 400" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-1/2 h-[24rem] w-full -translate-y-1/2 rtl:-scale-x-100">
        <path id="cta-route" d="M-40 330 C 300 330, 520 90, 860 120 S 1280 260, 1500 60" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="1.5" className="route-dash route-flow" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="container-site relative text-center">
        <span data-reveal aria-hidden="true" className="mx-auto mb-7 grid size-16 place-items-center rounded-full border border-white/25 bg-white/10 backdrop-blur-md motion-safe:animate-float">
          <svg viewBox="0 0 24 24" className="size-7 -rotate-45 fill-accent-400 rtl:-scale-x-100">
            <path d={PLANE_PATH} />
          </svg>
        </span>
        <p data-reveal className="text-sm font-bold text-accent-300 ltr:tracking-[0.16em] ltr:uppercase">
          {cta.eyebrow}
        </p>
        <h2 id="cta-title" data-reveal className="mx-auto mt-4 max-w-3xl text-[2.25rem] leading-[1.25] font-black text-balance text-white sm:text-5xl lg:text-[3.6rem]">
          {cta.title}
        </h2>
        <p data-reveal className="mx-auto mt-6 max-w-xl text-lg leading-[1.95] text-white/85">
          {cta.lead}
        </p>
        <div data-reveal className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <ButtonLink
            href={whatsappUrl(cta.whatsappText)}
            size="lg"
            variant="accent"
            external
            newTabHint={dict.general.opensInNewTab}
            icon={<WhatsAppIcon className="size-5" />}
          >
            {cta.whatsapp}
          </ButtonLink>
          <ButtonLink href={telUrl} size="lg" variant="outline-light" icon={<Phone className="size-5" aria-hidden="true" />}>
            {cta.call}
            <span className="sr-only">
              {" "}
              <span dir="ltr">{site.phone.display}</span>
            </span>
          </ButtonLink>
        </div>
      </div>
    </Reveal>
  );
}

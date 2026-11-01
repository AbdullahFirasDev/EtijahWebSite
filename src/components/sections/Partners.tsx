import { Reveal } from "@/components/motion/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { partnerLogoSize, partnerLogoWidth, partners } from "@/content/partners";
import type { Dictionary } from "@/content/types";
import { asset } from "@/lib/asset";
import { PartnersSlider, type PartnerCard } from "./PartnersSlider";

export function Partners({ dict }: { dict: Dictionary }) {
  const copy = dict.partners;
  const cards: PartnerCard[] = partners.map((partner) => ({
    id: partner.logo,
    src: asset(`/partners/${partner.logo}.webp`),
    ...partnerLogoSize(partner.logo),
    alt: dict.locale === "ar" ? partner.nameAr : partner.nameEn,
    logoWidth: partnerLogoWidth(partner),
  }));
  const half = Math.ceil(cards.length / 2);

  return (
    <Reveal as="section" id="partners" aria-labelledby="partners-title" className="relative overflow-hidden bg-mist py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(52rem_22rem_at_50%_78%,rgb(8_102_178/0.09),transparent_70%)]"
      />
      <svg aria-hidden="true" className="pointer-events-none absolute -top-8 h-[26rem] w-[58rem] text-brand-200 ltr:-right-72 rtl:-left-72 rtl:-scale-x-100" viewBox="0 0 960 448" fill="none">
        <path className="route-dash route-flow" stroke="currentColor" strokeWidth="1.5" d="M0 430 C 260 400, 360 150, 620 120 S 900 60, 960 20" />
        <path className="route-dash" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.55" d="M140 448 C 340 410, 480 260, 720 250 S 920 200, 960 170" />
      </svg>

      <PartnersSlider rows={[cards.slice(0, half), cards.slice(half)]} rtl={dict.dir === "rtl"} labels={{ pause: copy.pause, play: copy.play }}>
        <SectionHeading id="partners-title" eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />
      </PartnersSlider>
    </Reveal>
  );
}

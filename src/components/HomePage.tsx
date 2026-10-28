import { FloatingWhatsApp } from "@/components/layout/FloatingWhatsApp";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { About } from "@/components/sections/About";
import { Contact } from "@/components/sections/Contact";
import { Destinations } from "@/components/sections/Destinations";
import { FinalCta } from "@/components/sections/FinalCta";
import { Hero } from "@/components/sections/Hero";
import { Process } from "@/components/sections/Process";
import { Services } from "@/components/sections/Services";
import { WhyEtijah } from "@/components/sections/WhyEtijah";
import type { Dictionary } from "@/content/types";
import { travelAgencyJsonLd } from "@/lib/seo";

export function HomePage({ dict }: { dict: Dictionary }) {
  const jsonLd = JSON.stringify(travelAgencyJsonLd(dict)).replace(/</g, "\u003c");
  return (
    <>
      <SmoothScroll />
      <SiteHeader dict={dict} />
      <main id="main" tabIndex={-1}>
        <Hero dict={dict} />
        <Services dict={dict} />
        <WhyEtijah dict={dict} />
        <Destinations dict={dict} />
        <Process dict={dict} />
        <About dict={dict} />
        <Contact dict={dict} />
        <FinalCta dict={dict} />
      </main>
      <SiteFooter dict={dict} />
      <FloatingWhatsApp dict={dict} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </>
  );
}

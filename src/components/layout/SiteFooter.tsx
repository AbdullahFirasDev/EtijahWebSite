import { ArrowUp, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { WhatsAppIcon } from "@/components/ui/icons";
import { site, telUrl, whatsappUrl } from "@/content/site";
import type { Dictionary, NavKey } from "@/content/types";

const NAV_ORDER: NavKey[] = ["services", "why", "destinations", "process", "about", "contact"];

export function SiteFooter({ dict }: { dict: Dictionary }) {
  const { footer, nav, contact } = dict;
  const year = new Date().getFullYear();
  const headingClass = "text-sm font-bold text-accent-300 ltr:tracking-[0.14em] ltr:uppercase";
  const linkClass = "text-white/75 transition-colors hover:text-white";

  return (
    <footer className="surface-dark relative overflow-hidden bg-brand-950 pt-20 sm:pt-24">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_24rem_at_100%_0%,rgb(8_102_178/0.35),transparent_70%)]" />

      <div className="container-site relative grid gap-12 sm:grid-cols-2 lg:grid-cols-12 lg:gap-10">
        <div className="sm:col-span-2 lg:col-span-4">
          <a href="#top" aria-label={nav.home} className="inline-block rounded-xl text-white">
            <Logo locale={dict.locale} tone="dark" idSuffix="footer" badgeClassName="size-13" />
          </a>
          <p className="mt-6 max-w-sm leading-[1.95] text-white/70">{footer.about}</p>
          <a
            href={whatsappUrl(dict.general.whatsappText)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-accent-500 px-5 font-bold text-brand-950 transition-colors hover:bg-accent-400"
          >
            <WhatsAppIcon className="size-5" />
            {nav.cta}
            <span className="sr-only">{dict.general.opensInNewTab}</span>
          </a>
        </div>

        <nav aria-labelledby="footer-nav" className="lg:col-span-2">
          <h2 id="footer-nav" className={headingClass}>
            {footer.navTitle}
          </h2>
          <ul role="list" className="mt-5 space-y-3">
            {NAV_ORDER.map((key) => (
              <li key={key}>
                <a href={`#${key}`} className={linkClass}>
                  {nav.links[key]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-3">
          <h2 className={headingClass}>{footer.servicesTitle}</h2>
          <ul role="list" className="mt-5 space-y-3">
            {dict.services.items.map((s) => (
              <li key={s.id}>
                <a href="#services" className={linkClass}>
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-3">
          <h2 className={headingClass}>{footer.contactTitle}</h2>
          <ul role="list" className="mt-5 space-y-4">
            <li>
              <a href={telUrl} className={`flex items-center gap-3 ${linkClass}`}>
                <Phone className="size-5 shrink-0 text-accent-400" strokeWidth={1.8} aria-hidden="true" />
                <span dir="ltr" className="num">
                  {site.phone.display}
                </span>
              </a>
            </li>
            <li>
              <a href={whatsappUrl(dict.general.whatsappText)} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 ${linkClass}`}>
                <WhatsAppIcon className="size-5 shrink-0 text-accent-400" />
                {contact.whatsappLabel}
                <span className="sr-only">{dict.general.opensInNewTab}</span>
              </a>
            </li>
            <li>
              <a href={site.maps.url} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-3 leading-[1.8] ${linkClass}`}>
                <MapPin className="mt-1 size-5 shrink-0 text-accent-400" strokeWidth={1.8} aria-hidden="true" />
                {contact.addressValue}
                <span className="sr-only">{dict.general.opensInNewTab}</span>
              </a>
            </li>
            {site.email ? (
              <li>
                <a href={`mailto:${site.email}`} dir="ltr" className={linkClass}>
                  {site.email}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      {/* Oversized wordmark */}
      <p
        aria-hidden="true"
        className="pointer-events-none relative mt-16 text-center text-[clamp(5rem,22vw,17rem)] leading-[0.95] font-black text-white/[0.035] select-none"
      >
        {dict.locale === "ar" ? "الاتجاه" : "ETIJAH"}
      </p>

      <div className="relative border-t border-white/10">
        <div className="container-site flex flex-col items-center justify-between gap-4 py-6 text-sm text-white/60 sm:flex-row">
          <p>
            © <span className="num">{year}</span> {dict.brand.name}. {footer.rights}
          </p>
          <div className="flex items-center gap-6">
            <a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">
              {footer.photoCredit}
              <span className="sr-only">{dict.general.opensInNewTab}</span>
            </a>
            <a href="#top" className="group inline-flex items-center gap-2 font-semibold text-white/80 transition-colors hover:text-white">
              {footer.backToTop}
              <span className="grid size-8 place-items-center rounded-full border border-white/20 transition-colors group-hover:border-accent-400 group-hover:bg-accent-500 group-hover:text-brand-950">
                <ArrowUp className="size-4" aria-hidden="true" />
              </span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

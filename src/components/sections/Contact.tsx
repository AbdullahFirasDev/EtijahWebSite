import { Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { WhatsAppIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site, telUrl, whatsappUrl } from "@/content/site";
import type { Dictionary } from "@/content/types";
import { BookingForm } from "./BookingForm";
import { MapEmbed } from "./MapEmbed";

interface ChannelProps {
  href: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  action: string;
  accent?: boolean;
  external?: boolean;
  newTabHint: string;
}

function Channel({ href, icon, label, value, action, accent, external, newTabHint }: ChannelProps) {
  return (
    <li data-reveal>
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-soft transition-[box-shadow,border-color,transform] duration-500 ease-out-expo hover:border-brand-200 hover:shadow-lift motion-safe:hover:-translate-y-0.5 sm:p-5"
      >
        <span
          className={`grid size-13 shrink-0 place-items-center rounded-xl transition-colors duration-500 ${
            accent ? "bg-accent-500 text-brand-950" : "bg-brand-600 text-white group-hover:bg-brand-700"
          }`}
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-muted">{label}</span>
          <span className="mt-0.5 text-[1.05rem] leading-[1.7] font-bold text-brand-950">{value}</span>
        </span>
        <span className="hidden shrink-0 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-bold text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white sm:inline">
          {action}
        </span>
        {external ? <span className="sr-only">{newTabHint}</span> : null}
      </a>
    </li>
  );
}

export function Contact({ dict }: { dict: Dictionary }) {
  const { contact } = dict;
  const hint = dict.general.opensInNewTab;
  return (
    <Reveal as="section" id="contact" aria-labelledby="contact-title" className="relative bg-white py-24 sm:py-32">
      <div className="container-site">
        <SectionHeading id="contact-title" eyebrow={contact.eyebrow} title={contact.title} lead={contact.lead} />

        <div className="mt-14 grid gap-8 lg:mt-16 lg:grid-cols-12 lg:gap-10">
          <div className="flex flex-col gap-6 lg:col-span-5">
            <ul role="list" className="flex flex-col gap-4">
              <Channel
                href={telUrl}
                icon={<Phone className="size-6" strokeWidth={1.8} aria-hidden="true" />}
                label={contact.phoneLabel}
                value={
                  <span dir="ltr" className="num">
                    {site.phone.display}
                  </span>
                }
                action={contact.phoneAction}
                newTabHint={hint}
              />
              <Channel
                href={whatsappUrl(dict.general.whatsappText)}
                icon={<WhatsAppIcon className="size-6" />}
                label={contact.whatsappLabel}
                value={
                  <span dir="ltr" className="num">
                    {site.phone.display}
                  </span>
                }
                action={contact.whatsappAction}
                accent
                external
                newTabHint={hint}
              />
              <Channel
                href={site.maps.url}
                icon={<MapPin className="size-6" strokeWidth={1.8} aria-hidden="true" />}
                label={contact.addressLabel}
                value={contact.addressValue}
                action={contact.addressAction}
                external
                newTabHint={hint}
              />
              {site.email ? (
                <Channel
                  href={`mailto:${site.email}`}
                  icon={<Mail className="size-6" strokeWidth={1.8} aria-hidden="true" />}
                  label={dict.locale === "ar" ? "البريد الإلكتروني" : "Email"}
                  value={
                    <span dir="ltr" className="break-all">
                      {site.email}
                    </span>
                  }
                  action={dict.locale === "ar" ? "راسلنا" : "Write to us"}
                  newTabHint={hint}
                />
              ) : null}
            </ul>
            <div data-reveal>
              <MapEmbed dict={dict} />
            </div>
          </div>

          <div id="booking" data-reveal className="rounded-[2rem] bg-mist p-6 sm:p-9 lg:col-span-7 lg:p-10">
            <h3 className="text-2xl font-extrabold text-brand-950 sm:text-[1.75rem]">{contact.form.title}</h3>
            <p className="mt-3 mb-8 leading-[1.9] text-muted">{contact.form.intro}</p>
            <BookingForm dict={dict} />
          </div>
        </div>
      </div>
    </Reveal>
  );
}

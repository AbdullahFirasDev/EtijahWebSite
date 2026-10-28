import type { DestinationId, Locale, ServiceId } from "./site";

export type NavKey = "services" | "why" | "destinations" | "process" | "about" | "contact";

export interface Dictionary {
  locale: Locale;
  dir: "rtl" | "ltr";
  meta: {
    title: string;
    description: string;
    ogAlt: string;
  };
  brand: {
    name: string;
    tagline: string;
  };
  nav: {
    links: Record<NavKey, string>;
    cta: string;
    menu: string;
    close: string;
    skip: string;
    home: string;
    language: { label: string; href: string; hrefLang: Locale; aria: string };
  };
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    lead: string;
    primary: string;
    secondary: string;
    imageAlt: string;
    call: string;
    whatsapp: string;
    location: string;
    locationValue: string;
    scroll: string;
  };
  services: {
    eyebrow: string;
    title: string;
    lead: string;
    inquire: string;
    items: { id: ServiceId; title: string; text: string; whatsapp: string }[];
  };
  why: {
    eyebrow: string;
    title: string;
    lead: string;
    imageAlt: string;
    badgeTitle: string;
    badgeText: string;
    items: { title: string; text: string }[];
  };
  destinations: {
    eyebrow: string;
    title: string;
    lead: string;
    ask: string;
    note: string;
    items: { id: DestinationId; name: string; country: string; text: string; alt: string; whatsapp: string }[];
  };
  process: {
    eyebrow: string;
    title: string;
    lead: string;
    stepLabel: string;
    steps: { title: string; text: string }[];
  };
  about: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
    highlights: string[];
    globeLabel: string;
    globeCaption: string;
    visitTitle: string;
  };
  contact: {
    eyebrow: string;
    title: string;
    lead: string;
    phoneLabel: string;
    phoneAction: string;
    whatsappLabel: string;
    whatsappValue: string;
    whatsappAction: string;
    addressLabel: string;
    addressValue: string;
    addressAction: string;
    map: { title: string; load: string; note: string; open: string };
    form: {
      title: string;
      intro: string;
      required: string;
      optional: string;
      fields: {
        name: string;
        phone: string;
        phoneHint: string;
        service: string;
        servicePlaceholder: string;
        destination: string;
        destinationPlaceholder: string;
        date: string;
        travelers: string;
        message: string;
        messagePlaceholder: string;
      };
      errors: {
        summary: string;
        nameRequired: string;
        nameShort: string;
        serviceRequired: string;
        phoneInvalid: string;
        datePast: string;
        dateInvalid: string;
        travelersInvalid: string;
        messageLong: string;
      };
      submit: string;
      privacy: string;
      successTitle: string;
      successText: string;
      successRetry: string;
      newRequest: string;
      template: {
        greeting: string;
        name: string;
        phone: string;
        service: string;
        destination: string;
        date: string;
        travelers: string;
        message: string;
      };
    };
  };
  cta: {
    eyebrow: string;
    title: string;
    lead: string;
    whatsapp: string;
    call: string;
    whatsappText: string;
  };
  footer: {
    about: string;
    navTitle: string;
    servicesTitle: string;
    contactTitle: string;
    rights: string;
    backToTop: string;
    photoCredit: string;
  };
  floating: {
    label: string;
    text: string;
  };
  general: {
    whatsappText: string;
    opensInNewTab: string;
  };
}

// Program → formatted plain text for WhatsApp, Telegram and e-mail. *bold* is WhatsApp/Telegram
// markdown and reads naturally elsewhere. Built from the public read model only, so internal
// costs, margins and notes can never appear in it.
import type { Locale } from "@/content/site";
import { site } from "@/content/site";
import type { ProgramDetail } from "@/server/repo/programs";
import { formatDay } from "./dates";
import { formatMoney } from "./money";
import { BOARD_LABELS, RATE_BASIS_LABELS, TYPE_LABELS } from "./travel-labels";

const T = {
  ar: {
    days: (d: number, n: number) => `${d} ${d === 1 ? "يوم" : d <= 10 ? "أيام" : "يوماً"} / ${n} ${n === 1 ? "ليلة" : n <= 10 ? "ليالٍ" : "ليلة"}`,
    departure: "المغادرة",
    ret: "العودة",
    seats: (n: number) => `${n} مقعد متاح`,
    full: "مكتمل",
    airport: "مطار المغادرة",
    airlines: "الطيران",
    flights: "الرحلات الجوية",
    about: "نبذة عن البرنامج",
    hotels: "خيارات الفنادق والأسعار",
    room: "الغرفة",
    persons: (n: number) => `${n} ${n === 1 ? "شخص" : n === 2 ? "شخصان" : "أشخاص"}`,
    nights: (n: number) => `${n} ${n === 1 ? "ليلة" : n <= 10 ? "ليالٍ" : "ليلة"}`,
    night: "سعر الليلة",
    stay: "الإقامة للشخص",
    total: "السعر الإجمالي للشخص",
    from: "السعر يبدأ من",
    perPerson: "للشخص",
    extra: "أسعار إضافية",
    itinerary: "البرنامج اليومي",
    day: "اليوم",
    included: "يشمل السعر",
    excluded: "لا يشمل السعر",
    meals: "الوجبات",
    terms: "الشروط والملاحظات",
    custom: "برنامج خاص حسب طلبك: نحدد معك الموعد والفندق والميزانية، ثم نرسل لك عرض سعر نهائياً.",
    book: "للحجز والاستفسار",
    link: "التفاصيل والحجز",
    supplement: "فرق سعر لهذا الموعد",
    direction: { outbound: "ذهاب", return: "عودة", internal: "داخلي" },
  },
  en: {
    days: (d: number, n: number) => `${d} day${d === 1 ? "" : "s"} / ${n} night${n === 1 ? "" : "s"}`,
    departure: "Departure",
    ret: "Return",
    seats: (n: number) => `${n} seat${n === 1 ? "" : "s"} left`,
    full: "Sold out",
    airport: "Departure airport",
    airlines: "Airline",
    flights: "Flights",
    about: "About the trip",
    hotels: "Hotel options & prices",
    room: "Room",
    persons: (n: number) => `${n} person${n === 1 ? "" : "s"}`,
    nights: (n: number) => `${n} night${n === 1 ? "" : "s"}`,
    night: "Per night",
    stay: "Stay per person",
    total: "Total per person",
    from: "From",
    perPerson: "per person",
    extra: "Other prices",
    itinerary: "Day by day",
    day: "Day",
    included: "Included",
    excluded: "Not included",
    meals: "Meals",
    terms: "Terms & notes",
    custom: "Tailor-made trip: we agree the dates, hotel and budget with you, then send a final quote.",
    book: "Bookings & questions",
    link: "Details & booking",
    supplement: "Price difference for this date",
    direction: { outbound: "Outbound", return: "Return", internal: "Internal" },
  },
};

export function programText(p: ProgramDetail, locale: Locale, link: string | null): string {
  const t = T[locale];
  const money = (n: number) => formatMoney(n, p.currency, locale);
  const lines: string[] = [];
  const blank = () => lines.push("");
  const section = (title: string) => {
    blank();
    lines.push(`*${title}*`);
  };

  lines.push(`✈️ *${p.title}*`);
  lines.push(`${TYPE_LABELS[p.type][locale]} · ${p.code}`);
  const where = [p.countries.map((c) => c.name).join(locale === "ar" ? "، " : ", "), p.places.join(locale === "ar" ? "، " : ", ")].filter(Boolean).join(" — ");
  if (where) lines.push(`📍 ${where}`);
  lines.push(`🗓️ ${t.days(p.days, p.nights)}`);
  if (p.type === "fixed") {
    for (const d of p.departures.slice(0, 6)) {
      const seats = d.soldOut ? t.full : t.seats(d.seatsLeft);
      const sup = d.priceSupplement ? ` · ${t.supplement}: ${d.priceSupplement > 0 ? "+" : "−"}${money(Math.abs(d.priceSupplement))}` : "";
      lines.push(`📅 ${t.departure}: ${formatDay(d.departDate, locale)} ← ${t.ret}: ${formatDay(d.returnDate, locale)} (${seats})${sup}`);
    }
  }
  if (p.departureAirport) lines.push(`🛫 ${t.airport}: ${p.departureAirport}`);
  if (p.airlines.length) lines.push(`🛩️ ${t.airlines}: ${p.airlines.map((a) => a.name).join(locale === "ar" ? "، " : ", ")}`);

  if (p.flights.length) {
    section(t.flights);
    for (const f of p.flights)
      lines.push(
        `• ${t.direction[f.direction]}${f.airline ? ` · ${f.airline}` : ""}${f.flightNo ? ` ${f.flightNo}` : ""}${f.from || f.to ? ` · ${f.from ?? ""} → ${f.to ?? ""}` : ""}${f.departTime ? ` · ${f.departTime}` : ""}${f.arriveTime ? `–${f.arriveTime}` : ""}`,
      );
  }

  if (p.summary || p.description) {
    section(t.about);
    lines.push((p.description || p.summary)!.trim());
  }

  if (p.hotelChoices.length) {
    section(`🏨 ${t.hotels}`);
    p.hotelChoices.forEach((h, i) => {
      const stars = h.hotel.stars ? ` ${"⭐".repeat(h.hotel.stars)}` : "";
      lines.push(`${i + 1}) *${h.hotel.name}*${stars} — ${h.hotel.city}`);
      const room = [h.room, t.persons(h.occupancy), h.board ? BOARD_LABELS[h.board][locale] : null, t.nights(h.nights)].filter(Boolean).join(" · ");
      lines.push(`   ${t.room}: ${room}`);
      if (h.nightPrice != null && h.hotelPerPerson != null) lines.push(`   ${t.night}: ${money(h.nightPrice)} ${RATE_BASIS_LABELS[h.basis][locale]} · ${t.stay}: ${money(h.hotelPerPerson)}`);
      if (h.pricePerPerson != null) lines.push(`   💰 ${t.total}: *${money(h.pricePerPerson)}*`);
      if (h.note) lines.push(`   ${h.note}`);
      const url = h.hotel.websiteUrl || h.hotel.mapsUrl;
      if (url) lines.push(`   🔗 ${url}`);
    });
  } else if (p.type === "fixed" && p.priceFrom) {
    blank();
    lines.push(`💰 ${t.from}: *${money(p.priceFrom)}* ${t.perPerson}`);
  }
  if (p.priceNote) lines.push(p.priceNote);
  if (p.extraPrices.length) {
    section(t.extra);
    for (const x of p.extraPrices) lines.push(`• ${x.label}: ${money(x.amount)}`);
  }
  if (p.type === "custom") {
    blank();
    lines.push(`✨ ${t.custom}`);
  }

  if (p.itinerary.length) {
    section(`🧭 ${t.itinerary}`);
    for (const d of p.itinerary) {
      lines.push(`${t.day} ${d.day}: ${d.title}`);
      if (d.body) lines.push(`   ${d.body.replace(/\n+/g, "\n   ")}`);
    }
  }
  if (p.included.length) {
    section(`✅ ${t.included}`);
    for (const s of p.included) lines.push(`• ${s.name}${s.note ? ` — ${s.note}` : ""}`);
  }
  if (p.excluded.length) {
    section(`❌ ${t.excluded}`);
    for (const s of p.excluded) lines.push(`• ${s.name}${s.note ? ` — ${s.note}` : ""}`);
  }
  if (p.meals) {
    blank();
    lines.push(`🍽️ ${t.meals}: ${p.meals}`);
  }
  if (p.terms) {
    section(`📌 ${t.terms}`);
    lines.push(p.terms.trim());
  }

  blank();
  lines.push(`📞 ${t.book}: ${site.phone.display}`);
  if (link) lines.push(`🔗 ${t.link}: ${link}`);
  lines.push(locale === "ar" ? site.nameAr : site.nameEn);
  return lines.join("\n");
}

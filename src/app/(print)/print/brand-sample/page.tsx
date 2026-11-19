import { notFound } from "next/navigation";
import { QuotePrintView } from "@/components/quote/QuotePrintView";
import { addDays, todayDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { quoteTotals } from "@/lib/quote-math";
import { getStaff } from "@/server/auth/session";
import { getCompany } from "@/server/repo/companies";
import { resolveBrand, type QuoteView } from "@/server/repo/quotes";
import { getSettings } from "@/server/repo/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "معاينة قالب PDF" };

/**
 * Template preview: the unified quote layout in a company's identity, filled with sample text
 * that is clearly marked as a sample. Staff only; never sent to anyone.
 */
export default async function BrandSamplePage({ searchParams }: { searchParams: Promise<{ company?: string; lang?: string }> }) {
  const staff = await getStaff();
  if (!staff || !(can(staff.role, "b2b.view") || can(staff.role, "settings.manage"))) notFound();
  const sp = await searchParams;
  const locale = sp.lang === "en" ? "en" : "ar";
  const company = /^\d+$/.test(sp.company ?? "") ? await getCompany(Number(sp.company)) : null;
  const settings = await getSettings();
  const brand = await resolveBrand(company ? "company" : "etijah", company, locale, settings);
  const ar = locale === "ar";
  const items = [
    { kind: "main" as const, label: ar ? "نموذج: البرنامج مع الإقامة (للشخص)" : "Sample: program with stay (per person)", description: null, unit: "person" as const, quantity: 2, unitPrice: 95000, total: 190000 },
    { kind: "fee" as const, label: ar ? "نموذج: رسوم التأشيرة" : "Sample: visa fees", description: null, unit: "person" as const, quantity: 2, unitPrice: 5000, total: 10000 },
  ];
  const totals = quoteTotals({ items: items.map((i) => ({ kind: i.kind, quantity: i.quantity, unit_price: i.unitPrice })), discount_kind: null, discount_value: 0, adults: 2, children: 0, rooms: 1, pricing_mode: "per_person" });
  const q: QuoteView = {
    ref: "QT-SAMPLE",
    revision: 1,
    locale,
    status: "sent",
    canRespond: false,
    audience: "company",
    title: ar ? "نموذج للمعاينة فقط — عنوان العرض" : "Preview sample only — offer title",
    destination: ar ? "الوجهة" : "Destination",
    intro: ar ? "هذه صفحة نموذجية لمعاينة الهوية البصرية (الشعار والألوان والاسم وبيانات التواصل) على القالب الموحد. ليست عرضاً حقيقياً." : "Sample page to preview the visual identity on the unified template. Not a real offer.",
    startDate: addDays(todayDay(), 30),
    endDate: addDays(todayDay(), 37),
    adults: 2,
    children: 0,
    infants: 0,
    rooms: 1,
    roomsNote: null,
    currency: settings.default_currency,
    pricingMode: "per_person",
    items,
    totals,
    discount: null,
    inclusions: [ar ? "مثال على خدمة مشمولة" : "Example included service"],
    exclusions: [ar ? "مثال على خدمة غير مشمولة" : "Example excluded service"],
    notes: null,
    terms: company?.terms ?? (ar ? settings.quote_terms_ar : settings.quote_terms_en),
    validUntil: addDays(todayDay(), settings.quote_validity_days),
    issuedAt: new Date().toISOString(),
    respondedAt: null,
    responseName: null,
    recipient: { name: ar ? "اسم العميل (نموذج)" : "Client name (sample)", contact: null },
    beneficiary: { name: ar ? "الجهة المستفيدة (نموذج)" : "Beneficiary (sample)", note: null },
    brand,
    preparedBy: null,
    cover: null,
    gallery: [],
    showHotelPhotos: settings.pdf_show_hotel_photos,
    footerNote: (ar ? settings.pdf_footer_note_ar : settings.pdf_footer_note_en) || null,
    days: [{ day: 1, title: ar ? "اليوم الأول (نموذج)" : "Day 1 (sample)", body: null }],
    hotels: [],
  };
  return <QuotePrintView q={q} token="sample" onlineUrl={null} showToolbar={false} />;
}

import { QuoteEditor, type QuoteFormState } from "@/components/staff/QuoteEditor";
import { PageHeader } from "@/components/staff/ui";
import { addDays, todayDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { b2bRequestDraftAction, leadDraftForQuoteAction } from "@/server/actions/quotes";
import { requireStaffPage } from "@/server/auth/session";
import { getCompany } from "@/server/repo/companies";
import { quoteEditorOptions } from "@/server/quote-editor-data";

export const metadata = { title: "عرض سعر جديد" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ company?: string; lead?: string; request?: string }> }) {
  const staff = await requireStaffPage("quotes.manage");
  const sp = await searchParams;
  const o = await quoteEditorOptions();
  const base: QuoteFormState = {
    audience: "company",
    branding: "company",
    lead_id: null,
    b2b_request_id: null,
    client: null,
    beneficiary: null,
    company_id: null,
    contact_id: null,
    program_id: null,
    locale: "ar",
    title: "",
    destination: null,
    destinations: [],
    intro: null,
    start_date: null,
    end_date: null,
    adults: 2,
    children: 0,
    infants: 0,
    rooms: 1,
    rooms_note: null,
    currency: o.settings.default_currency,
    pricing_mode: "per_person",
    discount_kind: null,
    discount_value: 0,
    discount_label: null,
    inclusions: [],
    exclusions: [],
    notes: null,
    terms: o.settings.quote_terms_ar,
    internal_notes: null,
    cover: null,
    gallery: [],
    valid_until: addDays(todayDay(), o.settings.quote_validity_days),
    days: [],
    hotels: [],
    items: [],
  };

  let initial = base;
  let title = "عرض سعر جديد";
  let description = "يُحفظ كمسودة خاصة. لا يراه أحد خارج الفريق حتى ترسله.";

  if (sp.lead && /^\d+$/.test(sp.lead)) {
    // Traveler quote answering a (tailor-made) trip request.
    const d = await leadDraftForQuoteAction(Number(sp.lead));
    if (d.ok) {
      const nights = d.data.nights;
      initial = {
        ...base,
        ...d.data,
        audience: "traveler",
        branding: "etijah",
        terms: d.data.locale === "en" ? o.settings.quote_terms_en : o.settings.quote_terms_ar,
        hotels: [],
        rooms_note: nights ? `${nights} ليالٍ` : null,
      };
      delete (initial as Partial<typeof d.data>).nights;
      title = "عرض سعر لطلب مسافر";
      description = "ابنِ البرنامج بفنادق المكتبة وخدماتها، ثم احفظ وأرسل الرابط أو ملف PDF للمسافر. لا يُعرض سعر نهائي قبل اعتمادك.";
    }
  } else if (sp.request && /^\d+$/.test(sp.request)) {
    // Company quote answering a partner portal request.
    const d = await b2bRequestDraftAction(Number(sp.request));
    if (d.ok) {
      const c = o.companies.find((x) => x.id === d.data.company_id);
      const company = await getCompany(d.data.company_id);
      initial = {
        ...base,
        audience: "company",
        branding: c?.hasLogo ? "company" : "etijah",
        company_id: d.data.company_id,
        contact_id: c?.contacts.find((x) => x.is_primary)?.id ?? c?.contacts[0]?.id ?? null,
        b2b_request_id: d.data.b2b_request_id,
        title: d.data.title,
        destination: d.data.destination,
        destinations: d.data.destinations,
        start_date: d.data.start_date,
        end_date: d.data.end_date,
        adults: d.data.adults,
        children: d.data.children,
        rooms: d.data.rooms,
        beneficiary: d.data.beneficiary ? { name: d.data.beneficiary, note: null } : null,
        internal_notes: d.data.internal_notes,
        terms: company?.terms ?? base.terms,
        hotels: d.data.hotel_ids.map((id) => ({ id: null, hotel_id: id, check_in: d.data.start_date, check_out: d.data.end_date, nights: 1, room_type: null, board: "BB", rooms: null, rate: null })),
      };
      title = "عرض سعر لطلب شركة";
      description = "طلب من بوابة الشركة. سيُربط العرض بالطلب ويُحدّث حالته عند الإرسال.";
    }
  } else if (sp.company && /^\d+$/.test(sp.company)) {
    const c = o.companies.find((x) => x.id === Number(sp.company));
    const company = c ? await getCompany(c.id) : null;
    if (c) {
      initial = {
        ...base,
        company_id: c.id,
        contact_id: c.contacts.find((x) => x.is_primary)?.id ?? c.contacts[0]?.id ?? null,
        branding: c.hasLogo ? "company" : "etijah",
        terms: company?.terms ?? base.terms,
      };
      title = `عرض سعر للشركة: ${c.name}`;
    }
  }

  return (
    <>
      <PageHeader title={title} description={description} back={{ href: "/staff/quotes/", label: "عروض الأسعار" }} />
      <QuoteEditor
        meta={null}
        companies={o.companies}
        programs={o.programs}
        hotels={o.hotels}
        places={o.places}
        tours={o.tours}
        currencies={o.currencies}
        defaultTerms={{ ar: o.settings.quote_terms_ar, en: o.settings.quote_terms_en }}
        canDelete={can(staff.role, "b2b.delete")}
        initial={initial}
      />
    </>
  );
}

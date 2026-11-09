import { QuoteEditor } from "@/components/staff/QuoteEditor";
import { PageHeader } from "@/components/staff/ui";
import { addDays, todayDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { quoteEditorOptions } from "@/server/quote-editor-data";

export const metadata = { title: "عرض سعر جديد" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const staff = await requireStaffPage("b2b.manage");
  const o = quoteEditorOptions();
  const companyId = Number((await searchParams).company);
  const company = o.companies.find((c) => c.id === companyId) ?? null;

  return (
    <>
      <PageHeader title="عرض سعر جديد لشركة" description="يُحفظ كمسودة خاصة. لا يراه أحد خارج الفريق حتى ترسله." back={{ href: "/staff/quotes/", label: "عروض الأسعار" }} />
      <QuoteEditor
        meta={null}
        companies={o.companies}
        programs={o.programs}
        hotels={o.hotels}
        currencies={o.currencies}
        defaultTerms={{ ar: o.settings.quote_terms_ar, en: o.settings.quote_terms_en }}
        canDelete={can(staff.role, "b2b.delete")}
        initial={{
          company_id: company?.id ?? null,
          contact_id: company?.contacts.find((c) => c.is_primary)?.id ?? company?.contacts[0]?.id ?? null,
          program_id: null,
          locale: "ar",
          title: "",
          destination: null,
          intro: null,
          start_date: null,
          end_date: null,
          adults: 10,
          children: 0,
          infants: 0,
          rooms: 5,
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
        }}
      />
    </>
  );
}

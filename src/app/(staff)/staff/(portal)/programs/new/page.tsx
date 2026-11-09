import { ProgramEditor } from "@/components/staff/ProgramEditor";
import { PageHeader } from "@/components/staff/ui";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { catalogOptions } from "@/server/editor-options";

export const metadata = { title: "برنامج جديد" };

export default async function NewProgramPage() {
  const staff = await requireStaffPage("catalog.edit");
  const o = catalogOptions();
  return (
    <>
      <PageHeader title="برنامج سياحي جديد" description="يُحفظ كمسودة ولا يظهر للمسافرين حتى تنشره." back={{ href: "/staff/programs/", label: "البرامج" }} />
      <ProgramEditor
        meta={null}
        publicUrl={null}
        destinations={o.destinations}
        hotels={o.hotels}
        services={o.services}
        currencies={o.currencies}
        permissions={{ publish: can(staff.role, "catalog.publish"), delete: false }}
        initial={{
          kind: "package",
          featured: false,
          title_ar: "",
          title_en: null,
          slug: null,
          summary_ar: null,
          summary_en: null,
          description_ar: null,
          description_en: null,
          destination_ids: [],
          duration_days: 5,
          duration_nights: 4,
          currency: o.settings.default_currency,
          price_note_ar: "للشخص الواحد في غرفة مزدوجة",
          price_note_en: "Per person, double room",
          meals_ar: null,
          meals_en: null,
          terms_ar: null,
          terms_en: null,
          cover: null,
          gallery: [],
          prices: [{ label_ar: "للشخص في غرفة مزدوجة", label_en: "Per person, double room", amount: null }],
          days: [{ title_ar: "الوصول والاستقبال", title_en: "Arrival", body_ar: null, body_en: null }],
          hotels: [],
          services: {},
          departures: [],
        }}
      />
    </>
  );
}

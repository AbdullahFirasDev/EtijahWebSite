import { Eye, FileDown, MapPinned, Plus } from "lucide-react";
import Link from "next/link";
import { ProgramStatusBadge } from "@/components/staff/StatusBadge";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, Select, Table } from "@/components/staff/ui";
import { countryName, flag } from "@/lib/countries";
import { formatDay, timeAgo } from "@/lib/dates";
import { mediaSrc } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { PROGRAM_STATUS_LABELS, PROGRAM_STATUSES, TYPE_LABELS, type ProgramStatus, type ProgramType } from "@/lib/travel-labels";
import { requireStaffPage } from "@/server/auth/session";
import { mediaByIds } from "@/server/media";
import { listDestinations } from "@/server/repo/catalog";
import { listProgramsStaff, programFacets, type StaffProgramFilters } from "@/server/repo/programs";

export const metadata = { title: "البرامج السياحية" };

const TABS = [
  { view: "all", label: "جميع البرامج" },
  { view: "fixed", label: "البرامج العامة" },
  { view: "custom", label: "البرامج الخاصة" },
  { view: "published", label: "المنشورة" },
  { view: "drafts", label: "المسودات" },
  { view: "archived", label: "المؤرشفة" },
] as const;

type Search = Record<string, string | undefined>;

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const staff = await requireStaffPage("programs.view");
  const sp = await searchParams;
  const view = (TABS.some((t) => t.view === sp.view) ? sp.view : "all") as NonNullable<StaffProgramFilters["view"]>;
  const day = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const amount = (v?: string) => (v && /^\d{1,9}$/.test(v) ? Number(v) * 100 : undefined);
  const filters: StaffProgramFilters = {
    view,
    q: sp.q?.slice(0, 80) || undefined,
    country: /^[A-Z]{2}$/.test(sp.country ?? "") ? sp.country : undefined,
    destinationId: /^\d+$/.test(sp.city ?? "") ? Number(sp.city) : undefined,
    hotelId: /^\d+$/.test(sp.hotel ?? "") ? Number(sp.hotel) : undefined,
    status: PROGRAM_STATUSES.includes(sp.status as ProgramStatus) ? (sp.status as ProgramStatus) : undefined,
    type: sp.type === "fixed" || sp.type === "custom" ? sp.type : undefined,
    from: day(sp.from),
    to: day(sp.to),
    duration: ["short", "week", "long", "extended"].includes(sp.duration ?? "") ? (sp.duration as StaffProgramFilters["duration"]) : undefined,
    priceMin: amount(sp.min),
    priceMax: amount(sp.max),
  };
  const [programs, facets, destinations] = await Promise.all([listProgramsStaff(filters), programFacets(), listDestinations()]);
  const media = await mediaByIds(programs.map((p) => p.cover_media_id));
  const canEdit = can(staff.role, "programs.edit");
  const tabHref = (v: string) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([k, val]) => val && k !== "view") as [string, string][]);
    if (v !== "all") p.set("view", v);
    const s = p.toString();
    return `/staff/programs/${s ? `?${s}` : ""}`;
  };
  const countryHref = (code: string | null) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([k, val]) => val && k !== "country" && k !== "city") as [string, string][]);
    if (code) p.set("country", code);
    const s = p.toString();
    return `/staff/programs/${s ? `?${s}` : ""}`;
  };
  const filtered = Object.entries(sp).some(([k, v]) => v && k !== "view");

  return (
    <>
      <PageHeader
        title="البرامج السياحية"
        description="البرامج العامة بمواعيد ثابتة وخيارات فنادق، والبرامج الخاصة حسب طلب المسافر. لكل برنامج: PDF ونص منظم ورابط مستقل."
        actions={
          canEdit ? (
            <LinkButton href="/staff/programs/new/" variant="primary">
              <Plus className="size-4" aria-hidden="true" /> إنشاء برنامج جديد
            </LinkButton>
          ) : null
        }
      />

      {/* Section tabs */}
      <nav aria-label="أقسام البرامج" className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 ring-1 ring-line">
        {TABS.map((t) => (
          <Link
            key={t.view}
            href={tabHref(t.view)}
            prefetch={false}
            aria-current={view === t.view ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${view === t.view ? "bg-brand-600 text-white" : "text-brand-900 hover:bg-brand-50"}`}
          >
            {t.label}
            <span className={`num rounded-full px-2 text-xs ${view === t.view ? "bg-white/20" : "bg-mist text-muted"}`}>{facets.tabs[t.view]}</span>
          </Link>
        ))}
      </nav>

      {/* Countries: one click shows only that country's programs */}
      {facets.countries.length ? (
        <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="الدول">
          <span className="text-sm font-bold text-muted">الدول:</span>
          <Link href={countryHref(null)} prefetch={false} className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${!filters.country ? "bg-brand-950 text-white" : "bg-white text-brand-900 ring-1 ring-line hover:bg-brand-50"}`}>
            الكل
          </Link>
          {facets.countries.map((c) => (
            <Link
              key={c.code}
              href={countryHref(c.code)}
              prefetch={false}
              data-country-filter={c.code}
              className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${filters.country === c.code ? "bg-brand-950 text-white" : "bg-white text-brand-900 ring-1 ring-line hover:bg-brand-50"}`}
            >
              <span aria-hidden="true">{flag(c.code)}</span> {countryName(c.code, "ar")} <span className="num opacity-70">({c.n})</span>
            </Link>
          ))}
        </div>
      ) : null}

      <Card>
        <form className="grid gap-2 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8" role="search">
          {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
          {filters.country ? <input type="hidden" name="country" value={filters.country} /> : null}
          <Input name="q" defaultValue={sp.q} placeholder="العنوان أو الرمز…" aria-label="بحث" className="xl:col-span-2" />
          <Select name="city" defaultValue={sp.city ?? ""} aria-label="المدينة">
            <option value="">كل المدن</option>
            {destinations
              .filter((d) => (d.programs > 0 || String(d.id) === sp.city) && (!filters.country || d.country_code === filters.country))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name_ar}
                </option>
              ))}
          </Select>
          <Select name="hotel" defaultValue={sp.hotel ?? ""} aria-label="الفندق">
            <option value="">كل الفنادق المرتبطة</option>
            {facets.hotels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.n})
              </option>
            ))}
          </Select>
          <Select name="duration" defaultValue={sp.duration ?? ""} aria-label="المدة">
            <option value="">أي مدة</option>
            <option value="short">حتى 4 أيام</option>
            <option value="week">5 – 7 أيام</option>
            <option value="long">8 – 10 أيام</option>
            <option value="extended">أكثر من 10 أيام</option>
          </Select>
          <Select name="status" defaultValue={sp.status ?? ""} aria-label="الحالة">
            <option value="">كل الحالات</option>
            {PROGRAM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROGRAM_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-1 text-xs font-bold text-muted">
            من <Input type="date" name="from" dir="ltr" defaultValue={sp.from} aria-label="تاريخ السفر من" className="num h-11 px-2" />
          </label>
          <label className="flex items-center gap-1 text-xs font-bold text-muted">
            إلى <Input type="date" name="to" dir="ltr" defaultValue={sp.to} aria-label="تاريخ السفر إلى" className="num h-11 px-2" />
          </label>
          <Input name="min" inputMode="numeric" dir="ltr" defaultValue={sp.min} placeholder="السعر من" aria-label="السعر من" className="num" />
          <Input name="max" inputMode="numeric" dir="ltr" defaultValue={sp.max} placeholder="السعر إلى" aria-label="السعر إلى" className="num" />
          <div className="flex gap-2 xl:col-span-2">
            <button className="h-11 flex-1 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700">تصفية</button>
            {filtered ? (
              <Link href={tabHref(view)} prefetch={false} className="grid h-11 place-items-center rounded-xl px-3 text-sm font-bold text-brand-700 hover:bg-brand-50">
                مسح
              </Link>
            ) : null}
          </div>
        </form>
        {programs.length ? (
          <Table label="البرامج">
            <thead>
              <tr>
                <th>البرنامج</th>
                <th>النوع</th>
                <th>الوجهة</th>
                <th>المدة</th>
                <th>أقرب موعد</th>
                <th>يبدأ من</th>
                <th>الفنادق</th>
                <th>الطلبات</th>
                <th>الحالة</th>
                <th>التصدير</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => {
                const cover = p.cover_media_id ? media.get(p.cover_media_id) : null;
                return (
                  <tr key={p.id} data-program-row={p.id}>
                    <td>
                      <Link href={`/staff/programs/${p.id}/`} prefetch={false} className="flex items-center gap-3">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaSrc(cover, 480)} alt="" className="size-12 rounded-lg object-cover" />
                        ) : (
                          <span className="grid size-12 place-items-center rounded-lg bg-mist text-muted">
                            <MapPinned className="size-5" aria-hidden="true" />
                          </span>
                        )}
                        <span>
                          <span className="block font-bold text-brand-950 hover:underline">{p.title_ar}</span>
                          <span className="block text-xs text-muted">
                            <span className="num">{p.code}</span> · عُدّل {timeAgo(p.updated_at)}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Badge tone={p.type === "fixed" ? "accent" : "brand"}>{TYPE_LABELS[p.type as ProgramType].ar}</Badge>
                      {p.visibility === "unlisted" ? <Badge tone="muted" className="ms-1">مخفي</Badge> : null}
                    </td>
                    <td className="max-w-48">
                      <span aria-hidden="true">{p.country_codes.map(flag).join(" ")}</span> {p.destinations}
                    </td>
                    <td className="whitespace-nowrap">
                      {p.duration_days} أيام / {p.duration_nights} ليالٍ
                    </td>
                    <td className="whitespace-nowrap">{p.next_departure ? formatDay(p.next_departure, "ar") : p.type === "custom" ? "حسب الطلب" : "—"}</td>
                    <td className="num whitespace-nowrap font-bold text-brand-900">{p.price_from != null ? formatMoney(p.price_from, p.currency, "ar") : p.type === "custom" ? "حسب الطلب" : "—"}</td>
                    <td className="num">{p.hotels}</td>
                    <td className="num">
                      {p.leads}
                      {p.new_leads ? <Badge tone="accent" className="ms-1">{p.new_leads} جديد</Badge> : null}
                    </td>
                    <td>
                      <ProgramStatusBadge status={p.status} />
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Link href={`/staff/programs/${p.id}/?tab=export`} prefetch={false} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand-700 hover:bg-brand-50" title="PDF ونص ورابط مستقل">
                          <FileDown className="size-3.5" aria-hidden="true" /> تصدير
                        </Link>
                        <Link href={`/staff/preview/program/${p.id}/`} prefetch={false} className="rounded-lg p-1 text-muted hover:bg-brand-50 hover:text-brand-700" aria-label="معاينة">
                          <Eye className="size-4" aria-hidden="true" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            icon={<MapPinned className="size-6" />}
            title={filtered ? "لا توجد برامج مطابقة" : "لا توجد برامج في هذا القسم"}
            text="أنشئ برنامجاً عاماً بمواعيد ثابتة وخيارات فنادق، أو برنامجاً خاصاً يطلبه المسافر حسب رغبته."
            action={canEdit ? <LinkButton href="/staff/programs/new/" variant="primary">إنشاء برنامج</LinkButton> : undefined}
          />
        )}
      </Card>
    </>
  );
}

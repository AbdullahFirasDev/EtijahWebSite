import { FilePlus2, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { B2bRequestActions } from "@/components/staff/B2bRequestActions";
import { QuoteStatusBadge } from "@/components/staff/StatusBadge";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Select } from "@/components/staff/ui";
import { countryName } from "@/lib/countries";
import { formatDateTime, formatDay, timeAgo } from "@/lib/dates";
import { requireStaffPage } from "@/server/auth/session";
import { col } from "@/server/db";
import { B2B_REQUEST_STATUS_LABELS, listB2bRequests, type B2bRequestStatus } from "@/server/repo/b2b";
import { listQuotes } from "@/server/repo/quotes";

export const metadata = { title: "الطلبات والتعديلات" };

/** Partner portal requests, and quotes where a company asked for changes. */
export default async function B2bRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; open?: string }> }) {
  await requireStaffPage("quotes.manage");
  const sp = await searchParams;
  const status = ["new", "in_progress", "quoted", "closed", "open"].includes(sp.status ?? "") ? (sp.status as B2bRequestStatus | "open") : undefined;
  const [requests, changes] = await Promise.all([listB2bRequests({ status }), listQuotes({ status: "changes_requested", audience: "company" })]);
  const hotelNames = new Map(
    (await (await col<{ _id: number; name_ar: string }>("hotels")).find({ _id: { $in: requests.flatMap((r) => r.hotel_ids) } }, { projection: { name_ar: 1 } }).toArray()).map((h) => [h._id, h.name_ar]),
  );
  const openId = Number(sp.open);

  return (
    <>
      <PageHeader title="الطلبات والتعديلات" description="طلبات البرامج والعروض المرسلة من بوابات الشركات، والعروض التي طلبت الشركات تعديلها." />
      <Card className="mb-6">
        <CardHeader title="عروض طُلب تعديلها" description={`${changes.length} عرض`} />
        {changes.length ? (
          <ul role="list" className="divide-y divide-line">
            {changes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <Link href={`/staff/quotes/${q.id}/`} prefetch={false} className="font-bold text-brand-700 hover:underline">
                  <span className="num">{q.ref}</span> — {q.title} · {q.recipient}
                </Link>
                <QuoteStatusBadge status={q.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">لا توجد طلبات تعديل مفتوحة.</p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="طلبات الشركات من البوابة"
          actions={
            <form className="flex gap-2">
              <Select name="status" defaultValue={sp.status ?? ""} className="h-9 w-44 text-sm" aria-label="الحالة">
                <option value="">كل الحالات</option>
                <option value="open">المفتوحة</option>
                {(["new", "in_progress", "quoted", "closed"] as const).map((s) => (
                  <option key={s} value={s}>
                    {B2B_REQUEST_STATUS_LABELS[s].ar}
                  </option>
                ))}
              </Select>
              <button className="rounded-xl bg-brand-50 px-3 text-sm font-bold text-brand-700">تصفية</button>
            </form>
          }
        />
        {requests.length ? (
          <ul role="list" className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id} className="px-5 py-4" data-b2b-request={r.ref}>
                <details open={openId === r.id || r.status === "new"}>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                    <span>
                      <span className="num font-black text-brand-700">{r.ref}</span> · <span className="font-bold text-brand-950">{r.title}</span>
                      <span className="block text-xs text-muted">
                        {r.company_name} · {r.user_name} · {timeAgo(r.created_at)}
                      </span>
                    </span>
                    <Badge tone={r.status === "new" ? "accent" : r.status === "quoted" ? "success" : "neutral"}>{B2B_REQUEST_STATUS_LABELS[r.status].ar}</Badge>
                  </summary>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-xl bg-mist p-4 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs font-bold text-muted">الوجهة</dt>
                      <dd>{[r.country_codes.map((c) => countryName(c, "ar")).join("، "), r.places].filter(Boolean).join(" — ") || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-muted">التواريخ</dt>
                      <dd>{r.date_from || r.date_to ? `${r.date_from ? formatDay(r.date_from, "ar") : "؟"} ← ${r.date_to ? formatDay(r.date_to, "ar") : "؟"}` : "مرنة"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-muted">المسافرون</dt>
                      <dd className="num">
                        {r.adults} بالغ · {r.children} طفل · {r.rooms} غرفة
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-muted">الفنادق المطلوبة</dt>
                      <dd>{r.hotel_ids.map((h) => hotelNames.get(h)).filter(Boolean).join("، ") || (r.hotel_stars ? `${r.hotel_stars} نجوم` : "—")}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-muted">الميزانية</dt>
                      <dd>{r.budget ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-muted">الجهة المستفيدة</dt>
                      <dd>{r.beneficiary ?? "—"}</dd>
                    </div>
                    {r.notes ? (
                      <div className="sm:col-span-3">
                        <dt className="text-xs font-bold text-muted">ملاحظات</dt>
                        <dd className="whitespace-pre-line">{r.notes}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <B2bRequestActions id={r.id} status={r.status} note={r.staff_note} />
                    {r.quote_id ? (
                      <Link href={`/staff/quotes/${r.quote_id}/`} prefetch={false} className="font-bold text-brand-700 hover:underline">
                        فتح العرض المرتبط
                      </Link>
                    ) : (
                      <LinkButton href={`/staff/quotes/new/?request=${r.id}`} size="sm" variant="accent" data-quote-from-request={r.ref}>
                        <FilePlus2 className="size-4" aria-hidden="true" /> إعداد عرض سعر
                      </LinkButton>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted">آخر تحديث: {formatDateTime(r.updated_at)}</p>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<MessagesSquare className="size-6" />} title="لا توجد طلبات" text="تظهر هنا الطلبات التي يرسلها مستخدمو الشركات من بوابتهم." />
        )}
      </Card>
    </>
  );
}

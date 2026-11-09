import { notFound } from "next/navigation";
import { QuoteEditor } from "@/components/staff/QuoteEditor";
import { Card, CardHeader, PageHeader } from "@/components/staff/ui";
import { formatDateTime } from "@/lib/dates";
import type { MediaRef } from "@/lib/media";
import { can } from "@/lib/permissions";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/travel-labels";
import { requireStaffPage } from "@/server/auth/session";
import { mediaById, mediaByIds } from "@/server/media";
import { quoteEditorOptions } from "@/server/quote-editor-data";
import { getQuoteEditor, quoteEvents } from "@/server/repo/quotes";

export const metadata = { title: "عرض سعر" };

const EVENT_LABELS: Record<string, string> = {
  created: "أُنشئ العرض",
  updated: "تم تعديل المسودة",
  revised: "تعديل بعد الإرسال (نسخة جديدة)",
  sent: "أُرسل العرض",
  resent: "أُعيد الإرسال",
  viewed: "فتح العميل العرض",
  accepted: "قَبِل العميل العرض",
  changes_requested: "طلب العميل تعديلات",
  expired: "انتهت صلاحية العرض",
  link_revoked: "أُبطل الرابط",
  link_regenerated: "أُنشئ رابط جديد",
  link_expiry: "تغيير صلاحية الرابط",
  pdf_downloaded: "نزّل العميل ملف PDF",
};
const CHANNELS: Record<string, string> = { whatsapp: "واتساب", email: "البريد الإلكتروني", link: "رابط" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage("b2b.manage");
  const q = getQuoteEditor(Number((await params).id));
  if (!q) notFound();
  const o = quoteEditorOptions();
  const gallery = mediaByIds(q.gallery);
  const events = quoteEvents(q.id);

  return (
    <>
      <PageHeader title={q.title} description={`${q.ref} · ${o.companies.find((c) => c.id === q.company_id)?.name ?? ""}`} back={{ href: "/staff/quotes/", label: "عروض الأسعار" }} />
      <QuoteEditor
        key={q.updated_at}
        meta={{
          id: q.id,
          ref: q.ref,
          token: q.token,
          status: q.status,
          revision: q.revision,
          link_expires_at: q.link_expires_at,
          link_revoked_at: q.link_revoked_at,
          sent_at: q.sent_at,
          first_viewed_at: q.first_viewed_at,
          last_viewed_at: q.last_viewed_at,
          view_count: q.view_count,
          responded_at: q.responded_at,
          response_name: q.response_name,
          response_note: q.response_note,
        }}
        companies={o.companies}
        programs={o.programs}
        hotels={o.hotels}
        currencies={o.currencies}
        defaultTerms={{ ar: o.settings.quote_terms_ar, en: o.settings.quote_terms_en }}
        canDelete={can(staff.role, "b2b.delete")}
        initial={{
          ...q,
          cover: mediaById(q.cover_media_id),
          gallery: q.gallery.map((m) => gallery.get(m)).filter((m): m is MediaRef => !!m),
          items: q.items.map((i, n) => ({ ...i, key: `s${n}` })),
        }}
      />
      <Card className="mt-6">
        <CardHeader title="سجل العرض" description="الإنشاء، الإرسال، المشاهدات وردود العميل." />
        <ol className="divide-y divide-line">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-sm">
              <span className="font-bold text-brand-950">
                {e.kind.startsWith("status:") ? `تغيير الحالة يدوياً: ${QUOTE_STATUS_LABELS[e.kind.slice(7) as QuoteStatus]?.ar ?? e.kind}` : (EVENT_LABELS[e.kind] ?? e.kind)}
                {e.channel ? <span className="font-normal text-muted"> · {CHANNELS[e.channel] ?? e.channel}</span> : null}
                {e.note ? <span className="mt-0.5 block font-normal whitespace-pre-line text-ink">{e.note}</span> : null}
              </span>
              <span className="text-xs text-muted">
                {e.user_name ?? (e.actor_label === "client" ? "العميل" : e.actor_label === "system" ? "النظام" : (e.actor_label ?? "العميل"))} · {formatDateTime(e.created_at)}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}

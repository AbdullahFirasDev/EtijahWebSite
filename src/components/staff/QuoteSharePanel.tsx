"use client";

import { Ban, CheckCircle2, Copy, Link2, Mail, RefreshCw, Send, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { WhatsAppIcon } from "@/components/ui/icons";
import { asset } from "@/lib/asset";
import { formatDateTime } from "@/lib/dates";
import { waLink } from "@/lib/phone";
import type { QuoteStatus } from "@/lib/travel-labels";
import { deleteQuoteAction, duplicateQuoteAction, markQuoteSentAction, quoteLinkAction, setQuoteStatusAction } from "@/server/actions/quotes";
import { DateInput } from "./fields";
import { useToast } from "./Toaster";
import { Button, Card, CardHeader, Field, Input } from "./ui";
import { useActionRunner } from "./useActionRunner";

// The page origin never changes, so there is nothing to subscribe to.
const noopSubscribe = () => () => {};

export interface QuoteMeta {
  id: number;
  ref: string;
  token: string;
  status: QuoteStatus;
  link_expires_at: string | null;
  link_revoked_at: string | null;
  sent_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  responded_at: string | null;
  response_name: string | null;
  response_note: string | null;
}

interface Props {
  meta: QuoteMeta;
  contact: { name: string; phone: string | null; email: string | null } | null;
  company: string;
  title: string;
  locale: "ar" | "en";
  canDelete: boolean;
  dirty: boolean;
  /** Company quotes can also be published to the partner portal. */
  portal?: boolean;
}

/** Share the quote link (WhatsApp, email, copy) and manage the link's validity. */
export function QuoteSharePanel({ meta, contact, company, title, locale, canDelete, dirty, portal }: Props) {
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const [expiry, setExpiry] = useState(meta.link_expires_at?.slice(0, 10) ?? "");
  const toast = useToast();
  const router = useRouter();
  const { run, pending } = useActionRunner();

  const url = `${origin}${asset(`/q/${meta.token}/`)}`;
  const revoked = !!meta.link_revoked_at;
  const greeting = contact?.name ?? company;
  const message =
    locale === "ar"
      ? `مرحباً ${greeting}،\nيسعدنا في الاتجاه للسياحة والسفر مشاركتكم عرض السعر الخاص بـ «${title}» (رقم ${meta.ref}).\nيمكنكم الاطلاع على التفاصيل الكاملة وتنزيل نسخة PDF والموافقة على العرض من الرابط:\n${url}`
      : `Dear ${greeting},\nEtijah Travel & Tourism is pleased to share our quotation for "${title}" (ref. ${meta.ref}).\nView the full details, download the PDF and approve the offer here:\n${url}`;

  const send = (channel: "whatsapp" | "email" | "link" | "portal") => {
    if (dirty) {
      toast.error("احفظ التعديلات أولاً قبل الإرسال.");
      return false;
    }
    run(() => markQuoteSentAction({ id: meta.id, channel }));
    return true;
  };

  return (
    <>
      <Card>
        <CardHeader title="إرسال العرض" description={contact ? `إلى ${contact.name}` : "أضف جهة اتصال لإرسال مباشر."} />
        <div className="grid gap-3 p-4">
          <div className="flex gap-2">
            <Input readOnly value={revoked ? "الرابط ملغى" : url} dir="ltr" aria-label="رابط العرض" className="h-10 text-xs" onFocus={(e) => e.target.select()} />
            <Button
              size="sm"
              className="h-10 shrink-0"
              aria-label="نسخ الرابط"
              disabled={revoked}
              onClick={async () => {
                await navigator.clipboard.writeText(url).catch(() => undefined);
                toast.success("تم نسخ الرابط.");
                if (meta.status === "draft") send("link");
              }}
            >
              <Copy className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <a
            href={contact?.phone ? waLink(contact.phone.replace(/[^\d+]/g, ""), message) : `https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={revoked}
            onClick={(e) => {
              if (revoked || !send("whatsapp")) e.preventDefault();
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1fa855] font-bold text-white hover:bg-[#178a45] aria-disabled:opacity-50"
          >
            <WhatsAppIcon className="size-5" /> إرسال عبر واتساب
          </a>
          <a
            href={`mailto:${contact?.email ?? ""}?subject=${encodeURIComponent(`${locale === "ar" ? "عرض سعر" : "Quotation"} ${meta.ref} — ${title}`)}&body=${encodeURIComponent(message)}`}
            aria-disabled={revoked}
            onClick={(e) => {
              if (revoked || !send("email")) e.preventDefault();
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line font-bold text-brand-900 hover:bg-brand-50 aria-disabled:opacity-50"
          >
            <Mail className="size-4" aria-hidden="true" /> إرسال بالبريد الإلكتروني
          </a>
          {portal && meta.status === "draft" ? (
            <Button variant="primary" onClick={() => send("portal")} loading={pending} data-send-portal>
              <Send className="size-4 rtl:-scale-x-100" aria-hidden="true" /> إتاحة في بوابة الشركة
            </Button>
          ) : null}
          {meta.status === "draft" ? (
            <Button size="sm" variant="ghost" onClick={() => send("link")} loading={pending}>
              <Send className="size-4 rtl:-scale-x-100" aria-hidden="true" /> تسجيل كمُرسل يدوياً
            </Button>
          ) : null}
          <dl className="grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs">
            <div>
              <dt className="text-muted">أُرسل</dt>
              <dd className="font-bold">{meta.sent_at ? formatDateTime(meta.sent_at) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">المشاهدات</dt>
              <dd className="num font-bold">
                {meta.view_count}
                {meta.last_viewed_at ? <span className="font-normal text-muted"> · آخرها {formatDateTime(meta.last_viewed_at)}</span> : null}
              </dd>
            </div>
          </dl>
          {meta.responded_at ? (
            <div className={`rounded-xl p-3 text-sm ${meta.status === "accepted" ? "bg-[#e9f7ef] text-[#17663a]" : "bg-accent-50 text-accent-700"}`}>
              <p className="font-extrabold">{meta.status === "accepted" ? "قَبِل العميل العرض" : meta.status === "changes_requested" ? "طلب العميل تعديلات" : "رد العميل"}</p>
              <p className="mt-1">
                {meta.response_name} · {formatDateTime(meta.responded_at)}
              </p>
              {meta.response_note ? <p className="mt-1 whitespace-pre-line text-ink">{meta.response_note}</p> : null}
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="الرابط الآمن" description="رمز عشوائي (256 بت). يمكن تحديد صلاحيته أو إبطاله في أي وقت." />
        <div className="grid gap-3 p-4">
          <Field label="ينتهي الرابط في" htmlFor="link-exp" hint="اتركه فارغاً لرابط بلا انتهاء.">
            <div className="flex gap-2">
              <DateInput id="link-exp" value={expiry || null} onChange={(v) => setExpiry(v ?? "")} inputClassName="h-10" />
              <Button size="sm" className="h-10 shrink-0" onClick={() => run(() => quoteLinkAction({ id: meta.id, action: "expiry", expires: expiry || null }))}>
                حفظ
              </Button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="danger" disabled={revoked} onClick={() => run(() => quoteLinkAction({ id: meta.id, action: "revoke" }), { confirm: "إبطال الرابط؟ لن يتمكن العميل من فتحه." })}>
              <Ban className="size-4" aria-hidden="true" /> إبطال
            </Button>
            <Button size="sm" onClick={() => run(() => quoteLinkAction({ id: meta.id, action: "regenerate" }), { confirm: "إنشاء رابط جديد؟ سيتوقف الرابط الحالي عن العمل." })}>
              <RefreshCw className="size-4" aria-hidden="true" /> رابط جديد
            </Button>
          </div>
          {revoked ? (
            <p className="flex items-center gap-1.5 text-xs font-bold text-danger">
              <Link2 className="size-3.5" aria-hidden="true" /> الرابط مُبطل منذ {formatDateTime(meta.link_revoked_at)}
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="إجراءات" />
        <div className="grid grid-cols-2 gap-2 p-4">
          <Button size="sm" disabled={meta.status === "accepted"} onClick={() => run(() => setQuoteStatusAction({ id: meta.id, status: "accepted", note: null }), { confirm: "تسجيل العرض كمقبول (رد العميل خارج الموقع)؟" })}>
            <CheckCircle2 className="size-4" aria-hidden="true" /> مقبول
          </Button>
          <Button size="sm" disabled={meta.status === "rejected"} onClick={() => run(() => setQuoteStatusAction({ id: meta.id, status: "rejected", note: null }), { confirm: "تسجيل العرض كمرفوض؟" })}>
            <XCircle className="size-4" aria-hidden="true" /> مرفوض
          </Button>
          <Button size="sm" className="col-span-2" onClick={() => run(() => duplicateQuoteAction(meta.id), { onOk: (d) => router.push(`/staff/quotes/${d.id}/`) })}>
            <Copy className="size-4" aria-hidden="true" /> نسخ كعرض جديد
          </Button>
          {canDelete ? (
            <Button size="sm" variant="danger" className="col-span-2" onClick={() => run(() => deleteQuoteAction(meta.id), { confirm: "حذف العرض نهائياً مع سجله؟", onOk: () => router.push("/staff/quotes/") })}>
              <Trash2 className="size-4" aria-hidden="true" /> حذف العرض
            </Button>
          ) : null}
        </div>
      </Card>
    </>
  );
}

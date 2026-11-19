"use client";

import { Archive, Check, Copy, CopyPlus, ExternalLink, FileDown, FileText, Link2, Link2Off, Mail, Pause, RefreshCw, Rocket, Send, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { asset } from "@/lib/asset";
import { deleteProgramAction, duplicateProgramAction, programTextAction, setProgramStatusAction, shareLinkAction } from "@/server/actions/programs";
import { Badge, Button, Card, CardHeader, Textarea } from "./ui";
import { useActionRunner } from "./useActionRunner";

const noopSubscribe = () => () => {};

/** Status changes, duplicate and delete for one program. */
export function ProgramActions({ id, status, canPublish, canEdit, canDelete }: { id: number; status: string; canPublish: boolean; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const setStatus = (s: "published" | "paused" | "archived" | "draft", confirm?: string) => run(() => setProgramStatusAction({ id, status: s }), { confirm });
  return (
    <div className="flex flex-wrap gap-2">
      {canPublish && status !== "published" ? (
        <Button size="sm" variant="accent" loading={pending} onClick={() => setStatus("published")} data-status-publish>
          <Rocket className="size-4" aria-hidden="true" /> نشر
        </Button>
      ) : null}
      {canPublish && status === "published" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus("paused", "إيقاف البرنامج مؤقتاً؟ سيختفي من الموقع ويتوقف رابطه المستقل.")}>
          <Pause className="size-4" aria-hidden="true" /> إيقاف مؤقت
        </Button>
      ) : null}
      {canPublish && status !== "archived" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus("archived", "أرشفة البرنامج؟")}>
          <Archive className="size-4" aria-hidden="true" /> أرشفة
        </Button>
      ) : null}
      {canPublish && (status === "archived" || status === "paused") ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStatus("draft")}>
          <Undo2 className="size-4" aria-hidden="true" /> إلى المسودات
        </Button>
      ) : null}
      {canEdit ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => duplicateProgramAction(id), { onOk: (d) => router.push(`/staff/programs/${d.id}/`) })}>
          <CopyPlus className="size-4" aria-hidden="true" /> نسخ
        </Button>
      ) : null}
      {canDelete ? (
        <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => deleteProgramAction(id), { confirm: "حذف البرنامج نهائياً؟", onOk: () => router.push("/staff/programs/") })}>
          <Trash2 className="size-4" aria-hidden="true" /> حذف
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The three export options of a program: a branded PDF, formatted text for WhatsApp /
 * Telegram / e-mail, and an independent share link that can be stopped at any time.
 */
export function ProgramExportPanel({
  id,
  title,
  status,
  share,
  siteUrl,
  canShare,
}: {
  id: number;
  title: string;
  status: string;
  share: { token: string; enabled: boolean } | null;
  siteUrl: string | null;
  canShare: boolean;
}) {
  const { run, pending } = useActionRunner();
  const [text, setText] = useState<{ locale: "ar" | "en"; value: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Hydration-safe: the server renders without the origin, the browser fills it in after hydration.
  const browserOrigin = useSyncExternalStore(noopSubscribe, () => window.location.origin + asset(""), () => "");
  const origin = siteUrl ?? browserOrigin;
  const shareUrl = (locale: "ar" | "en") => (share ? `${origin}${locale === "en" ? "/en" : ""}/p/${share.token}/` : null);
  const published = status === "published";

  const copy = async (value: string, tag: string) => {
    await navigator.clipboard?.writeText(value).catch(() => undefined);
    setCopied(tag);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card id="export">
      <CardHeader title="تصدير البرنامج ومشاركته" description="ملف PDF بهوية الاتجاه، ونص منظم جاهز للإرسال، ورابط مستقل للمسافرين." />
      <div className="grid gap-5 p-5 lg:grid-cols-3">
        {/* PDF */}
        <div className="rounded-2xl border border-line p-4">
          <p className="flex items-center gap-2 font-extrabold text-brand-950">
            <FileDown className="size-5 text-brand-600" aria-hidden="true" /> 1. ملف PDF
          </p>
          <p className="mt-1 text-sm text-muted">يعرض التفاصيل والفنادق والأسعار والخدمات، مع روابط فنادق قابلة للنقر. لا يتضمن أي تكاليف داخلية.</p>
          <div className="mt-3 grid gap-2">
            {(["ar", "en"] as const).map((l) => (
              <div key={l} className="flex gap-2">
                <a href={asset(`/print/program/${id}/?lang=${l}`)} target="_blank" rel="noopener" className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line px-3 text-sm font-bold text-brand-900 hover:bg-brand-50" data-program-pdf-preview={l}>
                  معاينة {l === "ar" ? "عربي" : "English"}
                </a>
                <a href={asset(`/staff/programs/${id}/pdf/?lang=${l}`)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-bold text-white hover:bg-brand-700" data-program-pdf={l}>
                  <FileDown className="size-4" aria-hidden="true" /> تنزيل {l === "ar" ? "عربي" : "EN"}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Text */}
        <div className="rounded-2xl border border-line p-4">
          <p className="flex items-center gap-2 font-extrabold text-brand-950">
            <FileText className="size-5 text-brand-600" aria-hidden="true" /> 2. نص منظم
          </p>
          <p className="mt-1 text-sm text-muted">العنوان والفنادق والأسعار والبرنامج اليومي والخدمات بتنسيق واضح لواتساب وتيليجرام والبريد.</p>
          <div className="mt-3 flex gap-2">
            {(["ar", "en"] as const).map((l) => (
              <Button key={l} size="sm" variant="subtle" className="flex-1" loading={pending && text?.locale !== l} onClick={() => run(() => programTextAction({ id, locale: l }), { refresh: false, onOk: (d) => setText({ locale: l, value: d.text }) })} data-program-text={l}>
                نص {l === "ar" ? "عربي" : "English"}
              </Button>
            ))}
          </div>
        </div>

        {/* Share link */}
        <div className="rounded-2xl border border-line p-4">
          <p className="flex items-center gap-2 font-extrabold text-brand-950">
            <Link2 className="size-5 text-brand-600" aria-hidden="true" /> 3. رابط مستقل
            {share?.enabled && published ? <Badge tone="success">فعّال</Badge> : <Badge tone="muted">{published ? "موقوف" : "بعد النشر"}</Badge>}
          </p>
          <p className="mt-1 text-sm text-muted">يشاهد المسافر التفاصيل ويقارن الفنادق ويرسل طلب الحجز. لا يعمل للمسودات أو البرامج الموقوفة.</p>
          {share && published ? (
            <div className="mt-3 grid gap-2">
              {share.enabled ? (
                <div className="flex items-center gap-2 rounded-xl bg-mist px-3 py-2">
                  <span className="num min-w-0 flex-1 truncate text-xs" dir="ltr" data-share-url>
                    {shareUrl("ar")}
                  </span>
                  <Button size="sm" variant="ghost" aria-label="نسخ الرابط" onClick={() => copy(shareUrl("ar")!, "link")}>
                    {copied === "link" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                  </Button>
                  <a href={shareUrl("ar")!} target="_blank" rel="noopener" aria-label="فتح الرابط" className="rounded-lg p-1.5 text-brand-700 hover:bg-white">
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                </div>
              ) : null}
              {canShare ? (
                <div className="flex flex-wrap gap-2">
                  {share.enabled ? (
                    <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => shareLinkAction({ id, action: "disable" }), { confirm: "إيقاف الرابط المستقل؟ من يملكه لن يتمكن من فتح البرنامج." })} data-share-disable>
                      <Link2Off className="size-4" aria-hidden="true" /> إيقاف الرابط
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => shareLinkAction({ id, action: "enable" }))} data-share-enable>
                      <Link2 className="size-4" aria-hidden="true" /> تفعيل الرابط
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => shareLinkAction({ id, action: "regenerate" }), { confirm: "إنشاء رابط جديد؟ سيتوقف الرابط الحالي." })}>
                    <RefreshCw className="size-4" aria-hidden="true" /> رابط جديد
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted">{published ? "لا يوجد رابط بعد." : "ينشأ الرابط تلقائياً عند نشر البرنامج."}</p>
          )}
        </div>
      </div>

      {text ? (
        <div className="border-t border-line p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-brand-950">النص المنظم ({text.locale === "ar" ? "عربي" : "English"})</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={() => copy(text.value, "text")} data-copy-text>
                {copied === "text" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />} {copied === "text" ? "تم النسخ" : "نسخ النص"}
              </Button>
              <a href={`https://wa.me/?text=${encodeURIComponent(text.value)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-bold text-brand-900 hover:bg-brand-50">
                <Send className="size-4 text-[#1fa855]" aria-hidden="true" /> واتساب
              </a>
              <a href={`https://t.me/share/url?url=${encodeURIComponent(share?.enabled && published ? (shareUrl(text.locale) ?? "") : "")}&text=${encodeURIComponent(text.value)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-bold text-brand-900 hover:bg-brand-50">
                <Send className="size-4 text-[#229ed9]" aria-hidden="true" /> تيليجرام
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text.value.replace(/\*/g, ""))}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-bold text-brand-900 hover:bg-brand-50">
                <Mail className="size-4" aria-hidden="true" /> بريد
              </a>
            </div>
          </div>
          <Textarea readOnly value={text.value} rows={16} dir={text.locale === "ar" ? "rtl" : "ltr"} className="font-mono text-sm" data-program-text-output />
        </div>
      ) : null}
    </Card>
  );
}

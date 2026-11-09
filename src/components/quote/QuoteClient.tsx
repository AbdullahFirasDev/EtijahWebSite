"use client";

import { CheckCircle2, CircleAlert, MessageSquareText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { quoteDict } from "@/content/quote";
import type { Locale } from "@/content/site";
import { quoteViewedAction, respondToQuoteAction } from "@/server/actions/quotes";

/** Records the client's view from the browser (link-preview bots don't execute this). */
export function QuoteViewBeacon({ token }: { token: string }) {
  useEffect(() => {
    void quoteViewedAction(token);
  }, [token]);
  return null;
}

const field = "w-full rounded-2xl border border-line bg-white px-4 text-base outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

/** Accept / request-changes buttons and their dialog. */
export function QuoteRespond({ token, locale, disabled, layout = "stack" }: { token: string; locale: Locale; disabled?: boolean; layout?: "stack" | "row" }) {
  const t = quoteDict[locale];
  const [mode, setMode] = useState<"accept" | "changes" | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (mode && !d.open) d.showModal();
    if (!mode && d.open) d.close();
  }, [mode]);

  const submit = async () => {
    if (!mode) return;
    setSending(true);
    setError(null);
    try {
      const res = await respondToQuoteAction({ token, action: mode, name, note: note || null });
      if (res.ok) {
        setDone(mode === "accept" ? t.respond.thanksAccept : t.respond.thanksChanges);
        setMode(null);
        setTimeout(() => window.location.reload(), 1200);
      } else setError(res.error);
    } catch {
      setError(t.unavailable);
    } finally {
      setSending(false);
    }
  };

  if (done)
    return (
      <p role="status" className="flex items-center gap-2 rounded-2xl bg-[#e9f7ef] p-4 font-bold text-[#17663a]">
        <CheckCircle2 className="size-5" aria-hidden="true" /> {done}
      </p>
    );

  return (
    <>
      <div className={layout === "row" ? "flex flex-wrap gap-3" : "grid gap-2.5"}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode("accept")}
          data-quote-accept
          className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-accent-500 px-7 text-[1.05rem] font-bold text-brand-950 transition-[background-color,box-shadow] hover:bg-accent-400 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
        >
          <CheckCircle2 className="size-5" aria-hidden="true" /> {t.accept}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode("changes")}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-white px-6 font-bold text-brand-900 hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MessageSquareText className="size-5" aria-hidden="true" /> {t.requestChanges}
        </button>
      </div>
      <dialog ref={ref} onClose={() => setMode(null)} aria-labelledby="respond-title" className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-[1.5rem] bg-white p-0 text-ink shadow-2xl backdrop:bg-brand-950/60 backdrop:backdrop-blur-sm">
        {mode ? (
          <div className="p-6 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <h2 id="respond-title" className="text-xl font-extrabold text-brand-950">
                {mode === "accept" ? t.respond.acceptTitle : t.respond.changesTitle}
              </h2>
              <button type="button" onClick={() => setMode(null)} aria-label={t.respond.cancel} className="rounded-lg p-1 text-muted hover:bg-mist">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-[1.85] text-muted">{mode === "accept" ? t.respond.acceptText : t.respond.changesText}</p>
            {error ? (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-accent-50 p-3 text-sm font-bold text-danger">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {error}
              </p>
            ) : null}
            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-brand-950">{t.respond.name}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={`${field} h-12`} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-brand-950">{mode === "accept" ? t.respond.note : t.respond.changes}</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={2000} className={`${field} py-3 leading-[1.8]`} />
              </label>
              {mode === "accept" ? (
                <label className="flex cursor-pointer items-start gap-2.5 text-sm font-semibold">
                  <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 size-4 accent-brand-600" />
                  {t.respond.confirm}
                </label>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setMode(null)} className="h-11 rounded-full px-5 font-bold text-brand-800 hover:bg-brand-50">
                {t.respond.cancel}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={sending || name.trim().length < 2 || (mode === "accept" ? !confirm : !note.trim())}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {sending ? t.respond.sending : mode === "accept" ? t.respond.submitAccept : t.respond.submitChanges}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

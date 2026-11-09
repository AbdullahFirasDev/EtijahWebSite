"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Images, Star, Trash2, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { asset } from "@/lib/asset";
import { mediaSrc, type MediaRef } from "@/lib/media";
import { useToast } from "./Toaster";
import { Button } from "./ui";

async function uploadFile(file: File): Promise<MediaRef> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(asset("/api/staff/media"), { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { media?: MediaRef; error?: string };
  if (!res.ok || !data.media) throw new Error(data.error ?? "تعذّر رفع الصورة.");
  return data.media;
}

function Library({ onPick, onClose }: { onPick: (m: MediaRef) => void; onClose: () => void }) {
  const [items, setItems] = useState<MediaRef[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(asset("/api/staff/media"))
      .then((res) => res.json() as Promise<{ items?: MediaRef[] }>)
      .then((data) => alive && setItems(data.items ?? []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div role="dialog" aria-modal="true" aria-label="مكتبة الصور" className="fixed inset-0 z-[70] grid place-items-center p-4">
      <button type="button" aria-label="إغلاق" onClick={onClose} className="absolute inset-0 bg-brand-950/60 backdrop-blur-sm" />
      <div className="relative flex max-h-[85svh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <p className="font-extrabold text-brand-950">مكتبة الصور</p>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-lg p-1.5 hover:bg-mist">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {items === null ? (
            <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">لا توجد صور مرفوعة بعد.</p>
          ) : (
            <ul role="list" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => onPick(m)} className="group block w-full overflow-hidden rounded-xl ring-1 ring-line hover:ring-2 hover:ring-brand-500">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaSrc(m, 480)} alt="" className="aspect-[4/3] w-full object-cover" style={{ backgroundImage: `url(${m.blur})`, backgroundSize: "cover" }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

interface ImagePickerProps {
  value: MediaRef[];
  onChange: (next: MediaRef[]) => void;
  max?: number;
  label: string;
  hint?: string;
  /** Shows a "cover" star on the first image. */
  coverFirst?: boolean;
}

/** Upload (drag & drop or browse), pick from the library, reorder and remove images. */
export function ImagePicker({ value, onChange, max = 12, label, hint, coverFirst }: ImagePickerProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [drag, setDrag] = useState(false);
  const [library, setLibrary] = useState(false);
  const id = useId();
  // Latest value for sequential multi-file uploads (each upload appends to the newest list).
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const add = (m: MediaRef) => {
    if (latest.current.some((x) => x.id === m.id)) return;
    if (latest.current.length >= max) {
      toast.error(`الحد الأقصى ${max} صور.`);
      return;
    }
    latest.current = [...latest.current, m];
    onChange(latest.current);
  };

  const upload = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, max - latest.current.length));
    if (!list.length) return;
    setBusy((n) => n + list.length);
    for (const file of list) {
      try {
        add(await uploadFile(file));
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <p id={`${id}-label`} className="mb-1.5 text-sm font-bold text-brand-950">
        {label}
      </p>
      {hint ? <p className="-mt-1 mb-2 text-xs text-muted">{hint}</p> : null}
      <ul role="list" aria-labelledby={`${id}-label`} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((m, i) => (
          <li key={m.id} className="group relative overflow-hidden rounded-xl bg-mist ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaSrc(m, 480)} alt="" className="aspect-[4/3] w-full object-cover" style={{ backgroundImage: `url(${m.blur})`, backgroundSize: "cover" }} />
            {coverFirst && i === 0 ? (
              <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent-500 px-2 py-0.5 text-[0.7rem] font-black text-brand-950">
                <Star className="size-3" aria-hidden="true" /> الغلاف
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-linear-to-t from-brand-950/80 to-transparent p-2">
              <div className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="تقديم" className="grid size-7 place-items-center rounded-lg bg-white/90 text-brand-950 disabled:opacity-40">
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="تأخير" className="grid size-7 place-items-center rounded-lg bg-white/90 text-brand-950 disabled:opacity-40">
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                </button>
              </div>
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== m.id))} aria-label="إزالة الصورة" className="grid size-7 place-items-center rounded-lg bg-white/90 text-danger">
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
        {value.length < max ? (
          <li>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                void upload(e.dataTransfer.files);
              }}
              className={`flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 text-center transition-colors ${drag ? "border-brand-500 bg-brand-50" : "border-line bg-white"}`}
            >
              {busy ? (
                <>
                  <span aria-hidden="true" className="size-6 animate-spin rounded-full border-2 border-brand-600 border-e-transparent" />
                  <span className="text-xs font-bold text-brand-700" role="status">
                    جارٍ رفع {busy} صورة…
                  </span>
                </>
              ) : (
                <>
                  <ImagePlus className="size-6 text-brand-500" aria-hidden="true" />
                  <span className="text-xs text-muted">اسحب الصور هنا</span>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    <Button size="sm" variant="subtle" onClick={() => inputRef.current?.click()}>
                      <Upload className="size-3.5" aria-hidden="true" /> رفع
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setLibrary(true)}>
                      <Images className="size-3.5" aria-hidden="true" /> المكتبة
                    </Button>
                  </div>
                </>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple={max > 1}
              className="sr-only"
              aria-label={`رفع صور: ${label}`}
              data-upload={label}
              onChange={(e) => {
                if (e.target.files) void upload(e.target.files);
                e.target.value = "";
              }}
            />
          </li>
        ) : null}
      </ul>
      {library ? (
        <Library
          onClose={() => setLibrary(false)}
          onPick={(m) => {
            add(m);
            if (max === 1) setLibrary(false);
          }}
        />
      ) : null}
    </div>
  );
}

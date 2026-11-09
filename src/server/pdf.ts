import "server-only";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Browser } from "playwright-core";
import { site } from "@/content/site";
import { sign, verifySignature } from "./security";

export const RENDER_COOKIE = "etijah_render";
const CACHE_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.PDF_CACHE_DIR || path.join(process.cwd(), "storage", "pdf-cache"));

let browserPromise: Promise<Browser> | null = null;
let idleTimer: NodeJS.Timeout | null = null;

/**
 * Headless Chromium (Edge or Chrome) renders the print page to PDF: Arabic shaping and RTL
 * layout are exact, and every <a href> becomes a real clickable link annotation in the PDF.
 * Configure with PDF_BROWSER_PATH (executable) or PDF_BROWSER_CHANNEL (msedge | chrome).
 */
async function browser(): Promise<Browser> {
  if (!browserPromise) {
    const { chromium } = await import("playwright-core");
    const executablePath = process.env.PDF_BROWSER_PATH || undefined;
    const channel = executablePath ? undefined : process.env.PDF_BROWSER_CHANNEL || (process.platform === "win32" ? "msedge" : "chrome");
    browserPromise = chromium.launch({ executablePath, channel, headless: true, args: ["--disable-dev-shm-usage"] }).catch((error) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
}

function scheduleClose() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    const b = browserPromise;
    browserPromise = null;
    if (b) (await b.catch(() => null))?.close().catch(() => undefined);
  }, 5 * 60_000);
  idleTimer.unref?.();
}

/** Short-lived signed value that lets the renderer open a quote's print page (drafts included). */
export function renderCookieValue(quoteId: number) {
  const exp = Date.now() + 5 * 60_000;
  return `${exp}.${sign(`render:${quoteId}:${exp}`)}`;
}

export function verifyRenderCookie(quoteId: number, value: string | undefined) {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || Number(exp) < Date.now()) return false;
  return verifySignature(`render:${quoteId}:${exp}`, sig);
}

interface RenderOptions {
  quoteId: number;
  url: string;
  cacheKey: string;
  locale: "ar" | "en";
  ref: string;
}

export async function renderQuotePdf(opts: RenderOptions): Promise<Buffer> {
  const file = path.join(CACHE_DIR, `${opts.cacheKey}.pdf`);
  try {
    return await readFile(file);
  } catch {
    /* not cached yet */
  }

  const b = await browser();
  const context = await b.newContext({ locale: opts.locale === "ar" ? "ar-IQ" : "en-GB", viewport: { width: 1240, height: 1754 } });
  try {
    const url = new URL(opts.url);
    await context.addCookies([
      { name: RENDER_COOKIE, value: renderCookieValue(opts.quoteId), domain: url.hostname, path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    const response = await page.goto(opts.url, { waitUntil: "networkidle", timeout: 60_000 });
    if (!response || !response.ok()) throw new Error(`Print page returned ${response?.status()}`);
    // Every image and web font must be ready before printing.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((img) =>
          img.complete
            ? null
            : new Promise((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              }),
        ),
      );
    });

    const ar = opts.locale === "ar";
    const footer = `
      <div style="width:100%;padding:0 14mm;font-size:7.5px;color:#4a5d73;display:flex;justify-content:space-between;direction:${ar ? "rtl" : "ltr"};font-family:'Segoe UI','Noto Sans Arabic','DejaVu Sans',Tahoma,Arial,sans-serif">
        <span>${ar ? site.nameAr : site.nameEn} · <span dir="ltr">${site.phone.display}</span></span>
        <span><span dir="ltr">${opts.ref}</span> · ${ar ? "صفحة" : "Page"} <span class="pageNumber"></span> ${ar ? "من" : "of"} <span class="totalPages"></span></span>
      </div>`;
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footer,
      tagged: true,
      outline: true,
    });

    await mkdir(CACHE_DIR, { recursive: true });
    // Drop older cached versions of this quote, then keep the new one.
    const prefix = `${opts.cacheKey.split("-")[0]}-`;
    for (const f of await readdir(/*turbopackIgnore: true*/ CACHE_DIR).catch(() => [] as string[]))
      if (f.startsWith(prefix)) await unlink(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ CACHE_DIR, f)).catch(() => undefined);
    await writeFile(file, pdf);
    return pdf;
  } finally {
    await context.close().catch(() => undefined);
    scheduleClose();
  }
}

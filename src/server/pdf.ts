import "server-only";
import { copyFile, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Browser } from "playwright-core";
import { site } from "@/content/site";
import { sign, verifySignature } from "./security";

export const RENDER_COOKIE = "etijah_render";
// Per-instance cache in the writable temp folder (/tmp on Vercel); safe to lose at any time.
const CACHE_DIR = path.join(tmpdir(), "etijah-pdf-cache");
/** Vercel (or any serverless Linux host): use the bundled @sparticuz/chromium build. */
const SERVERLESS = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

let browserPromise: Promise<Browser> | null = null;
let idleTimer: NodeJS.Timeout | null = null;

/**
 * Serverless Chromium: unpacks the browser into /tmp once per instance and adds an Arabic font
 * (the bundled build only ships Open Sans), so the Arabic page footer is shaped correctly.
 */
async function serverlessLaunchOptions() {
  const { default: Sparticuz } = await import("@sparticuz/chromium");
  const executablePath = await Sparticuz.executablePath();
  const fontsDir = path.join(tmpdir(), "fonts");
  await mkdir(fontsDir, { recursive: true });
  await copyFile(
    path.join(/*turbopackIgnore: true*/ process.cwd(), "assets", "fonts", "NotoSansArabic-Regular.ttf"),
    path.join(fontsDir, "NotoSansArabic-Regular.ttf"),
  ).catch((error) => console.warn("[pdf] Arabic footer font not installed:", error));
  return { executablePath, args: Sparticuz.args };
}

/**
 * Headless Chromium renders the print page to PDF: Arabic shaping and RTL layout are exact,
 * and every <a href> becomes a real clickable link annotation in the PDF. On Vercel the bundled
 * @sparticuz/chromium is used; on a developer machine, the installed Edge (Windows) or Chrome.
 */
async function browser(): Promise<Browser> {
  if (!browserPromise) {
    const { chromium } = await import("playwright-core");
    const launch = SERVERLESS
      ? serverlessLaunchOptions().then((o) => chromium.launch({ ...o, headless: true }))
      : chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chrome", headless: true, args: ["--disable-dev-shm-usage"] });
    browserPromise = launch.catch((error) => {
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

/**
 * Short-lived signed value that lets the renderer open one print page (drafts included).
 * Bound to a resource ("quote:12", "program:5", "report:<hash>") so it opens nothing else.
 */
export async function renderCookieValue(resource: string) {
  const exp = Date.now() + 5 * 60_000;
  return `${exp}.${await sign(`render:${resource}:${exp}`)}`;
}

export async function verifyRenderCookie(resource: string, value: string | undefined) {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || Number(exp) < Date.now()) return false;
  return verifySignature(`render:${resource}:${exp}`, sig);
}

interface RenderOptions {
  resource: string;
  url: string;
  cacheKey: string;
  locale: "ar" | "en";
  ref: string;
  /** Footer identity (Etijah, or the partner company on branded quotes). */
  footer?: { name: string; contact: string | null };
  landscape?: boolean;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function renderPdf(opts: RenderOptions): Promise<Buffer> {
  const file = path.join(CACHE_DIR, `${opts.cacheKey}.pdf`);
  try {
    return await readFile(file);
  } catch {
    /* not cached yet */
  }

  const b = await browser();
  // Preview deployments behind Vercel Deployment Protection: let the renderer through with the
  // project's "Protection Bypass for Automation" secret (system variable, when enabled).
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const context = await b.newContext({
    locale: opts.locale === "ar" ? "ar-IQ" : "en-GB",
    viewport: { width: 1240, height: 1754 },
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : undefined,
  });
  try {
    const url = new URL(opts.url);
    await context.addCookies([
      { name: RENDER_COOKIE, value: await renderCookieValue(opts.resource), domain: url.hostname, path: "/", httpOnly: true, sameSite: "Lax" },
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
        <span>${esc(opts.footer?.name ?? (ar ? site.nameAr : site.nameEn))}${opts.footer ? (opts.footer.contact ? ` · <span dir="ltr">${esc(opts.footer.contact)}</span>` : "") : ` · <span dir="ltr">${site.phone.display}</span>`}</span>
        <span><span dir="ltr">${esc(opts.ref)}</span> · ${ar ? "صفحة" : "Page"} <span class="pageNumber"></span> ${ar ? "من" : "of"} <span class="totalPages"></span></span>
      </div>`;
    const pdf = await page.pdf({
      format: "A4",
      landscape: !!opts.landscape,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footer,
      tagged: true,
      outline: true,
    });

    await mkdir(CACHE_DIR, { recursive: true });
    // Drop older cached versions of this document, then keep the new one.
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

const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

/**
 * Where the headless browser loads a print page. Never trusts an arbitrary Host header
 * (that would let a client point the server's browser at any site): the request origin when it
 * is the public site, one of this deployment's own Vercel hosts, or a local/private address;
 * else the public site.
 */
export function renderOrigin(request: Request): string | null {
  const requested = new URL(request.url);
  const publicOrigin = site.url ? new URL(site.url).origin : null;
  if (requested.origin === publicOrigin || PRIVATE_HOST.test(requested.hostname)) return requested.origin;
  if (requested.protocol === "https:" && vercelHosts().includes(requested.host.toLowerCase())) return requested.origin;
  return publicOrigin;
}

/** This deployment's own hosts on Vercel (system variables, never client input). */
function vercelHosts() {
  return [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter((h): h is string => !!h).map((h) => h.toLowerCase());
}

export const basePath = () => process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** PDF download/preview response (never cached by shared caches, never indexed). */
export function pdfResponse(pdf: Buffer, filename: string, request: Request) {
  const inline = new URL(request.url).searchParams.has("inline");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      // ASCII fallback plus the UTF-8 name (Arabic company names) per RFC 6266 / 5987.
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/[^\w.-]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export const pdfUnavailable = (locale: "ar" | "en") =>
  new Response(
    locale === "ar"
      ? "تعذّر إنشاء ملف PDF حالياً. يمكنك استخدام «طباعة ← حفظ كـ PDF» من صفحة المعاينة."
      : "The PDF could not be generated right now. You can use Print → Save as PDF from the preview page.",
    { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );

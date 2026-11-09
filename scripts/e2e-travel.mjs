// End-to-end test of the travel programs, traveler requests and B2B quotes, in a real browser.
//
//   npm run build && npm run test:e2e          # starts `next start` on a fresh temporary database
//   npm run test:e2e -- --dev                  # uses `next dev` instead (no build needed)
//   E2E_BASE_URL=http://localhost:3101 E2E_DATABASE_PATH=data/etijah.db npm run test:e2e   # an already running server
//
// Uses an installed Edge/Chrome via playwright-core (BROWSER_CHANNEL=msedge|chrome).
// Screenshots and the generated PDF are written to .smoke/travel/.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { startNextServer } from "./lib/next-server.mjs";

const root = path.resolve(import.meta.dirname, "..");
const shots = path.join(root, ".smoke", "travel");
mkdirSync(shots, { recursive: true });
const channel = process.env.BROWSER_CHANNEL ?? (process.platform === "win32" ? "msedge" : "chrome");
const stamp = Date.now().toString(36);
const image = (name) => path.join(root, "assets", "images", `${name}.jpg`);

// ---------------------------------------------------------------- checks
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Scrolls the whole page (so scroll-reveal content is shown), then back to the top. */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.6)) {
      window.scrollTo(0, y);
      await wait(120);
    }
    await wait(900);
    window.scrollTo(0, 0);
    await wait(300);
  });
}

// ---------------------------------------------------------------- server
let server = null;
let base = process.env.E2E_BASE_URL?.replace(/\/$/, "");
let dbPath = process.env.E2E_DATABASE_PATH ? path.resolve(process.env.E2E_DATABASE_PATH) : null;
if (!base) {
  const dev = process.argv.includes("--dev");
  server = await startNextServer({ dev });
  base = server.base;
  dbPath = server.dbPath;
  console.log(`Server (${dev ? "dev" : "start"}) on ${base}, temporary database ${dbPath}`);
}
if (!dbPath) throw new Error("Set E2E_DATABASE_PATH to the database of the server at E2E_BASE_URL.");

// Staff accounts for this run (unique e-mails, so the test can run against any database).
const users = {
  admin: { email: `e2e-admin-${stamp}@etijah.test`, password: "Admin-Pass-2026", role: "admin", name: "مدير الاختبار" },
  sales: { email: `e2e-sales-${stamp}@etijah.test`, password: "Sales-Pass-2026", role: "sales", name: "موظفة المبيعات" },
  content: { email: `e2e-content-${stamp}@etijah.test`, password: "Content-Pass-2026", role: "content", name: "محرر المحتوى" },
};
for (const u of Object.values(users)) {
  execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/db.mjs", "create-staff", "--email", u.email, "--name", u.name, "--role", u.role, "--password", u.password], {
    cwd: root,
    env: { ...process.env, DATABASE_PATH: dbPath },
    stdio: "pipe",
  });
}

const browser = await chromium.launch({ channel });
const problemsOf = (page) => {
  const problems = [];
  page.on("pageerror", (e) => problems.push(`[pageerror] ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource.*(404|429)/.test(m.text()) && problems.push(`[console] ${m.text()}`));
  return problems;
};

async function login(context, user) {
  const page = await context.newPage();
  await page.goto(`${base}/staff/login/`);
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await Promise.all([page.waitForURL(`${base}/staff/`), page.click("form button[type=submit]")]);
  return page;
}

/** Performs `action` and returns the toast it produces (ignores toasts that were already shown). */
async function toastOf(page, action) {
  const last = await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll("[data-toast-id]")].map((t) => Number(t.dataset.toastId))));
  await action();
  const handle = await page.waitForFunction((n) => [...document.querySelectorAll("[data-toast-id]")].find((t) => Number(t.dataset.toastId) > n), last, { timeout: 30000 });
  const el = handle.asElement();
  return { kind: await el.getAttribute("data-toast"), text: (await el.textContent())?.trim() };
}

async function upload(page, label, file) {
  // Keep a handle on the list: a single-image picker removes its upload slot once filled.
  const list = await page.locator(`input[data-upload="${label}"]`).locator("xpath=ancestor::ul[1]").elementHandle();
  const before = await list.evaluate((ul) => ul.querySelectorAll("li img").length);
  await page.setInputFiles(`input[data-upload="${label}"]`, file);
  await page.waitForFunction(([ul, n]) => ul.querySelectorAll("li img").length > n, [list, before], { timeout: 30000 });
}

const future = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const HOTEL_WEB = "https://www.example-hotel-e2e.com/istanbul";
const HOTEL_MAPS = "https://maps.app.goo.gl/e2eHotelTwo";
const COST_MARKER = "777.77";
let programSlug = "";
let quoteId = 0;
let token = "";

try {
  // ============================================================== Access control
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const res = await page.goto(`${base}/staff/programs/`);
    check("[auth] staff page without session redirects to login", page.url().startsWith(`${base}/staff/login`) && res.ok(), page.url());
    // Separate context: the server rejects without reading the body and closes that socket.
    const anon = await browser.newContext();
    const api = await anon.request.post(`${base}/api/staff/media`, { multipart: { file: { name: "x.jpg", mimeType: "image/jpeg", buffer: readFileSync(image("dest-dubai")) } } });
    check("[auth] upload API rejects anonymous requests", api.status() === 401, String(api.status()));
    await anon.close();
    await page.fill("#email", users.admin.email);
    await page.fill("#password", "wrong-password-123");
    await page.click("form button[type=submit]");
    await page.locator("form [role=alert]").waitFor();
    check("[auth] wrong password is rejected", page.url().includes("/staff/login"));
    const head = await ctx.request.get(`${base}/staff/login/`);
    check("[auth] staff pages send noindex + no-store", (head.headers()["x-robots-tag"] ?? "").includes("noindex") && (head.headers()["cache-control"] ?? "").includes("no-store"));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext();
    const page = await login(ctx, users.sales);
    await page.goto(`${base}/staff/users/`);
    check("[roles] sales cannot open user management", page.url().includes("/staff/?denied=1"), page.url());
    await page.goto(`${base}/staff/programs/new/`);
    check("[roles] sales cannot create programs", page.url().includes("denied=1"));
    await page.goto(`${base}/staff/hotels/new/`);
    check("[roles] sales may add hotels (for quotes)", page.url().includes("/staff/hotels/new"));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext();
    const page = await login(ctx, users.content);
    await page.goto(`${base}/staff/quotes/`);
    check("[roles] content editor cannot open company quotes", page.url().includes("denied=1"));
    await ctx.close();
  }

  // ============================================================== Catalog (admin)
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const admin = await login(adminCtx, users.admin);
  const adminProblems = problemsOf(admin);

  // Destination
  await admin.goto(`${base}/staff/destinations/`);
  await admin.getByRole("button", { name: "وجهة جديدة" }).click();
  await admin.selectOption("#dest-country", "TR");
  await admin.fill('input[name="dest_name_ar"]', `إسطنبول ${stamp}`);
  await admin.fill('input[name="dest_name_en"]', `Istanbul ${stamp}`);
  await upload(admin, "صورة الوجهة", image("dest-istanbul"));
  check("[catalog] destination saved", (await toastOf(admin, () => admin.getByRole("button", { name: "حفظ الوجهة" }).click())).kind === "success");

  // Hotels: one with an official website, one with a Google Maps link only.
  const hotels = [
    { ar: `فندق البوسفور ${stamp}`, en: `Bosphorus Palace ${stamp}`, web: HOTEL_WEB, maps: "https://maps.app.goo.gl/e2eHotelOne", img: "dest-istanbul", stars: 5 },
    { ar: `فندق السلطان ${stamp}`, en: `Sultan Suites ${stamp}`, web: "", maps: HOTEL_MAPS, img: "hero-wing", stars: 4 },
  ];
  for (const h of hotels) {
    await admin.goto(`${base}/staff/hotels/new/`);
    await admin.selectOption("#hotel-dest", { label: `إسطنبول ${stamp} — تركيا` });
    await admin.fill('input[name="hotel_name_ar"]', h.ar);
    await admin.fill('input[name="hotel_name_en"]', h.en);
    await admin.getByRole("radio", { name: `${h.stars} نجوم` }).click();
    if (h.web) await admin.fill("#hotel-web", h.web);
    await admin.fill("#hotel-maps", h.maps);
    await upload(admin, "الصور", image(h.img));
    await Promise.all([admin.waitForURL(/\/staff\/hotels\/\d+\/$/), admin.getByRole("button", { name: "حفظ الفندق" }).click()]);
    check(`[catalog] hotel saved: ${h.en}`, true);
  }
  // Server-side validation: a javascript: URL must be rejected.
  await admin.fill("#hotel-web", "javascript:alert(1)");
  const bad = await toastOf(admin, () => admin.getByRole("button", { name: "حفظ الفندق" }).click());
  check("[validation] unsafe hotel URL rejected by the server", bad.kind === "error" && bad.text.includes("الرابط"), bad.text);

  // Program (group tour) with everything, then publish.
  await admin.goto(`${base}/staff/programs/new/`);
  await admin.getByText("كروب سياحي", { exact: true }).click();
  await admin.fill('input[name="title_ar"]', `رحلة إسطنبول الشتوية ${stamp}`);
  await admin.fill('input[name="title_en"]', `Istanbul Winter Escape ${stamp}`);
  await admin.fill('textarea[name="summary_ar"]', "سبعة أيام بين البوسفور والأسواق القديمة مع فنادق مختارة وجولات يومية.");
  await admin.fill('textarea[name="summary_en"]', "Seven days between the Bosphorus and the old bazaars, with selected hotels and daily tours.");
  await admin.fill('textarea[name="description_ar"]', "برنامج متكامل يشمل الطيران والإقامة والجولات مع مرشد يتحدث العربية.");
  await admin.locator("label", { hasText: `إسطنبول ${stamp}` }).click();
  await admin.fill("#p-days", "7");
  await admin.fill("#p-nights", "6");
  await upload(admin, "صورة الغلاف", image("dest-istanbul"));
  await upload(admin, "معرض الصور", image("cta-sky"));
  await upload(admin, "معرض الصور", image("why-traveler"));
  await admin.fill("#price-amt-0", "1250");
  await admin.getByRole("button", { name: "إضافة سعر" }).click();
  await admin.fill("#price-ar-1", "للطفل (2-11 سنة)");
  await admin.fill("#price-amt-1", "890");
  for (const [i, h] of hotels.entries()) {
    await admin.getByRole("button", { name: "إضافة فندق" }).click();
    await admin.selectOption(`#hotel-${i}`, { label: `${h.ar} (${h.stars}★)` });
    await admin.fill(`#hotel-n-${i}`, "3");
  }
  await admin.fill('input[name="day0_ar"]', "الوصول إلى إسطنبول والاستقبال");
  for (const title of ["جولة البوسفور والمساجد التاريخية", "السوق الكبير وتقسيم"]) {
    await admin.getByRole("button", { name: "إضافة يوم" }).click();
    const n = await admin.locator('input[name^="day"][name$="_ar"]').count();
    await admin.fill(`input[name="day${n - 1}_ar"]`, title);
  }
  for (const [svc, state] of [["تذاكر الطيران ذهاباً وإياباً", "مشمولة"], ["الإقامة الفندقية", "مشمولة"], ["الجولات السياحية", "مشمولة"], ["التأشيرة", "غير مشمولة"]]) {
    await admin.getByRole("radiogroup", { name: svc }).getByRole("radio", { name: state, exact: true }).click();
  }
  await admin.getByRole("button", { name: "إضافة موعد" }).click();
  await admin.locator('[id^="dep-d-"]').first().fill(future(45));
  await admin.locator('[id^="dep-r-"]').first().fill(future(51));
  await admin.locator('[id^="dep-t-"]').first().fill("20");
  await admin.locator('[id^="dep-h-"]').first().fill("2");
  const pub = await toastOf(admin, () => admin.getByRole("button", { name: "حفظ ونشر للمسافرين" }).click());
  await admin.waitForURL(/\/staff\/programs\/\d+\/$/, { timeout: 30000 });
  check("[program] created and published", pub.kind === "success" && pub.text.includes("نشره"), pub.text);
  await admin.reload();
  check("[program] status shows «منشور»", (await admin.locator("[data-editor-panel]").textContent()).includes("منشور"));
  programSlug = (await admin.getByRole("link", { name: "عرض الصفحة العامة" }).getAttribute("href")).match(/programs\/([^/]+)/)[1];
  check("[program] readable slug from English title", programSlug.startsWith("istanbul-winter-escape"), programSlug);
  await admin.waitForLoadState("networkidle");
  await admin.screenshot({ path: path.join(shots, "staff-program-editor.png"), caret: "initial" });

  // ============================================================== Public pages
  const pubCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pub1 = await pubCtx.newPage();
  const pubProblems = problemsOf(pub1);
  await pub1.goto(`${base}/programs/`, { waitUntil: "networkidle" });
  check("[public] offers page lists the program", (await pub1.locator(`a[href$="/programs/${programSlug}/"]`).count()) > 0);
  await pub1.goto(`${base}/programs/?country=TR`, { waitUntil: "networkidle" });
  check("[public] country filter keeps it", (await pub1.locator(`a[href$="/programs/${programSlug}/"]`).count()) > 0);
  await pub1.goto(`${base}/programs/?country=AE&kind=package`, { waitUntil: "networkidle" });
  check("[public] other filters hide it", (await pub1.locator(`a[href$="/programs/${programSlug}/"]`).count()) === 0);
  await pub1.goto(`${base}/programs/`, { waitUntil: "networkidle" });
  await scrollThrough(pub1);
  await sleep(1200);
  check("[public] offer cards become visible after scrolling", await pub1.evaluate(() => [...document.querySelectorAll("#results [data-reveal]")].every((el) => Number(getComputedStyle(el).opacity) > 0.98)));
  await pub1.screenshot({ path: path.join(shots, "public-offers.png"), fullPage: true });

  await pub1.goto(`${base}/programs/${programSlug}/`, { waitUntil: "networkidle" });
  check("[detail] title and price", (await pub1.locator("h1").textContent()).includes("رحلة إسطنبول") && (await pub1.textContent("body")).includes("1,250"));
  const hotelHref = await pub1.locator("[data-hotel-link]").first().getAttribute("href");
  check("[detail] hotel name links to the hotel page", /\/hotels\/bosphorus-palace/.test(hotelHref ?? ""), hotelHref);
  check("[detail] official website link shown", (await pub1.locator(`a[href="${HOTEL_WEB}"]`).count()) > 0);
  check("[detail] seats left = 18 (20 − 2 held)", (await pub1.locator("#departures").textContent()).includes("18"));
  check("[detail] TouristTrip JSON-LD", await pub1.evaluate(() => JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)["@type"] === "TouristTrip"));
  await scrollThrough(pub1);
  await pub1.screenshot({ path: path.join(shots, "public-program.png"), fullPage: true });

  await pub1.goto(`${base}${hotelHref}`, { waitUntil: "networkidle" });
  check("[hotel] hotel page with website + map", (await pub1.locator(`a[href="${HOTEL_WEB}"]`).count()) > 0 && (await pub1.locator('a[href^="https://maps.app.goo.gl/"]').count()) > 0);

  // Trip request: three steps, validation, success with reference.
  await pub1.goto(`${base}/programs/${programSlug}/`, { waitUntil: "networkidle" });
  await pub1.locator("aside").getByRole("button", { name: "احجز رحلتك الآن" }).click();
  const dialog = pub1.locator("dialog[open]");
  await dialog.waitFor();
  check("[request] step 1 shows the group date preselected", await dialog.locator('input[name="departure"]:checked').count() === 1);
  await dialog.getByRole("button", { name: "زيادة: البالغون" }).click();
  await pub1.waitForTimeout(800); // humans take a moment; the server rejects instant bot submissions
  await dialog.getByRole("button", { name: "التالي" }).click();
  await dialog.locator("#req-name").fill("زينب علي حسن");
  await dialog.locator("#req-phone").fill("12");
  await dialog.getByRole("button", { name: "التالي" }).click();
  check("[request] invalid phone blocked on step 2", (await dialog.locator("#req-phone-err").count()) === 1);
  await dialog.locator("#req-phone").fill("0770 123 4567");
  await dialog.locator("#req-email").fill("zainab@example.com");
  await dialog.getByRole("button", { name: "التالي" }).click();
  check("[request] review shows details", (await dialog.textContent()).includes("زينب علي حسن") && (await dialog.textContent()).includes("3 بالغ"));
  await pub1.screenshot({ path: path.join(shots, "public-request-review.png") });
  await sleep(1500);
  await dialog.locator("[data-submit-request]").click();
  await dialog.locator("[data-request-ref]").waitFor({ timeout: 20000 });
  const ref = (await dialog.locator("[data-request-ref]").textContent()).trim();
  check("[request] success with reference number", /^REQ-\d{4}-\d{5}$/.test(ref), ref);
  const wa = await dialog.locator('a[href*="wa.me"]').getAttribute("href");
  check("[request] WhatsApp follow-up prefilled with the reference", decodeURIComponent(wa).includes(ref));
  await pub1.screenshot({ path: path.join(shots, "public-request-success.png") });
  check("[public] no console errors", pubProblems.length === 0, pubProblems.slice(0, 4).join(" | "));

  // English + mobile
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await mob.newPage();
  await m.goto(`${base}/en/programs/${programSlug}/`, { waitUntil: "networkidle" });
  check("[en] English detail page is LTR", (await m.evaluate(() => document.documentElement.dir)) === "ltr" && (await m.locator("h1").textContent()).includes("Istanbul Winter Escape"));
  check("[mobile] no horizontal overflow", await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await m.screenshot({ path: path.join(shots, "mobile-program-en.png"), scale: "css" });
  await m.goto(`${base}/programs/`, { waitUntil: "networkidle" });
  await scrollThrough(m);
  check("[mobile] offers page no horizontal overflow", await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await m.screenshot({ path: path.join(shots, "mobile-offers.png"), fullPage: true, scale: "css" });
  await m.goto(`${base}/programs/${programSlug}/`, { waitUntil: "networkidle" });
  await m.getByRole("button", { name: "احجز رحلتك الآن" }).last().click();
  await m.locator("dialog[open]").waitFor();
  const box = await m.locator("dialog[open]").boundingBox();
  check("[mobile] request dialog is full-screen", box && box.width >= 389 && box.height >= 800, JSON.stringify(box));
  await m.screenshot({ path: path.join(shots, "mobile-request.png"), scale: "css" });
  await mob.close();

  // ============================================================== Staff: requests
  await admin.goto(`${base}/staff/requests/`);
  check("[staff] request appears in the portal", (await admin.locator("table").textContent()).includes(ref));
  await admin.getByRole("link", { name: ref }).click();
  await admin.selectOption("#lead-status", "confirmed");
  await admin.fill("#lead-note", "تم استلام العربون وتأكيد المقاعد.");
  check("[staff] status + note saved", (await toastOf(admin, () => admin.getByRole("button", { name: "حفظ التحديث" }).click())).kind === "success");
  await admin.reload();
  check("[staff] timeline shows the change", (await admin.textContent("body")).includes("تم استلام العربون"));
  await pub1.goto(`${base}/programs/${programSlug}/`, { waitUntil: "networkidle" });
  check("[seats] confirmed travelers reduce seats (18 → 15)", (await pub1.locator("#departures").textContent()).includes("15"));

  // ============================================================== B2B quote
  await admin.goto(`${base}/staff/companies/new/`);
  await admin.fill("#co-name", `شركة نفط الجنوب ${stamp}`);
  await admin.fill("#co-name-en", `South Oil Co. ${stamp}`);
  await Promise.all([admin.waitForURL(/\/staff\/companies\/\d+\/$/), admin.getByRole("button", { name: "حفظ", exact: true }).click()]);
  await admin.getByRole("button", { name: "إضافة" }).click();
  await admin.fill("#ct-name", "م. حيدر الموسوي");
  await admin.fill("#ct-pos", "مدير الموارد البشرية");
  await admin.fill("#ct-phone", "+9647701112233");
  await admin.fill("#ct-email", "hr@example.com");
  check("[b2b] company and contact saved", (await toastOf(admin, () => admin.locator("dialog[open]").getByRole("button", { name: "حفظ" }).click())).kind === "success");
  await admin.getByRole("link", { name: "عرض سعر جديد" }).first().click();
  await admin.waitForURL(/quotes\/new/);
  check("[b2b] new quote preselects the company", (await admin.locator("#q-company").inputValue()) !== "");
  await admin.fill("#q-adults", "20");
  await admin.fill("#q-rooms", "10");
  await admin.fill("#q-start", future(60));
  await admin.fill("#q-end", future(66));
  await admin.selectOption("#q-import", { index: 1 });
  await admin.getByRole("button", { name: "استيراد" }).click();
  await admin.waitForFunction(() => document.querySelectorAll('[id^="it-l-"]').length >= 2);
  check("[b2b] program imported (days, hotels, prices)", (await admin.locator('[id^="qh-"]').count()) > 0 && (await admin.inputValue("#q-title")).includes("رحلة إسطنبول"));
  await admin.locator('[id^="it-c-"]').first().fill(COST_MARKER);
  await admin.getByRole("button", { name: "بند", exact: true }).nth(2).click();
  const optLabel = admin.locator('[id^="it-l-"]').last();
  await optLabel.fill("رحلة اختيارية إلى بورصة");
  await admin.locator('[id^="it-p-"]').last().fill("95");
  await admin.selectOption("#q-disc-kind", "percent");
  await admin.fill("#q-disc-val", "5");
  await admin.fill("#q-disc-label", "خصم الشركات");
  await Promise.all([admin.waitForURL(/\/staff\/quotes\/\d+\/$/, { timeout: 30000 }), admin.getByRole("button", { name: "حفظ كمسودة" }).click()]);
  quoteId = Number(admin.url().match(/quotes\/(\d+)/)[1]);
  token = (await admin.getByRole("link", { name: "معاينة الصفحة" }).getAttribute("href")).match(/\/q\/([^/]+)\//)[1];
  check("[b2b] quote saved with a 256-bit link token", token.length === 43, token.slice(0, 6) + "…");
  await admin.waitForLoadState("networkidle");
  await admin.screenshot({ path: path.join(shots, "staff-quote-editor.png"), caret: "initial" });

  const client = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const c = await client.newPage();
  const draftRes = await c.goto(`${base}/q/${token}/`);
  check("[b2b] draft quote is not visible to clients", draftRes.status() === 404, String(draftRes.status()));
  const staffView = await admin.context().newPage();
  await staffView.goto(`${base}/q/${token}/`, { waitUntil: "networkidle" });
  check("[b2b] staff can preview the draft", (await staffView.textContent("body")).includes("معاينة الموظف"));
  await staffView.close();

  check("[b2b] quote marked as sent", (await toastOf(admin, () => admin.getByRole("button", { name: "تسجيل كمُرسل يدوياً" }).click())).kind === "success");

  await c.goto(`${base}/q/${token}/`, { waitUntil: "networkidle" });
  const html = await c.content();
  check("[b2b] client sees the quote for the company", html.includes(`شركة نفط الجنوب ${stamp}`));
  check("[b2b] hotel names link to approved URLs", (await c.locator(`a[data-hotel-link][href="${HOTEL_WEB}"]`).count()) > 0 && (await c.locator(`a[data-hotel-link][href="${HOTEL_MAPS}"]`).count()) > 0);
  check("[b2b] internal cost never reaches the client page", !html.includes(COST_MARKER) && !html.includes("unit_cost") && !html.includes("internal_notes"));
  check("[b2b] quote page sends noindex + no-referrer", (await c.evaluate(() => document.querySelector('meta[name="robots"]')?.content ?? "")).includes("noindex") && (await c.evaluate(() => document.querySelector('meta[name="referrer"]')?.content)) === "no-referrer");
  await c.screenshot({ path: path.join(shots, "client-quote.png"), fullPage: true });

  // PDF: download as the client and verify the hotel links are real link annotations.
  const pdfRes = await client.request.get(`${base}/q/${token}/pdf/`);
  const pdf = await pdfRes.body();
  writeFileSync(path.join(shots, "quote.pdf"), pdf);
  check("[pdf] generated", pdfRes.status() === 200 && pdfRes.headers()["content-type"] === "application/pdf" && pdf.subarray(0, 5).toString() === "%PDF-", `${pdf.length} bytes`);
  const raw = pdf.toString("latin1");
  const uris = [...raw.matchAll(/\/URI\s*\(([^)]*)\)/g)].map((x) => x[1]);
  check("[pdf] hotel website is a clickable link annotation", uris.includes(HOTEL_WEB), uris.filter((u) => u.includes("example-hotel")).join(" "));
  check("[pdf] Google Maps fallback link present", uris.includes(HOTEL_MAPS));
  check("[pdf] link annotations have a clickable area", /\/Subtype\s*\/Link[\s\S]{0,200}\/Rect\s*\[\s*[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s*\]/.test(raw) || /\/Rect\s*\[[^\]]+\][\s\S]{0,200}\/Subtype\s*\/Link/.test(raw));
  check("[pdf] internal cost not in the PDF", !raw.includes(COST_MARKER));
  await c.goto(`${base}/q/${token}/print/`, { waitUntil: "networkidle" });
  check("[pdf] in the print layout the link sits on the hotel name", (await c.locator(`a[data-hotel-link][href="${HOTEL_WEB}"]`).textContent()).includes(`Bosphorus`) || (await c.locator(`a[data-hotel-link][href="${HOTEL_WEB}"]`).textContent()).includes("البوسفور"));
  await c.screenshot({ path: path.join(shots, "client-quote-print.png"), fullPage: true });

  // Client accepts.
  await c.goto(`${base}/q/${token}/`, { waitUntil: "networkidle" });
  await c.locator("[data-quote-accept]").first().click();
  const rd = c.locator("dialog[open]");
  await rd.locator("input").first().fill("حيدر الموسوي");
  await rd.locator('input[type="checkbox"]').check();
  await rd.getByRole("button", { name: "تأكيد القبول" }).click();
  await c.locator('[role="status"]').filter({ hasText: "قبول" }).first().waitFor({ timeout: 15000 });
  await admin.goto(`${base}/staff/quotes/${quoteId}/`);
  const staffText = await admin.textContent("body");
  check("[b2b] staff sees «مقبول», viewed, PDF download in the log", staffText.includes("مقبول") && staffText.includes("فتح العميل العرض") && staffText.includes("نزّل العميل ملف PDF"));

  // Revoke the link: the client loses access.
  admin.once("dialog", (d) => d.accept());
  await toastOf(admin, () => admin.getByRole("button", { name: "إبطال" }).click());
  const revoked = await client.request.get(`${base}/q/${token}/`);
  check("[b2b] revoked link returns 404", revoked.status() === 404, String(revoked.status()));
  const fake = await client.request.get(`${base}/q/${"A".repeat(43)}/`);
  check("[b2b] unknown token returns 404", fake.status() === 404);

  // English version: duplicate the quote, switch its language, send it, open it as the client.
  await admin.getByRole("button", { name: "نسخ كعرض جديد" }).click();
  await admin.waitForURL((u) => /\/staff\/quotes\/\d+\/$/.test(u.pathname) && !u.pathname.endsWith(`/${quoteId}/`), { timeout: 30000 });
  await admin.getByRole("radio", { name: "English" }).click();
  await admin.fill("#q-title", `Istanbul incentive trip ${stamp}`);
  check("[en-quote] saved in English", (await toastOf(admin, () => admin.getByRole("button", { name: "حفظ التعديلات" }).click())).kind === "success");
  await toastOf(admin, () => admin.getByRole("button", { name: "تسجيل كمُرسل يدوياً" }).click());
  const enToken = (await admin.getByRole("link", { name: "معاينة الصفحة" }).getAttribute("href")).match(/\/q\/([^/]+)\//)[1];
  check("[en-quote] duplicate gets its own secret link", enToken !== token);
  // New tab: the first tab reloads itself after the acceptance above.
  const c2 = await client.newPage();
  await c2.goto(`${base}/q/${enToken}/`, { waitUntil: "networkidle" });
  check(
    "[en-quote] client page is English, left-to-right",
    (await c2.evaluate(() => `${document.documentElement.lang}/${document.documentElement.dir}`)) === "en/ltr" && (await c2.textContent("body")).includes("Accept quotation"),
  );
  await c2.screenshot({ path: path.join(shots, "client-quote-en.png"), fullPage: true });
  const enPdf = await (await client.request.get(`${base}/q/${enToken}/pdf/`)).body();
  writeFileSync(path.join(shots, "quote-en.pdf"), enPdf);
  const enUris = [...enPdf.toString("latin1").matchAll(/\/URI\s*\(([^)]*)\)/g)].map((x) => x[1]);
  check("[en-quote] English PDF with clickable hotel links", enPdf.subarray(0, 5).toString() === "%PDF-" && enUris.includes(HOTEL_WEB) && enUris.includes(HOTEL_MAPS), `${enPdf.length} bytes`);
  await client.close();

  // ============================================================== Home + SEO
  await pub1.goto(`${base}/`, { waitUntil: "load" }).catch(() => pub1.goto(`${base}/`, { waitUntil: "load" }));
  const featured = await pub1.locator(`#offers a[href$="/programs/${programSlug}/"]`).first().waitFor({ timeout: 15000 }).then(() => true, () => false);
  check("[home] featured offers section shows the program", featured);
  check("[home] header links to the offers page", (await pub1.locator('header a[href="/programs/"]').count()) > 0);
  const robots = await (await pubCtx.request.get(`${base}/robots.txt`)).text();
  check("[seo] robots.txt disallows /staff/ and /q/", robots.includes("Disallow: /staff/") && robots.includes("Disallow: /q/"));
  check("[staff] no client errors in the portal", adminProblems.length === 0, adminProblems.slice(0, 4).join(" | "));
  await pubCtx.close();
  await adminCtx.close();
} catch (error) {
  check("unexpected error", false, error.stack ?? String(error));
} finally {
  await browser.close();
  if (server) await server.stop();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${shots}`);
process.exit(failed.length ? 1 : 0);

// End-to-end acceptance test of the travel system on MongoDB, in a real browser.
//
//   npm run build && npm run test:e2e        starts `next start` with its own throw-away MongoDB replica set
//   npm run test:e2e -- --dev                uses `next dev` instead (no build needed)
//
// Covers the 15 acceptance scenarios (hotel library & rates, fixed/custom programs, exports, B2B
// companies, branded PDFs, data isolation, airlines, commissions, tickets, reports, no internal data
// in client views) plus roles, seat concurrency and the audit log. Uses an installed Edge/Chrome via
// playwright-core (BROWSER_CHANNEL=msedge|chrome). Screenshots go to .smoke/travel/.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";
import { chromium } from "playwright-core";
import { startNextServer } from "./lib/next-server.mjs";

const root = path.resolve(import.meta.dirname, "..");
const shots = path.join(root, ".smoke", "travel");
mkdirSync(shots, { recursive: true });
const channel = process.env.BROWSER_CHANNEL ?? (process.platform === "win32" ? "msedge" : "chrome");
const image = (name) => path.join(root, "assets", "images", `${name}.jpg`);
const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10); // Baghdad date
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const tomorrow = addDays(today, 1);

// ---------------------------------------------------------------- checks
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Internal values that must never reach a client page, PDF, text export or the partner portal.
const COST = "77.77";
const ITEM_COST = "777.77";
const INTERNAL = "INTERNAL-MARK-9431";
const leaks = (html) => [COST, INTERNAL, "night_cost", "unit_cost", "base_cost", "internal_notes", "etijah_commission"].filter((m) => html.includes(m));

// ---------------------------------------------------------------- server + database
const server = await startNextServer({ dev: process.argv.includes("--dev") });
const base = server.base;
console.log(`Server on ${base}, MongoDB ${server.mongo.dbName}`);
const mongo = await MongoClient.connect(server.mongo.uri);
const db = mongo.db(server.mongo.dbName);

const users = {
  admin: { email: "e2e-admin@etijah.test", password: "Admin-Pass-2026", role: "admin", name: "مدير الاختبار" },
  tourism: { email: "e2e-tourism@etijah.test", password: "Tour-Pass-2026", role: "tourism_manager", name: "مدير السياحة" },
  sales: { email: "e2e-sales@etijah.test", password: "Sales-Pass-2026", role: "sales", name: "موظفة المبيعات" },
  accountant: { email: "e2e-acc@etijah.test", password: "Acc-Pass-2026", role: "accountant", name: "المحاسب" },
  content: { email: "e2e-content@etijah.test", password: "Content-Pass-2026", role: "content", name: "محرر المحتوى" },
};
// Async on purpose: a synchronous child would block this process, which owns the test mongod.
for (const u of Object.values(users)) {
  await promisify(execFile)(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/db.mjs", "create-staff", "--email", u.email, "--name", u.name, "--role", u.role, "--password", u.password], {
    cwd: root,
    env: { ...process.env, ...server.env },
  });
}

const browser = await chromium.launch({ channel });
const problemsOf = (page) => {
  const problems = [];
  page.on("pageerror", (e) => problems.push(`[pageerror] ${new URL(page.url()).pathname} ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource.*(404|429)/.test(m.text()) && problems.push(`[console] ${new URL(page.url()).pathname} ${m.text()}`));
  return problems;
};

async function newPage(user, viewport = { width: 1440, height: 1000 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  if (user) {
    await page.goto(`${base}/staff/login/`, { waitUntil: "networkidle" });
    await page.fill("#email", user.email);
    await page.fill("#password", user.password);
    await Promise.all([page.waitForURL(`${base}/staff/`), page.click("form button[type=submit]")]);
  }
  return page;
}

/** Performs `action` and returns the toast it produces (ignores toasts that were already shown). */
async function toastOf(page, action) {
  const last = await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll("[data-toast-id]")].map((t) => Number(t.dataset.toastId))));
  await action();
  const handle = await page.waitForFunction((n) => [...document.querySelectorAll("[data-toast-id]")].find((t) => Number(t.dataset.toastId) > n), last, { timeout: 45000 });
  const el = handle.asElement();
  return { kind: await el.getAttribute("data-toast"), text: (await el.textContent())?.trim() };
}

async function upload(page, label, file) {
  const list = await page.locator(`input[data-upload="${label}"]`).locator("xpath=ancestor::ul[1]").elementHandle();
  const before = await list.evaluate((ul) => ul.querySelectorAll("li img").length);
  await page.setInputFiles(`input[data-upload="${label}"]`, file);
  await page.waitForFunction(([ul, n]) => ul.querySelectorAll("li img").length > n, [list, before], { timeout: 30000 });
}

const idFromUrl = (page) => Number(new URL(page.url()).pathname.match(/\/(\d+)\/?$/)?.[1]);

try {
  // ============================================================== Access control & roles
  {
    const page = await newPage(null);
    await page.goto(`${base}/staff/programs/`, { waitUntil: "networkidle" });
    check("[auth] staff page without session redirects to login", page.url().startsWith(`${base}/staff/login`));
    await page.goto(`${base}/b2b/quotes/`, { waitUntil: "networkidle" });
    check("[auth] partner portal without session redirects to its login", page.url().startsWith(`${base}/b2b/login`));
    await page.close();
  }
  const denied = async (user, paths, allowed = []) => {
    const page = await newPage(user);
    for (const p of paths) {
      await page.goto(`${base}${p}`, { waitUntil: "networkidle" });
      check(`[roles] ${user.role} cannot open ${p}`, page.url().includes("denied=1"), page.url());
    }
    for (const p of allowed) {
      await page.goto(`${base}${p}`, { waitUntil: "networkidle" });
      check(`[roles] ${user.role} can open ${p}`, page.url().startsWith(`${base}${p}`), page.url());
    }
    await page.context().close();
  };
  await denied(users.sales, ["/staff/users/", "/staff/programs/new/", "/staff/hotels/new/", "/staff/airlines/new/", "/staff/tickets/"], ["/staff/hotels/", "/staff/quotes/new/"]);
  await denied(users.accountant, ["/staff/hotels/new/", "/staff/quotes/", "/staff/programs/new/"], ["/staff/tickets/new/", "/staff/reports/", "/staff/commissions/etijah/"]);
  await denied(users.content, ["/staff/quotes/", "/staff/hotels/new/", "/staff/reports/", "/staff/airlines/"], ["/staff/programs/new/"]);
  await denied(users.tourism, ["/staff/tickets/", "/staff/users/", "/staff/companies/"], ["/staff/hotels/new/", "/staff/programs/new/"]);

  // ============================================================== Catalog basics (admin)
  const admin = await newPage(users.admin);
  const adminProblems = problemsOf(admin);
  await admin.goto(`${base}/staff/destinations/`, { waitUntil: "networkidle" });
  await admin.getByRole("button", { name: "وجهة جديدة" }).click();
  await admin.selectOption("#dest-country", "TR");
  await admin.fill('input[name="dest_name_ar"]', "إسطنبول");
  await admin.fill('input[name="dest_name_en"]', "Istanbul");
  await admin.fill("#dest-airport", "IST");
  check("[catalog] destination saved", (await toastOf(admin, () => admin.getByRole("button", { name: "حفظ الوجهة" }).click())).kind === "success");
  const dest = await db.collection("destinations").findOne({ name_en: "Istanbul" });
  check("[geo] destination keeps its kind and nearest airport (IATA)", dest?.kind === "city" && dest.airport_code === "IST", JSON.stringify({ kind: dest?.kind, airport: dest?.airport_code }));

  // Reference cities: import one country from the ready-made list (additive, no duplicates).
  {
    const { GEO_COUNTRIES } = await import("../src/data/destinations.ts");
    const ge = GEO_COUNTRIES.find((c) => c.code === "GE");
    const tr = GEO_COUNTRIES.find((c) => c.code === "TR");
    await admin.goto(`${base}/staff/destinations/`, { waitUntil: "networkidle" });
    await admin.getByRole("button", { name: "اختيار دول محددة" }).click();
    const t = await toastOf(admin, () => admin.click('[data-import-geo="GE"]'));
    const geRows = await db.collection("destinations").find({ country_code: "GE" }).toArray();
    check("[geo] importing Georgia adds its reference cities with Arabic/English names and airports", t.kind === "success" && geRows.length === ge.items.length && geRows.every((d) => d.name_ar && d.name_en && d.ref) && geRows.find((d) => d.ref === "batumi")?.airport_code === "BUS", `${t.text} · ${geRows.length}/${ge.items.length}`);
    const again = await toastOf(admin, () => admin.click('[data-import-geo="TR"]'));
    const trRows = await db.collection("destinations").find({ country_code: "TR" }).toArray();
    check("[geo] importing Türkiye matches the existing «إسطنبول» instead of duplicating it", again.kind === "success" && trRows.length === tr.items.length && trRows.filter((d) => d.name_en === "Istanbul").length === 1 && (await db.collection("destinations").findOne({ _id: dest._id })).ref === "istanbul", `${trRows.length}/${tr.items.length}`);
    await admin.screenshot({ path: path.join(shots, "destinations.png") });
    await admin.fill("[data-destination-filter]", "باتومي");
    check("[geo] destinations list searches across hundreds of rows", (await admin.locator("[data-destination-row]").count()) === 1);
  }

  // ============================================================== 11. Airlines & issuance procedure
  async function createAirline(a) {
    await admin.goto(`${base}/staff/airlines/new/`, { waitUntil: "networkidle" });
    await admin.fill("[data-airline-name-ar]", a.ar);
    await admin.fill("[data-airline-name-en]", a.en);
    await admin.fill("[data-airline-iata]", a.iata);
    await admin.selectOption("[data-issue-method]", a.method);
    await admin.fill("[data-issue-portal]", a.portal);
    await admin.fill("[data-issue-instructions]", a.instructions);
    const t = await toastOf(admin, () => admin.click("[data-save-airline]"));
    if (t.kind !== "success") throw new Error(`airline not saved: ${t.text}`);
    await admin.waitForURL(/\/staff\/airlines\/\d+\/$/);
    return idFromUrl(admin);
  }
  const tkId = await createAirline({ ar: "الخطوط التركية", en: "Turkish Airlines", iata: "TK", method: "gds", portal: "https://www.turkishairlines.com/", instructions: "الإصدار عبر Amadeus من مكتب النجف، ثم إرسال نسخة للمسافر." });
  const iaId = await createAirline({ ar: "الخطوط الجوية العراقية", en: "Iraqi Airways", iata: "IA", method: "airline_portal", portal: "https://www.iraqiairways.com/", instructions: "الحجز من بوابة الوكلاء ثم الدفع من الرصيد." });
  const tk = await db.collection("airlines").findOne({ _id: tkId });
  check("[11] airline saved with IATA and issuance method", tk?.iata === "TK" && tk.issuance.method === "gds" && tk.issuance.portal_url === "https://www.turkishairlines.com/", JSON.stringify(tk?.issuance?.method));
  // No passwords in plain text.
  await admin.fill("[data-issue-access]", "كلمة المرور: Secret123");
  const pw = await toastOf(admin, () => admin.click("[data-save-airline]"));
  check("[11] a password typed into the procedure is refused", pw.kind === "error" && pw.text.includes("كلمات المرور"), pw.text);
  await admin.fill("[data-issue-access]", "اسم المستخدم العام: NJF-AGENT");
  await toastOf(admin, () => admin.click("[data-save-airline]"));
  await admin.goto(`${base}/staff/issuance/`, { waitUntil: "networkidle" });
  check("[11] issuance overview shows each airline's method", (await admin.locator(`[data-issuance="TK"]`).textContent()).includes("نظام GDS"));

  // ============================================================== 12. Etijah commissions (independent from company commissions)
  async function addRule(page, url, scope, f) {
    await page.goto(`${base}${url}`, { waitUntil: "networkidle" });
    await page.click(`[data-add-rule="${scope}"]`);
    if (f.airline) await page.selectOption("[data-rule-airline]", String(f.airline));
    if (f.company) await page.selectOption("[data-rule-company]", String(f.company));
    if (f.kind) await page.selectOption("[data-rule-kind]", f.kind);
    if (f.rate) await page.fill("[data-rule-rate]", f.rate);
    if (f.basis) await page.selectOption("[data-rule-basis]", f.basis);
    if (f.from) await page.fill("[data-rule-from]", f.from);
    return toastOf(page, () => page.click("[data-save-rule]"));
  }
  check("[12] Etijah commission TK 5% on base fare saved", (await addRule(admin, `/staff/airlines/${tkId}/`, "etijah", { rate: "5", basis: "base_fare" })).kind === "success");
  check("[12] Iraqi Airways set as net fare (no commission)", (await addRule(admin, `/staff/airlines/${iaId}/`, "etijah", { kind: "net_fare" })).kind === "success");

  // ============================================================== 1. Hotel library with room types and rates
  const hotelIds = [];
  const hotelsSpec = [
    { ar: "فندق الأمل", en: "Amal Hotel", stars: 3, price: "100", web: "https://www.amal-hotel.example/", img: "dest-istanbul" },
    { ar: "فندق البوسفور", en: "Bosphorus Hotel", stars: 4, price: "150", web: "https://www.bosphorus-hotel.example/", img: "hero-wing" },
    { ar: "قصر السلطان", en: "Sultan Palace", stars: 5, price: "220", web: "https://www.sultan-palace.example/", img: "cta-sky" },
  ];
  for (const h of hotelsSpec) {
    await admin.goto(`${base}/staff/hotels/new/`, { waitUntil: "networkidle" });
    await admin.selectOption("#hotel-dest", String(dest._id));
    await admin.fill('input[name="hotel_name_ar"]', h.ar);
    await admin.fill('input[name="hotel_name_en"]', h.en);
    await admin.getByRole("radio", { name: `${h.stars} نجوم` }).click();
    await admin.fill("#hotel-web", h.web);
    await upload(admin, "الصور", image(h.img));
    await Promise.all([admin.waitForURL(/\/staff\/hotels\/\d+\/$/), admin.click("[data-save-hotel]")]);
    const id = idFromUrl(admin);
    hotelIds.push(id);
    await admin.click("[data-add-rate]");
    await admin.locator('[data-rate-row="new"] input[aria-label="التكلفة"]').fill(COST);
    await admin.locator('[data-rate-row="new"] input[aria-label="سعر البيع"]').fill(h.price);
    const t = await toastOf(admin, () => admin.click("[data-save-rates]"));
    check(`[1] hotel ${h.en} saved with room types and a nightly rate`, t.kind === "success", t.text);
  }
  const libHotels = await db.collection("hotels").find({ _id: { $in: hotelIds } }).toArray();
  check("[1] library stores cost and selling price separately", libHotels.every((h) => h.room_types.length === 2 && h.rates.length === 1 && h.rates[0].cost === 7777 && h.rates[0].price > 0), libHotels.map((h) => h.rates[0]?.price).join(","));
  await admin.goto(`${base}/staff/hotels/?stars=5`, { waitUntil: "networkidle" });
  check("[1] hotel list filters by stars", (await admin.locator("[data-hotel-row]").count()) === 1);

  // ============================================================== 3 & 4. Fixed program with several hotels (wizard)
  await admin.goto(`${base}/staff/programs/new/`, { waitUntil: "networkidle" });
  await admin.locator('[data-program-type="fixed"]').check();
  await admin.fill('input[name="title_ar"]', "رحلة إسطنبول السياحية");
  await admin.fill('input[name="title_en"]', "Istanbul Discovery");
  await admin.fill('textarea[name="summary_ar"]', "ثمانية أيام في إسطنبول مع ثلاثة خيارات فنادق وأسعار واضحة.");
  await admin.fill('textarea[name="description_ar"]', "برنامج عام بموعد ثابت من النجف مع الطيران والجولات.");
  await admin.fill("[data-destination-search]", "باتومي");
  check("[geo] wizard searches destinations across countries", (await admin.locator("[data-destinations] label", { hasText: "باتومي" }).count()) === 1);
  await admin.fill("[data-destination-search]", "");
  await admin.selectOption("[data-destination-country-pick]", "TR");
  await admin.locator("[data-destinations] label", { hasText: /^إسطنبول/ }).click();
  await admin.locator("[data-selected-destinations]").screenshot({ path: path.join(shots, "wizard-destinations-bar.png") });
  await admin.locator("[data-destinations]").locator("xpath=ancestor::div[contains(@class,'grid gap-3')][1]").screenshot({ path: path.join(shots, "wizard-destinations.png") });
  check("[geo] wizard shows the chosen city in the selection bar", (await admin.locator("[data-selected-destinations]").textContent()).includes("إسطنبول"));
  await upload(admin, "صورة الغلاف", image("dest-istanbul"));
  await admin.click('[data-step="1"]');
  await admin.fill('input[aria-label="عدد الأيام"]', "8");
  check("[wizard] nights follow the number of days (8 days → 7 nights)", (await admin.inputValue('input[aria-label="عدد الليالي"]')) === "7", await admin.inputValue('input[aria-label="عدد الليالي"]'));
  await admin.fill('input[aria-label="عدد الليالي"]', "7");
  await admin.locator("[data-airlines] label", { hasText: "الخطوط التركية" }).click();
  await toastOf(admin, () => admin.click("[data-suggest-flights]"));
  await admin.click("[data-add-departure]");
  await admin.locator('[data-departure-row] input[aria-label="المقاعد"]').fill("3");
  await admin.click('[data-step="2"]');
  await admin.click("[data-open-hotel-picker]");
  for (const id of hotelIds) await toastOf(admin, () => admin.locator(`[data-picker-hotel="${id}"] [data-add-rate-option]`).first().click());
  await admin.keyboard.press("Escape");
  await admin.click('[data-step="3"]');
  check("[3] wizard: three hotel options priced from the library", (await admin.locator("[data-room-pricing]").count()) === 3);
  await admin.click('[data-step="4"]');
  await admin.click("[data-add-day]");
  await admin.locator("[data-day-row] input").first().fill("الوصول إلى إسطنبول");
  await toastOf(admin, () => admin.click("[data-fill-days]"));
  check("[wizard] «fill days» completes the itinerary to the trip length", (await admin.locator("[data-day-row]").count()) === 8);
  await admin.selectOption('[data-service="1"]', "in");
  await admin.selectOption('[data-service="7"]', "out");
  await admin.click('[data-step="5"]');
  await admin.fill('input[aria-label="السعر الأساسي"]', "500");
  const travelerPrices = await admin.locator("[data-traveler-price]").allTextContents();
  check("[4] wizard computes a different final price per hotel", new Set(travelerPrices).size === 3, travelerPrices.join(" | "));
  await admin.click('[data-step="6"]');
  const pub = await toastOf(admin, () => admin.click("[data-publish]"));
  check("[3] fixed program published from the wizard", pub.kind === "success", pub.text);
  await admin.waitForURL(/\/staff\/programs\/\d+\/\?step=6/);
  const programId = idFromUrl({ url: () => admin.url().split("?")[0] });
  const program = await db.collection("programs").findOne({ _id: programId });
  const { optionPrice } = await import("../src/lib/program-pricing.ts");
  const prices = program.hotel_options.map((o) => optionPrice(program, o));
  check("[4] stored option prices: 850 / 1025 / 1270 USD per person", prices.join(",") === "85000,102500,127000" && program.price_from === 85000, prices.join(","));
  check("[3] options keep a copy of the library rate", program.hotel_options.every((o) => o.source === "library" && o.rate_snapshot?.price > 0 && o.night_cost === 7777));
  check("[3] program carries airport, airline and a 3-seat departure", program.departure_airport?.code === "NJF" && program.airline_ids.includes(tkId) && (await db.collection("departures").findOne({ program_id: programId }))?.seats_total === 3);
  const fl = program.flights ?? [];
  check(
    "[wizard] suggested flights: NJF → IST outbound on day 1, IST → NJF return on the last day, with the chosen airline",
    fl.length === 2 && fl[0].direction === "outbound" && fl[0].from?.includes("(NJF)") && fl[0].to?.includes("(IST)") && fl[0].day === 1 && fl[1].direction === "return" && fl[1].to?.includes("(NJF)") && fl[1].day === 8 && fl[0].airline_id === tkId,
    JSON.stringify(fl.map((x) => [x.direction, x.from, x.to, x.day])),
  );
  const it = program.itinerary ?? [];
  check(
    "[wizard] generated days keep the typed first day and suggest editable titles",
    it.length === 8 && it[0].title_ar === "الوصول إلى إسطنبول" && it[1].title_ar === "جولة سياحية في إسطنبول" && it[1].title_en === "Sightseeing tour in Istanbul" && it[7].title_ar.includes("للعودة"),
    it.map((d) => d.title_ar).join(" | "),
  );
  await admin.screenshot({ path: path.join(shots, "wizard-review.png"), fullPage: true });

  // ============================================================== Public page: compare hotels and request one
  const anon = await newPage(null, { width: 1366, height: 900 });
  const anonProblems = problemsOf(anon);
  await anon.goto(`${base}/programs/${program.slug}/`, { waitUntil: "networkidle" });
  const shown = await anon.locator("[data-option-price]").allTextContents();
  check("[4] public page compares 3 hotels with their own total price", shown.length === 3 && shown.some((s) => s.includes("1,025")), shown.join(" | "));
  await anon.screenshot({ path: path.join(shots, "program-hotels.png"), fullPage: true });
  const pubHtml = await anon.content();
  check("[15] public program page has no costs or internal data", leaks(pubHtml).length === 0, leaks(pubHtml).join(","));
  const opt2 = program.hotel_options[1];
  await anon.locator(`[data-hotel-choices] [data-hotel-option="${opt2.id}"]`).click();
  const dialog = anon.locator("dialog[open]");
  await sleep(2700);
  await dialog.getByRole("button", { name: "التالي" }).click();
  await dialog.locator("#req-name").fill("زينب علي حسن");
  await dialog.locator("#req-phone").fill("0770 123 4567");
  await dialog.getByRole("button", { name: "التالي" }).click();
  await dialog.locator("[data-submit-request]").click();
  const ref = (await dialog.locator("[data-request-ref]").textContent({ timeout: 20000 })).trim();
  const lead = await db.collection("leads").findOne({ ref });
  check("[4] request stores the chosen hotel and the price seen (1,025)", lead?.hotel_option?.id === opt2.id && lead.hotel_option.price === 102500, JSON.stringify(lead?.hotel_option));

  // ============================================================== 2. Changing library prices never changes saved programs/offers
  await admin.goto(`${base}/staff/hotels/${hotelIds[0]}/`, { waitUntil: "networkidle" });
  await admin.locator('[data-rate-row] input[aria-label="سعر البيع"]').fill("130");
  check("[2] library nightly price changed (100 → 130)", (await toastOf(admin, () => admin.click("[data-save-rates]"))).kind === "success");
  const after = await db.collection("programs").findOne({ _id: programId });
  check("[2] program keeps its own copy (night price 100, snapshot 100)", after.hotel_options[0].night_price === 10000 && after.hotel_options[0].rate_snapshot.price === 10000 && after.price_from === 85000);
  const rateAudit = await db.collection("audit_log").findOne({ entity: "hotel", entity_id: String(hotelIds[0]), action: "rates", "meta.changes.diff.price": { $exists: true } });
  check("[2] price change written to the audit log with before/after", rateAudit?.meta?.changes?.[0]?.diff?.price?.join("→") === "10000→13000", JSON.stringify(rateAudit?.meta?.changes?.[0]?.diff?.price));

  // ============================================================== Content editor cannot change prices (server-enforced)
  {
    const content = await newPage(users.content);
    await content.goto(`${base}/staff/programs/${programId}/`, { waitUntil: "networkidle" });
    await content.fill('input[name="title_ar"]', "رحلة إسطنبول السياحية المميزة");
    const t = await toastOf(content, () => content.click("[data-save-anywhere]"));
    const p = await db.collection("programs").findOne({ _id: programId });
    check("[roles] content editor saves texts but prices stay untouched", t.kind === "success" && p.title_ar.endsWith("المميزة") && p.base_price === 50000 && p.hotel_options.length === 3, t.text);
    await content.context().close();
  }

  // ============================================================== 6. Exports: text, PDF and independent link
  await admin.goto(`${base}/staff/programs/${programId}/`, { waitUntil: "networkidle" });
  await admin.click('[data-program-text="ar"]');
  const text = await admin.locator("[data-program-text-output]").inputValue({ timeout: 20000 });
  check("[6] formatted text has title, hotels, prices, itinerary and services", ["رحلة إسطنبول السياحية", "فندق البوسفور", "1,025", "اليوم 1", "يشمل السعر", "مطار النجف"].every((s) => text.includes(s)), text.slice(0, 120));
  check("[15] text export has no costs", leaks(text).length === 0);
  const pdf = await admin.context().request.get(`${base}/staff/programs/${programId}/pdf/?lang=ar`, { timeout: 120000 });
  const pdfBytes = Buffer.from(await pdf.body());
  writeFileSync(path.join(shots, "program.pdf"), pdfBytes);
  check("[6] program PDF generated", pdf.status() === 200 && pdfBytes.subarray(0, 4).toString() === "%PDF", `${pdf.status()} ${pdfBytes.length} bytes`);
  check("[6] program PDF keeps clickable hotel links", pdfBytes.includes("/URI") && pdfBytes.includes("bosphorus-hotel.example"));
  const shareUrl = (await admin.locator("[data-share-url]").textContent()).trim();
  const sharePath = new URL(shareUrl).pathname;
  let res = await anon.goto(`${base}${sharePath}`, { waitUntil: "networkidle" });
  check("[6] independent link opens the program with hotel comparison", res.status() === 200 && (await anon.locator("[data-option-price]").count()) === 3);
  const sharedPdf = await anon.context().request.get(`${base}${sharePath}pdf/`, { timeout: 120000 });
  check("[6] travelers can download the PDF from the link", sharedPdf.status() === 200);
  await toastOf(admin, () => admin.click("[data-share-disable]"));
  res = await anon.goto(`${base}${sharePath}`, { waitUntil: "networkidle" });
  check("[6] a stopped link no longer opens", res.status() === 404, String(res.status()));
  await toastOf(admin, () => admin.click("[data-share-enable]"));
  res = await anon.goto(`${base}${sharePath}`, { waitUntil: "networkidle" });
  check("[6] link works again after re-enabling", res.status() === 200);

  // ============================================================== 5. Custom (tailor-made) program and its request form
  await admin.goto(`${base}/staff/programs/new/`, { waitUntil: "networkidle" });
  await admin.locator('[data-program-type="custom"]').check();
  await admin.fill('input[name="title_ar"]', "برنامج تركيا الخاص حسب طلبك");
  await admin.fill('textarea[name="summary_ar"]', "حدد موعدك وفندقك وميزانيتك، ونصمم لك برنامجاً خاصاً.");
  await admin.locator("[data-destinations] label", { hasText: "إسطنبول" }).click();
  await upload(admin, "صورة الغلاف", image("dest-tbilisi"));
  await admin.click('[data-step="4"]');
  await admin.click("[data-add-day]");
  await admin.locator("[data-day-row] input").first().fill("يوم مقترح في إسطنبول");
  await admin.click('[data-step="6"]');
  check("[5] custom program published without a fixed date", (await toastOf(admin, () => admin.click("[data-publish]"))).kind === "success");
  const custom = await db.collection("programs").findOne({ type: "custom" });
  check("[5] custom program stored without departures or public price", custom?.status === "published" && custom.price_from === null && !(await db.collection("departures").countDocuments({ program_id: custom._id })));
  await anon.goto(`${base}/programs/${custom.slug}/`, { waitUntil: "networkidle" });
  check("[5] public page shows 'price on request', no final price", (await anon.content()).includes("السعر حسب طلبك"));
  await anon.getByRole("button", { name: "اطلب برنامجك الخاص" }).first().click();
  const cd = anon.locator("dialog[open]");
  await cd.locator("#req-date").fill(addDays(today, 40));
  await cd.locator("#req-date-to").fill(addDays(today, 47));
  await cd.locator("#req-budget").fill("1500");
  await sleep(2700);
  await cd.getByRole("button", { name: "التالي" }).click();
  await cd.locator("#req-name").fill("حسين كاظم");
  await cd.locator("#req-phone").fill("0780 555 1212");
  await cd.getByRole("button", { name: "التالي" }).click();
  await cd.locator("[data-submit-request]").click();
  const customRef = (await cd.locator("[data-request-ref]").textContent({ timeout: 20000 })).trim();
  const customLead = await db.collection("leads").findOne({ ref: customRef });
  check("[5] tailor-made request stored with the traveler's wishes", customLead?.kind === "custom" && customLead.custom.country_codes.includes("TR") && customLead.custom.budget_amount === 150000 && customLead.custom.date_from === addDays(today, 40));

  // Staff turn the request into a quote (web + PDF) for the traveler.
  await admin.goto(`${base}/staff/requests/${customLead._id}/`, { waitUntil: "networkidle" });
  await Promise.all([admin.waitForURL(/\/staff\/quotes\/new\/\?lead=/), admin.click("[data-quote-from-lead]")]);
  check("[5] quote prefilled from the request", (await admin.locator("[data-client-name]").inputValue()) === "حسين كاظم");
  await admin.getByRole("button", { name: "بند" }).first().click();
  await admin.locator('[id^="it-l-"]').first().fill("برنامج إسطنبول الخاص — 7 ليالٍ");
  await admin.locator('[id^="it-p-"]').first().fill("1300");
  await admin.locator('[id^="it-c-"]').first().fill(ITEM_COST);
  await admin.fill("#q-internal", INTERNAL);
  await Promise.all([admin.waitForURL(/\/staff\/quotes\/\d+\/$/), admin.getByRole("button", { name: "حفظ كمسودة" }).click()]);
  await toastOf(admin, () => admin.getByRole("button", { name: "تسجيل كمُرسل يدوياً" }).click());
  const travelerQuote = await db.collection("quotes").findOne({ lead_id: customLead._id });
  check("[5] traveler quote created, sent and linked to the request", travelerQuote?.audience === "traveler" && travelerQuote.status === "sent" && (await db.collection("leads").findOne({ _id: customLead._id })).status === "quoted");
  res = await anon.goto(`${base}/q/${travelerQuote.token}/`, { waitUntil: "networkidle" });
  const tqHtml = await anon.content();
  check("[5] traveler opens the quote link", res.status() === 200 && tqHtml.includes("حسين كاظم"));
  check("[15] traveler quote page has no costs or internal notes", leaks(tqHtml).length === 0, leaks(tqHtml).join(","));

  // ============================================================== 7. Companies with identity and portal accounts
  async function createCompany(c) {
    await admin.goto(`${base}/staff/companies/new/`, { waitUntil: "networkidle" });
    await admin.fill("#co-name", c.name);
    await admin.fill("#co-phone", c.phone);
    if (c.logo) await upload(admin, "شعار الشركة", image(c.logo));
    await admin.fill("[data-primary-color]", c.primary);
    await admin.fill("[data-secondary-color]", c.secondary);
    await admin.fill("[data-contact-line]", c.contact);
    await admin.locator('label[for="co-portal"]').click();
    await Promise.all([admin.waitForURL(/\/staff\/companies\/\d+\/$/), admin.getByRole("button", { name: "حفظ", exact: true }).click()]);
    const id = idFromUrl(admin);
    await admin.goto(`${base}/staff/companies/${id}/?tab=users`, { waitUntil: "networkidle" });
    await admin.click("[data-add-company-user]");
    await admin.fill("[data-cu-name]", c.user.name);
    await admin.fill("[data-cu-email]", c.user.email);
    await toastOf(admin, () => admin.click("[data-save-company-user]"));
    const password = (await admin.locator("[data-generated-password]").textContent()).trim();
    await admin.goto(`${base}/staff/companies/${id}/?tab=hotels`, { waitUntil: "networkidle" });
    await admin.selectOption("[data-grant-hotel]", String(c.hotel));
    await toastOf(admin, () => admin.click("[data-grant-hotel-submit]"));
    return { id, user: { ...c.user, password } };
  }
  const coA = await createCompany({ name: "شركة النور للسفر", phone: "+964 770 111 2222", logo: "dest-giza", primary: "#7a1f5c", secondary: "#e0b04a", contact: "+964 770 111 2222 · info@alnoor.example", user: { name: "علي النور", email: "ali@alnoor.example" }, hotel: hotelIds[0] });
  const coB = await createCompany({ name: "شركة الرافدين", phone: "+964 780 333 4444", logo: null, primary: "#14532d", secondary: "#facc15", contact: "+964 780 333 4444", user: { name: "سارة الرافدين", email: "sara@rafidain.example" }, hotel: hotelIds[1] });
  const companyA = await db.collection("companies").findOne({ _id: coA.id });
  check("[7] company saved with logo, colours, contact line and portal", !!companyA.branding.logo_media_id && companyA.branding.primary_color === "#7a1f5c" && companyA.portal.enabled);
  const userA = await db.collection("company_users").findOne({ email: "ali@alnoor.example" });
  check("[7] company user created with hashed password and permissions", userA?.company_id === coA.id && userA.password_hash.startsWith("scrypt$") && userA.permissions.length === 4);
  const accessA = await db.collection("company_hotels").findOne({ company_id: coA.id, hotel_id: hotelIds[0] });
  check("[8] hotel shared with the company at its own (copied) price", accessA?.rates[0]?.price === 13000, String(accessA?.rates[0]?.price));

  // Company commission (independent from Etijah's)
  check("[12] company commission TK 3% on total fare saved", (await addRule(admin, `/staff/companies/${coA.id}/?tab=commissions`, "company", { airline: tkId, rate: "3", basis: "total_fare" })).kind === "success");

  // ============================================================== 8 & 9. Company quote from the shared library, branded PDF
  await admin.goto(`${base}/staff/quotes/new/?company=${coA.id}`, { waitUntil: "networkidle" });
  await admin.fill("#q-title", "رحلة موظفي النور إلى إسطنبول");
  await admin.fill("[data-beneficiary]", "مجموعة النور القابضة");
  await admin.fill("#q-adults", "2");
  await admin.click("[data-add-quote-hotel]");
  await admin.selectOption("[data-quote-hotel]", String(hotelIds[0]));
  const companyRateValue = await admin.locator('[data-quote-rate] option[value^="company:"]').first().getAttribute("value");
  await admin.selectOption("[data-quote-rate]", companyRateValue);
  await admin.click("[data-add-hotel-item]");
  await admin.click("[data-add-quote-hotel]");
  await admin.locator("[data-quote-hotel]").nth(1).selectOption(String(hotelIds[1]));
  const libValue = await admin.locator("[data-quote-rate]").nth(1).locator('option[value^="library:"]').first().getAttribute("value");
  await admin.locator("[data-quote-rate]").nth(1).selectOption(libValue);
  await admin.fill("#q-internal", INTERNAL);
  await Promise.all([admin.waitForURL(/\/staff\/quotes\/\d+\/$/), admin.getByRole("button", { name: "حفظ كمسودة" }).click()]);
  await toastOf(admin, () => admin.click("[data-send-portal]"));
  const qA = await db.collection("quotes").findOne({ company_id: coA.id });
  check("[8] company quote built from library hotels without re-entering them", qA?.hotels.length === 2 && qA.hotels[0].rate.source === "company" && qA.hotels[1].rate.source === "library" && qA.items.length === 1 && qA.status === "sent");
  // A later library price change does not touch the saved quote.
  await admin.goto(`${base}/staff/hotels/${hotelIds[1]}/`, { waitUntil: "networkidle" });
  await admin.locator('[data-rate-row] input[aria-label="سعر البيع"]').fill("175");
  await toastOf(admin, () => admin.click("[data-save-rates]"));
  const qA2 = await db.collection("quotes").findOne({ _id: qA._id });
  const p2 = await db.collection("programs").findOne({ _id: programId });
  check("[2] earlier quote and program keep their prices after a library change", qA2.hotels[1].rate.night_price === 15000 && p2.hotel_options[1].night_price === 15000, `${qA2.hotels[1].rate.night_price}/${p2.hotel_options[1].night_price}`);

  const printPage = await newPage(users.sales);
  await printPage.goto(`${base}/q/${qA.token}/print/`, { waitUntil: "networkidle" });
  const printHtml = await printPage.content();
  await printPage.screenshot({ path: path.join(shots, "quote-company-brand.png"), fullPage: false });
  check("[9] PDF page uses the company's name, logo and colours", printHtml.includes("شركة النور للسفر") && printHtml.includes("#7a1f5c") && printHtml.includes("data-brand-logo") && printHtml.includes('data-brand="company"'));
  check("[9] partner-branded PDF does not print Etijah's phone", !printHtml.includes("782 688 8850") && !printHtml.includes("9647826888850"));
  check("[9] beneficiary and quote number shown", printHtml.includes("مجموعة النور القابضة") && printHtml.includes(qA.ref));
  check("[15] company PDF page has no costs or internal notes", leaks(printHtml).length === 0, leaks(printHtml).join(","));
  const etijahSample = await printPage.goto(`${base}/print/brand-sample/`, { waitUntil: "networkidle" });
  const sampleB = await printPage.goto(`${base}/print/brand-sample/?company=${coB.id}`, { waitUntil: "networkidle" });
  const sampleBHtml = await printPage.content();
  check("[9] same unified template, other identity (company B sample)", etijahSample.status() === 200 && sampleB.status() === 200 && sampleBHtml.includes("#14532d") && sampleBHtml.includes("شركة الرافدين"));
  const qpdf = await printPage.context().request.get(`${base}/q/${qA.token}/pdf/`, { timeout: 120000 });
  const qpdfBytes = Buffer.from(await qpdf.body());
  writeFileSync(path.join(shots, "quote-company.pdf"), qpdfBytes);
  check("[9] branded PDF generated with clickable hotel links", qpdf.status() === 200 && qpdfBytes.subarray(0, 4).toString() === "%PDF" && qpdfBytes.includes("/URI") && qpdfBytes.includes("amal-hotel.example"));
  check("[9] download name uses the company identity", decodeURIComponent(qpdf.headers()["content-disposition"] ?? "").includes("شركة-النور-للسفر"));
  await printPage.context().close();

  // ============================================================== 10. Partner portal and data isolation
  async function portalLogin(u) {
    const page = await newPage(null);
    await page.goto(`${base}/b2b/login/`, { waitUntil: "networkidle" });
    await page.fill("#email", u.email);
    await page.fill("#password", u.password);
    await Promise.all([page.waitForURL(`${base}/b2b/`), page.click("form button[type=submit]")]);
    return page;
  }
  const pA = await portalLogin(coA.user);
  check("[10] company A sees its own portal identity", (await pA.locator("[data-portal-name]").textContent()).includes("شركة النور للسفر"));
  await pA.goto(`${base}/b2b/hotels/`, { waitUntil: "networkidle" });
  check("[10] company A sees only the hotels shared with it", (await pA.locator("[data-portal-hotel]").count()) === 1 && (await pA.locator(`[data-portal-hotel="${hotelIds[0]}"]`).count()) === 1);
  const portalHotelHtml = await pA.content();
  check("[15] portal hotels show company prices only (no costs)", portalHotelHtml.includes("130") && leaks(portalHotelHtml).length === 0, leaks(portalHotelHtml).join(","));
  await pA.goto(`${base}/b2b/quotes/${qA._id}/`, { waitUntil: "networkidle" });
  check("[15] portal quote page has no costs or internal notes", leaks(await pA.content()).length === 0);
  await toastOf(pA, () => pA.click("[data-portal-accept]"));
  check("[10] company user accepts its quote from the portal", (await db.collection("quotes").findOne({ _id: qA._id })).status === "accepted");
  await pA.goto(`${base}/b2b/requests/`, { waitUntil: "networkidle" });
  await pA.fill("[data-req-title]", "طلب رحلة صيفية لعشرين موظفاً");
  await pA.fill("[data-req-adults]", "20");
  await toastOf(pA, () => pA.click("[data-req-submit]"));
  const reqA = await db.collection("b2b_requests").findOne({ company_id: coA.id });
  check("[10] portal request stored for the user's own company", reqA?.adults === 20 && reqA.company_user_id === userA._id);
  await pA.screenshot({ path: path.join(shots, "portal-a.png"), fullPage: true });

  const pB = await portalLogin(coB.user);
  res = await pB.goto(`${base}/b2b/quotes/${qA._id}/`, { waitUntil: "networkidle" });
  check("[10] company B cannot open company A's quote (404)", res.status() === 404, String(res.status()));
  res = await pB.goto(`${base}/b2b/hotels/${hotelIds[0]}/`, { waitUntil: "networkidle" });
  check("[10] company B cannot open a hotel shared only with A (404)", res.status() === 404, String(res.status()));
  await pB.goto(`${base}/b2b/quotes/`, { waitUntil: "networkidle" });
  check("[10] company B's quote list is empty", (await pB.locator("[data-portal-quote]").count()) === 0);
  await pB.goto(`${base}/b2b/requests/`, { waitUntil: "networkidle" });
  check("[10] company B does not see company A's requests", !(await pB.content()).includes("طلب رحلة صيفية"));
  await pB.goto(`${base}/staff/`, { waitUntil: "networkidle" });
  check("[10] a company session gives no access to the staff portal", pB.url().includes("/staff/login"));
  await pA.context().close();
  await pB.context().close();

  // ============================================================== 13. Ticket with automatic commissions (accountant)
  const acc = await newPage(users.accountant);
  async function recordTicket(f) {
    await acc.goto(`${base}/staff/tickets/new/`, { waitUntil: "networkidle" });
    await acc.selectOption("[data-ticket-airline]", String(f.airline));
    if (f.company) await acc.selectOption("[data-ticket-company]", String(f.company));
    await acc.fill("[data-ticket-date]", f.date);
    await acc.fill("[data-ticket-number]", f.number);
    await acc.fill('input[aria-label="السعر الأساسي"]', f.base);
    await acc.fill('input[aria-label="الضرائب"]', f.taxes);
    await acc.click("[data-review-ticket]");
    await acc.locator('[data-preview="etijah"]').waitFor();
    const preview = {
      company: f.company ? (await acc.locator('[data-preview-amount="company"]').textContent()).trim() : null,
      etijah: (await acc.locator('[data-preview-amount="etijah"]').textContent()).trim(),
      net: (await acc.locator('[data-preview-total="net"]').textContent()).trim(),
    };
    await Promise.all([acc.waitForURL(/\/staff\/tickets\/\d+\/$/), acc.click("[data-save-ticket]")]);
    return { preview, id: idFromUrl(acc) };
  }
  const t1 = await recordTicket({ airline: tkId, company: coA.id, date: today, number: "2352400000001", base: "1000", taxes: "200" });
  check("[13] review shows company 3% of total (36), Etijah 5% of base (50), net due 1,164", t1.preview.company.includes("36") && t1.preview.etijah.includes("50") && t1.preview.net.includes("1,164"), JSON.stringify(t1.preview));
  const ticket1 = await db.collection("tickets").findOne({ _id: t1.id });
  check("[13] ticket stores amounts and a copy of both rules", ticket1.company_commission.amount === 3600 && ticket1.company_commission.rate_bp === 300 && ticket1.etijah_commission.amount === 5000 && ticket1.etijah_commission.rate_bp === 500 && ticket1.net_due === 116400 && ticket1.etijah_margin === 1400);
  const t2 = await recordTicket({ airline: iaId, date: today, number: "0732400000002", base: "300", taxes: "50" });
  const ticket2 = await db.collection("tickets").findOne({ _id: t2.id });
  check("[12] net-fare airline: no Etijah commission assumed", ticket2.etijah_commission.kind === "net_fare" && ticket2.etijah_commission.amount === 0 && ticket2.payable_to_airline === 35000);

  // ============================================================== 14. Changing rates keeps history correct
  check("[14] new Etijah rate for TK (8%) from tomorrow", (await addRule(acc, "/staff/commissions/etijah/", "etijah", { airline: tkId, rate: "8", basis: "base_fare", from: tomorrow })).kind === "success");
  const tkRules = await db.collection("commission_rules").find({ scope: "etijah", airline_id: tkId }).sort({ valid_from: 1 }).toArray();
  check("[14] previous rule closed the day before, history kept", tkRules.length === 2 && tkRules[0].valid_to === today && tkRules[0].rate_bp === 500 && tkRules[1].rate_bp === 800, tkRules.map((r) => `${r.valid_from}..${r.valid_to}:${r.rate_bp}`).join(" "));
  const t3 = await recordTicket({ airline: tkId, company: coA.id, date: tomorrow, number: "2352400000003", base: "1000", taxes: "200" });
  const ticket3 = await db.collection("tickets").findOne({ _id: t3.id });
  const ticket1Again = await db.collection("tickets").findOne({ _id: t1.id });
  check("[14] new ticket uses 8%, the old ticket still shows 5%", ticket3.etijah_commission.amount === 8000 && ticket1Again.etijah_commission.amount === 5000 && ticket1Again.etijah_commission.rate_bp === 500);
  const editOld = await addRule(acc, "/staff/commissions/etijah/", "etijah", { airline: tkId, rate: "6", basis: "base_fare", from: today });
  check("[14] a rate overlapping recorded history is refused", editOld.kind === "error", editOld.text);

  // ============================================================== Reports & exports
  await acc.goto(`${base}/staff/reports/?airline=${tkId}`, { waitUntil: "networkidle" });
  const repHtml = await acc.content();
  check("[reports] TK commission total 130 (50 + 80) and company commissions 72", repHtml.includes("130") && repHtml.includes("72"));
  const xlsx = await acc.context().request.get(`${base}/staff/reports/export/?format=xlsx`);
  const xlsxBytes = Buffer.from(await xlsx.body());
  writeFileSync(path.join(shots, "commissions.xlsx"), xlsxBytes);
  check("[reports] Excel export (.xlsx) downloads", xlsx.status() === 200 && xlsxBytes.subarray(0, 2).toString() === "PK" && (xlsx.headers()["content-type"] ?? "").includes("spreadsheetml"));
  const rpdf = await acc.context().request.get(`${base}/staff/reports/export/?format=pdf`, { timeout: 120000 });
  check("[reports] PDF export downloads", rpdf.status() === 200 && Buffer.from(await rpdf.body()).subarray(0, 4).toString() === "%PDF");
  await acc.context().close();

  // ============================================================== Seats: concurrent confirmations can never overbook
  const dep = await db.collection("departures").findOne({ program_id: programId });
  const testLeads = [91001, 91002, 91003];
  await db.collection("leads").insertMany(
    testLeads.map((id) => ({ _id: id, ref: `REQ-TEST-${id}`, kind: "program", program_id: programId, departure_id: dep._id, program_title: "x", departure_label: null, preferred_date: null, hotel_option: null, custom: null, adults: 2, children: 0, infants: 0, rooms: 1, room_type: null, full_name: `مسافر ${id}`, phone: "+9647701234567", email: null, notes: null, locale: "ar", status: "new", assigned_to: null, seats_counted: 0, source: "website", ip_hash: null, user_agent: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })),
  );
  const pages = await Promise.all(testLeads.map(() => newPage(users.admin)));
  await Promise.all(pages.map((pg, i) => pg.goto(`${base}/staff/requests/${testLeads[i]}/`, { waitUntil: "networkidle" })));
  await Promise.all(pages.map((pg) => pg.selectOption("#lead-status", "confirmed")));
  const outcomes = await Promise.all(pages.map((pg) => toastOf(pg, () => pg.getByRole("button", { name: "حفظ التحديث" }).click())));
  const depAfter = await db.collection("departures").findOne({ _id: dep._id });
  check("[seats] 3 simultaneous confirmations of 2 travelers on 3 seats: exactly one succeeds", outcomes.filter((o) => o.kind === "success").length === 1 && depAfter.seats_confirmed === 2, outcomes.map((o) => o.kind).join(","));
  await Promise.all(pages.map((pg) => pg.context().close()));

  // ============================================================== Audit log & migration record
  const auditActions = await db.collection("audit_log").distinct("entity");
  check("[audit] prices, commissions, tickets, companies and users are audited", ["hotel", "commission_rule", "ticket", "company", "company_user", "program"].every((e) => auditActions.includes(e)), auditActions.join(","));

  check("[browser] no page errors (admin, public)", adminProblems.length + anonProblems.length === 0, [...adminProblems, ...anonProblems].slice(0, 3).join(" | "));
} catch (error) {
  check("[run] test run finished without an exception", false, error.stack?.split("\n").slice(0, 4).join(" / "));
} finally {
  await browser.close().catch(() => undefined);
  await mongo.close().catch(() => undefined);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log(server.log().split("\n").filter((l) => /error|Error|⨯/.test(l)).slice(-15).join("\n"));
    process.exitCode = 1;
  }
  await server.stop();
}

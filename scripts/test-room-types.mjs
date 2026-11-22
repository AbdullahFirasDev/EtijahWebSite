// Browser test: several room types (each with its own price) for one hotel of a program —
// wizard «rooms & nights» step, stored options, public page and PDF. Runs `next start` on a throw-away database.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { MongoClient } from "mongodb";
import { chromium } from "playwright-core";
import { startNextServer } from "./lib/next-server.mjs";

const root = path.resolve(import.meta.dirname, "..");
const image = (name) => path.join(root, "assets", "images", `${name}.jpg`);
// SHOTS=<dir> saves screenshots of the new UI parts.
const shot = (locator, name) => (process.env.SHOTS ? locator.screenshot({ path: path.join(process.env.SHOTS, `${name}.png`) }) : null);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
async function upload(page, label, file) {
  const list = await page.locator(`input[data-upload="${label}"]`).locator("xpath=ancestor::ul[1]").elementHandle();
  const before = await list.evaluate((ul) => ul.querySelectorAll("li img").length);
  await page.setInputFiles(`input[data-upload="${label}"]`, file);
  await page.waitForFunction(([ul, n]) => ul.querySelectorAll("li img").length > n, [list, before], { timeout: 30000 });
}
const idFromUrl = (url) => Number(new URL(url).pathname.match(/\/(\d+)\/?$/)?.[1]);

const server = await startNextServer();
const base = server.base;
const mongo = await MongoClient.connect(server.mongo.uri);
const db = mongo.db(server.mongo.dbName);
const browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chrome" });
try {
  const admin = { email: "t-admin@etijah.test", password: "Admin-Pass-2026" };
  await promisify(execFile)(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/db.mjs", "create-staff", "--email", admin.email, "--name", "Admin", "--role", "admin", "--password", admin.password], { cwd: root, env: { ...process.env, ...server.env } });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(`${base}/staff/login/`, { waitUntil: "networkidle" });
  await page.fill("#email", admin.email);
  await page.fill("#password", admin.password);
  await Promise.all([page.waitForURL(`${base}/staff/`), page.click("form button[type=submit]")]);

  // ---------------------------------------------------------------- hotel with two room types, each with a rate
  await page.goto(`${base}/staff/destinations/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "وجهة جديدة" }).click();
  await page.selectOption("#dest-country", "TR");
  await page.fill('input[name="dest_name_ar"]', "إسطنبول");
  await page.fill('input[name="dest_name_en"]', "Istanbul");
  await page.fill("#dest-airport", "IST");
  await page.getByRole("button", { name: "حفظ الوجهة" }).click();
  await page.waitForFunction(() => document.querySelector("[data-toast]"), null, { timeout: 30000 });
  let dest = null;
  for (let i = 0; i < 20 && !dest; i++) {
    dest = await db.collection("destinations").findOne({ name_en: "Istanbul" });
    if (!dest) await new Promise((r) => setTimeout(r, 300));
  }
  await page.goto(`${base}/staff/hotels/new/`, { waitUntil: "networkidle" });
  await page.selectOption("#hotel-dest", String(dest._id));
  await page.fill('input[name="hotel_name_ar"]', "فندق الغرف المتعددة");
  await page.fill('input[name="hotel_name_en"]', "Multi Room Hotel");
  await page.getByRole("radio", { name: "4 نجوم" }).click();
  await upload(page, "الصور", image("dest-istanbul"));
  await Promise.all([page.waitForURL(/\/staff\/hotels\/\d+\/$/), page.click("[data-save-hotel]")]);
  const hotelId = idFromUrl(page.url());
  await page.click("[data-add-rate]");
  await page.locator('[data-rate-row="new"] input[aria-label="التكلفة"]').fill("80");
  await page.locator('[data-rate-row="new"] input[aria-label="سعر البيع"]').fill("100");
  await page.click("[data-save-rates]");
  let hotel = null;
  for (let i = 0; i < 60 && !hotel?.rates?.length; i++) {
    await new Promise((r) => setTimeout(r, 500));
    hotel = await db.collection("hotels").findOne({ _id: hotelId });
  }
  // Second rate for the second room type, written directly (same shape as the first one).
  const r0 = hotel.rates[0];
  await db.collection("hotels").updateOne({ _id: hotelId }, { $push: { rates: { ...r0, id: `${r0.id}-b`, room_type_id: hotel.room_types[1].id, occupancy: 3, price: 15000, cost: 12000 } } });
  hotel = await db.collection("hotels").findOne({ _id: hotelId });
  check("hotel has two room types with a rate each", hotel.room_types.length >= 2 && hotel.rates.length === 2, hotel.room_types.map((r) => r.name_ar).join(", "));

  // ---------------------------------------------------------------- program wizard
  await page.goto(`${base}/staff/programs/new/`, { waitUntil: "networkidle" });
  await page.locator('[data-program-type="fixed"]').check();
  await page.fill('input[name="title_ar"]', "رحلة إسطنبول بأنواع غرف");
  await page.fill('textarea[name="summary_ar"]', "خمسة أيام في إسطنبول مع غرفة مزدوجة أو ثلاثية في الفندق نفسه.");
  await page.selectOption("[data-destination-country-pick]", "TR");
  await page.locator("[data-destinations] label", { hasText: /^إسطنبول/ }).click();
  await upload(page, "صورة الغلاف", image("dest-istanbul"));
  await page.click('[data-step="1"]');
  await page.fill('input[aria-label="عدد الأيام"]', "5");
  await page.click("[data-add-departure]");
  await page.click('[data-step="2"]');
  await page.click("[data-open-hotel-picker]");
  await page.locator(`[data-picker-hotel="${hotelId}"] [data-add-rate-option]`).first().click();
  await page.keyboard.press("Escape");
  await page.click('[data-step="3"]');
  check("rooms step: one hotel card with one room type", (await page.locator("[data-hotel-rooms]").count()) === 1 && (await page.locator("[data-room-pricing]").count()) === 1);
  await page.click("[data-add-room]");
  check("«add room type» adds a second room under the same hotel", (await page.locator("[data-hotel-rooms]").count()) === 1 && (await page.locator("[data-room-pricing]").count()) === 2);
  const room2 = page.locator("[data-room-pricing]").nth(1);
  check("second room takes the hotel's other room type and its library price", (await room2.locator("[data-room-name]").inputValue()) === hotel.room_types[1].name_ar && (await room2.locator('input[aria-label="سعر الليلة"]').inputValue()).includes("150"), `${await room2.locator("[data-room-name]").inputValue()} / ${await room2.locator('input[aria-label="سعر الليلة"]').inputValue()}`);
  await page.click("[data-add-room]");
  const room3 = page.locator("[data-room-pricing]").nth(2);
  await room3.locator("[data-room-name]").fill("جناح عائلي");
  await room3.locator('input[aria-label="سعر الليلة"]').fill("300");
  check("a third, custom room type can be typed with its own price", (await page.locator("[data-room-pricing]").count()) === 3);
  await shot(page.locator("[data-hotel-rooms]"), "wizard-room-types");
  await page.click('[data-step="2"]');
  check("hotels step lists the hotel once with its room count", (await page.locator("[data-option-row]").count()) === 1 && (await page.locator("[data-option-row]").textContent()).includes("3 أنواع غرف"));
  await page.click('[data-step="3"]');
  await page.locator("[data-room-pricing]").nth(2).locator("[data-remove-room]").click();
  await page.click("[data-add-room]");
  await page.locator("[data-room-pricing]").nth(2).locator("[data-room-name]").fill("جناح عائلي");
  await page.locator("[data-room-pricing]").nth(2).locator('input[aria-label="سعر الليلة"]').fill("300");
  await page.click('[data-step="4"]');
  await page.click("[data-add-day]");
  await page.locator("[data-day-row] input").first().fill("الوصول إلى إسطنبول");
  await page.click('[data-step="5"]');
  await page.fill('input[aria-label="السعر الأساسي"]', "500");
  await page.click('[data-step="6"]');
  await page.click("[data-publish]");
  await page.waitForURL(/\/staff\/programs\/\d+\/\?step=6/, { timeout: 45000 });
  const toast = await page.waitForSelector("[data-toast]", { timeout: 30000 });
  check("publish succeeds", (await toast.getAttribute("data-toast")) === "success", (await toast.textContent())?.trim());
  const programId = idFromUrl(page.url().split("?")[0]);
  const program = await db.collection("programs").findOne({ _id: programId });
  const opts = program?.hotel_options ?? [];
  check(
    "program stores three room options for the same hotel, each with its own price",
    opts.length === 3 && opts.every((o) => o.hotel_id === hotelId) && new Set(opts.map((o) => o.night_price)).size === 3 && opts[2].room_ar === "جناح عائلي" && opts[2].night_price === 30000,
    JSON.stringify(opts.map((o) => [o.room_ar, o.occupancy, o.night_price, o.source])),
  );

  // ---------------------------------------------------------------- public page and PDF
  const anon = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  anon.on("pageerror", (e) => problems.push(e.message));
  const res = await anon.goto(`${base}/programs/${program.slug}/`, { waitUntil: "networkidle" });
  check("program published and its public page opens", program.status === "published" && res.ok(), `${program.status} / HTTP ${res.status()}`);
  check("public page shows the hotel once with three priced rooms", (await anon.locator("[data-hotel-choice]").count()) === 1 && (await anon.locator("[data-room-choice]").count()) === 3 && (await anon.locator("[data-option-price]").count()) === 3);
  if (process.env.SHOTS) {
    await anon.locator("[data-hotel-choices]").scrollIntoViewIfNeeded();
    await anon.waitForTimeout(2000); // reveal animation
    await shot(anon.locator("[data-hotel-choices]"), "public-room-types");
  }
  const html = await anon.content();
  check("public page shows no costs", !html.includes("night_cost") && !html.includes("120.00") && !html.includes("80.00"));
  await anon.locator(`[data-room-choice="${opts[1].id}"] [data-hotel-option]`).click();
  await anon.waitForSelector("dialog[open]");
  check("choosing a room opens the request with that room selected", await anon.locator(`dialog[open] input[name="hotel"][value="${opts[1].id}"]`).isChecked());

  await page.goto(`${base}/print/program/${programId}/`, { waitUntil: "networkidle" });
  const rows = page.locator("table").filter({ hasText: "فندق الغرف المتعددة" }).locator("tbody tr");
  check("PDF lists one row per room, the hotel cell spanning them", (await rows.count()) === 3 && (await rows.first().locator("td").first().getAttribute("rowspan")) === "3");
  await shot(page.locator("table").filter({ hasText: "فندق الغرف المتعددة" }), "pdf-room-types");

  check("no page errors", problems.length === 0, problems.join(" | "));
} finally {
  await browser.close();
  await mongo.close();
  await server.stop();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);

// Browser test: tours library, multi-destination quote with year-first dates, tour added to a
// quote day (with price) and to a program day. Runs `next start` on a throw-away database.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { MongoClient } from "mongodb";
import { chromium } from "playwright-core";
import { startNextServer } from "./lib/next-server.mjs";

const root = path.resolve(import.meta.dirname, "..");
// SHOTS=<dir> saves screenshots of the new UI parts.
const shot = (locator, name) => (process.env.SHOTS ? locator.screenshot({ path: path.join(process.env.SHOTS, `${name}.png`) }) : null);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

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

  // ---------------------------------------------------------------- tours library
  await page.goto(`${base}/staff/tours/`, { waitUntil: "networkidle" });
  await page.click("[data-new-tour]");
  await page.fill('input[name="tour-name_ar"]', "جولة البوسفور البحرية");
  await page.fill('input[name="tour-name_en"]', "Bosphorus cruise");
  await page.selectOption("#tour-country", "TR");
  await page.fill("#tour-city-ar", "إسطنبول");
  await page.locator("dialog textarea").first().fill("رحلة بحرية بين قارتين مع الغداء.");
  await page.fill("#tour-price", "45");
  await page.fill("#tour-cost", "30");
  await page.click("[data-save-tour]");
  await page.waitForSelector("[data-tour-row]");
  const tour = await db.collection("tours").findOne({});
  check("tour saved in the library", tour?.name_ar === "جولة البوسفور البحرية" && tour.price === 4500 && tour.cost === 3000 && tour.country_code === "TR", JSON.stringify(tour && { p: tour.price, c: tour.cost }));

  // ---------------------------------------------------------------- multi-destination quote
  await page.goto(`${base}/staff/quotes/new/`, { waitUntil: "networkidle" });
  await page.click('[data-audience="traveler"]');
  await page.fill("[data-client-name]", "مسافر الاختبار");
  await page.fill("#q-title", "رحلة تركيا وجورجيا");
  await page.click("[data-add-destination]");
  await page.locator("[data-dest-country]").nth(0).selectOption("TR");
  await page.locator("[data-dest-city]").nth(0).fill("إسطنبول");
  await page.locator("#qd-in-0").pressSequentially("20270105"); // digits only: dashes are inserted
  await page.locator("#qd-out-0").fill("2027-01-09");
  check("typed digits become YYYY-MM-DD", (await page.inputValue("#qd-in-0")) === "2027-01-05", await page.inputValue("#qd-in-0"));
  await page.click("[data-add-destination]");
  check("next destination starts on the previous exit date", (await page.inputValue("#qd-in-1")) === "2027-01-09", await page.inputValue("#qd-in-1"));
  await page.locator("[data-dest-country]").nth(1).selectOption("GE");
  await page.locator("[data-dest-city]").nth(1).fill("تبليسي");
  await page.locator("#qd-out-1").fill("2027/1/13");
  await page.locator("#qd-out-1").blur();
  check("loose date normalised on blur", (await page.inputValue("#qd-out-1")) === "2027-01-13", await page.inputValue("#qd-out-1"));
  check("trip dates follow the destinations", (await page.inputValue("#q-start")) === "2027-01-05" && (await page.inputValue("#q-end")) === "2027-01-13", `${await page.inputValue("#q-start")} → ${await page.inputValue("#q-end")}`);
  const summary = await page.inputValue("#q-dest");
  check("summary line built from the destinations", summary.includes("إسطنبول") && summary.includes("تركيا") && summary.includes("تبليسي") && summary.includes("جورجيا"), summary);
  await page.locator("#q-start").fill("2027-02-30"); // invalid date: not emitted
  await page.locator("#q-start").blur();
  check("invalid date is flagged", (await page.getAttribute("#q-start", "aria-invalid")) === "true");
  await page.locator("#q-start").fill("2027-01-05");

  await shot(page.locator("[data-quote-destinations]"), "quote-destinations");
  await page.selectOption("[data-tour-select]", String(tour._id));
  await page.selectOption("[data-tour-price]", "main");
  await page.click("[data-add-tour]");
  await shot(page.locator("[data-tour-picker]").locator("xpath=ancestor::section[1]"), "quote-tour-day");
  await Promise.all([page.waitForURL(/\/staff\/quotes\/\d+\/$/), page.getByRole("button", { name: "حفظ كمسودة" }).click()]);
  const q = await db.collection("quotes").findOne({});
  check(
    "quote stores two destinations with their own dates",
    q?.destinations?.length === 2 && q.destinations[0].entry_date === "2027-01-05" && q.destinations[0].exit_date === "2027-01-09" && q.destinations[1].country_code === "GE" && q.destinations[1].exit_date === "2027-01-13",
    JSON.stringify(q?.destinations),
  );
  check("tour added as a day and a priced line (cost copied)", q?.days[0]?.title === "جولة البوسفور البحرية" && q.items.length === 1 && q.items[0].unit_price === 4500 && q.items[0].unit_cost === 3000, JSON.stringify({ d: q?.days, i: q?.items }));
  check("editor reloads the destinations", (await page.locator("[data-destination-row]").count()) === 2 && (await page.inputValue("#qd-out-1")) === "2027-01-13");

  for (const view of ["", "print/"]) {
    await page.goto(`${base}/q/${q.token}/${view}`, { waitUntil: "networkidle" });
    const html = await page.content();
    await shot(page.locator("table[data-quote-destinations]"), `view-${view ? "pdf" : "web"}`);
    check(`client ${view ? "PDF" : "web"} view lists destinations with dates`, (await page.locator("table[data-quote-destinations] tbody tr").count()) === 2 && html.includes("تبليسي") && html.includes("الوجهات ومواعيدها"));
    check(`client ${view ? "PDF" : "web"} view shows no cost`, !html.includes("unit_cost") && !html.includes("30.00"));
  }

  // ---------------------------------------------------------------- tour in a program day
  await page.goto(`${base}/staff/programs/new/`, { waitUntil: "networkidle" });
  await page.click('[data-step="4"]');
  await page.click("[data-add-day]");
  await page.selectOption("[data-day-tour]", String(tour._id));
  const dayTitle = await page.locator("[data-day-row] input").first().inputValue();
  const dayBody = await page.locator("[data-day-row] textarea").first().inputValue();
  check("program day filled from the tour (title + description)", dayTitle === "جولة البوسفور البحرية" && dayBody.includes("رحلة بحرية"), `${dayTitle} / ${dayBody}`);

  // ---------------------------------------------------------------- GET filter with the date field
  await page.goto(`${base}/staff/tickets/?from=2026-01-01`, { waitUntil: "networkidle" });
  check("filter date field keeps its value (hidden input)", (await page.locator('input[type=hidden][name="from"]').inputValue()) === "2026-01-01");

  check("no page errors", problems.length === 0, problems.join(" | "));
} finally {
  await browser.close();
  await mongo.close();
  await server.stop();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);

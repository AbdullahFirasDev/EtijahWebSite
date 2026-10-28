// End-to-end smoke test of the static export in a real browser.
// Usage: npm run build && npm run test:smoke [-- <screenshot-dir>]
// Uses an installed Edge/Chrome via playwright-core (BROWSER_CHANNEL=msedge|chrome).
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { serveStatic } from "./serve-static.mjs";

const root = path.resolve(import.meta.dirname, "..");
const shotDir = path.resolve(process.argv[2] ?? path.join(root, ".smoke"));
const channel = process.env.BROWSER_CHANNEL ?? "msedge";
const PHONE = "+9647826888850";
const WA = "https://wa.me/9647826888850";
const MAPS = "https://maps.app.goo.gl/kWzQFMfET6hf8VXE9";

await mkdir(shotDir, { recursive: true });
const server = await serveStatic(path.join(root, "out"));
const base = `http://127.0.0.1:${server.address().port}`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

function watch(page) {
  const problems = [];
  page.on("console", (m) => ["error", "warning"].includes(m.type()) && problems.push(`[console.${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`[pageerror] ${e.message}`));
  page.on("requestfailed", (r) => problems.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText ?? ""}`));
  page.on("response", (r) => r.status() >= 400 && problems.push(`[${r.status()}] ${r.url()}`));
  return problems;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.55)) {
      window.scrollTo(0, y);
      await wait(140);
    }
    await wait(600);
  });
}

const browser = await chromium.launch({ channel, args: ["--enable-unsafe-swiftshader"] });

// ---------------------------------------------------------------- Desktop
for (const [route, lang, dir] of [["/", "ar", "rtl"], ["/en/", "en", "ltr"]]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const problems = watch(page);
  await page.goto(base + route, { waitUntil: "networkidle" });
  const tag = route === "/" ? "ar" : "en";

  const attrs = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
  check(`[${tag}] html lang/dir`, attrs.lang === lang && attrs.dir === dir, JSON.stringify(attrs));
  check(`[${tag}] single h1`, (await page.locator("h1").count()) === 1);
  check(`[${tag}] title + description`, (await page.title()).length > 20 && (await page.locator('meta[name="description"]').count()) === 1);
  check(`[${tag}] JSON-LD TravelAgency`, await page.evaluate(() => JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)["@type"] === "TravelAgency"));

  await sleep(2600);
  await page.screenshot({ path: path.join(shotDir, `${tag}-desktop-hero.png`) });
  const hero = await page.evaluate(() => {
    const lead = document.querySelector("[data-hero-lead]");
    const offsets = [...document.querySelectorAll("[data-hero-line]")].map((l) =>
      Math.round(l.getBoundingClientRect().top - l.parentElement.getBoundingClientRect().top),
    );
    return { leadOpacity: getComputedStyle(lead).opacity, lineOffsets: offsets };
  });
  check(`[${tag}] hero entrance completes (headline visible)`, hero.leadOpacity === "1" && hero.lineOffsets.every((o) => Math.abs(o) <= 1), JSON.stringify(hero));
  check(`[${tag}] Lenis smooth scrolling active`, await page.evaluate(() => document.documentElement.classList.contains("lenis")));

  const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
  const tel = links.filter((h) => h.startsWith("tel:"));
  const wa = links.filter((h) => h.includes("wa.me"));
  const maps = links.filter((h) => h.includes("maps."));
  check(`[${tag}] tel: links correct`, tel.length >= 3 && tel.every((h) => h === `tel:${PHONE}`), `${tel.length} links`);
  check(`[${tag}] WhatsApp links correct`, wa.length >= 10 && wa.every((h) => h.startsWith(WA)), `${wa.length} links`);
  check(`[${tag}] per-service prefilled WhatsApp`, (await page.locator("#services a[href*='wa.me']").count()) === 6);
  check(`[${tag}] maps links correct`, maps.length >= 3 && maps.every((h) => h === MAPS), `${maps.length} links`);
  check(`[${tag}] no unverified email shown`, !links.some((h) => h.startsWith("mailto:")));
  check(`[${tag}] external links are safe`, await page.evaluate(() => [...document.querySelectorAll('a[target="_blank"]')].every((a) => a.rel.includes("noopener"))));

  // Anchor navigation lands the section below the fixed header and updates the hash.
  await page.click(`header nav a[href="#process"]`);
  await sleep(2200);
  const anchor = await page.evaluate(() => ({ hash: location.hash, top: document.getElementById("process").getBoundingClientRect().top }));
  check(`[${tag}] nav anchor scrolls to section`, anchor.hash === "#process" && anchor.top > -4 && anchor.top < 120, JSON.stringify(anchor));

  await page.evaluate(() => window.scrollTo(0, 0));
  await scrollThrough(page);
  await sleep(1200);
  const images =await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
  check(`[${tag}] all images load`, images.length === 0, images.join(", "));
  const hiddenReveals = await page.evaluate(() =>
    [...document.querySelectorAll("[data-reveal]")]
      .filter((el) => getComputedStyle(el).opacity !== "1")
      .map((el) => `${el.closest("section")?.id || "?"}:${el.tagName.toLowerCase()}@${getComputedStyle(el).opacity}`),
  );
  check(`[${tag}] all reveal targets visible after scroll`, hiddenReveals.length === 0, hiddenReveals.slice(0, 8).join(", "));
  check(`[${tag}] no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  await page.locator("#about").scrollIntoViewIfNeeded();
  await sleep(2500);
  const globe = await page.evaluate(() => ({ canvas: !!document.querySelector("#about canvas"), fallbackOpacity: getComputedStyle(document.querySelector("#about img")).opacity }));
  check(`[${tag}] 3D globe renders (desktop)`, globe.canvas && globe.fallbackOpacity === "0", JSON.stringify(globe));
  await page.screenshot({ path: path.join(shotDir, `${tag}-desktop-globe.png`) });

  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);
  await page.screenshot({ path: path.join(shotDir, `${tag}-desktop-full.png`), fullPage: true });
  check(`[${tag}] no console errors / failed requests`, problems.length === 0, problems.slice(0, 6).join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- Mobile
for (const route of ["/", "/en/"]) {
  const tag = route === "/" ? "ar" : "en";
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const problems = watch(page);
  await page.goto(base + route, { waitUntil: "networkidle" });
  await sleep(2500);
  await page.screenshot({ path: path.join(shotDir, `${tag}-mobile-hero.png`) });

  check(`[${tag}/mobile] no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

  const toggle = page.locator('button[aria-controls="mobile-menu"]');
  await toggle.click();
  await sleep(500);
  const opened = await page.evaluate(() => ({
    expanded: document.querySelector('button[aria-controls="mobile-menu"]').getAttribute("aria-expanded"),
    visible: !document.getElementById("mobile-menu").hidden,
    focusInside: document.getElementById("mobile-menu").contains(document.activeElement),
  }));
  check(`[${tag}/mobile] menu opens with focus inside`, opened.expanded === "true" && opened.visible && opened.focusInside, JSON.stringify(opened));
  await page.screenshot({ path: path.join(shotDir, `${tag}-mobile-menu.png`) });
  for (let i = 0; i < 14; i++) await page.keyboard.press("Tab");
  check(`[${tag}/mobile] focus trapped in menu`, await page.evaluate(() => document.getElementById("mobile-menu").contains(document.activeElement)));
  await page.keyboard.press("Escape");
  await sleep(300);
  const closed = await page.evaluate(() => ({
    hidden: document.getElementById("mobile-menu").hidden,
    focusOnToggle: document.activeElement === document.querySelector('button[aria-controls="mobile-menu"]'),
  }));
  check(`[${tag}/mobile] Escape closes menu and restores focus`, closed.hidden && closed.focusOnToggle, JSON.stringify(closed));

  await toggle.click();
  await sleep(300);
  await page.click('#mobile-menu a[href="#contact"]');
  await sleep(1800);
  const landed = await page.evaluate(() => ({ hidden: document.getElementById("mobile-menu").hidden, top: document.getElementById("contact").getBoundingClientRect().top }));
  check(`[${tag}/mobile] menu link navigates`, landed.hidden && Math.abs(landed.top) < 120, JSON.stringify(landed));

  await page.evaluate(() => window.scrollTo(0, 0));
  await scrollThrough(page);
  check(`[${tag}/mobile] no WebGL canvas on mobile`, (await page.locator("#about canvas").count()) === 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);
  // scale: "css" keeps tall pages under Chromium's capture size limit at 2x DPR.
  await page.screenshot({ path: path.join(shotDir, `${tag}-mobile-full.png`), fullPage: true, scale: "css" });
  check(`[${tag}/mobile] no console errors / failed requests`, problems.length === 0, problems.slice(0, 6).join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- Reduced motion
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const problems = watch(page);
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await sleep(300);
  const state = await page.evaluate(() => ({
    motionAttr: document.documentElement.getAttribute("data-motion"),
    lenis: document.documentElement.classList.contains("lenis"),
    leadOpacity: getComputedStyle(document.querySelector("[data-hero-lead]")).opacity,
    hiddenReveals: [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity !== "1").length,
  }));
  check("[reduced-motion] content visible immediately, no smooth scroll", !state.motionAttr && !state.lenis && state.leadOpacity === "1" && state.hiddenReveals === 0, JSON.stringify(state));
  await page.locator("#about").scrollIntoViewIfNeeded();
  await sleep(1200);
  check("[reduced-motion] static globe fallback", (await page.locator("#about canvas").count()) === 0);
  const steps = await page.locator("[data-step][data-active]").count();
  check("[reduced-motion] process steps shown complete", steps === 4, `${steps} active`);
  check("[reduced-motion] no console errors", problems.length === 0, problems.slice(0, 6).join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- Booking form
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const problems = watch(page);
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.__opened = [];
    window.open = (url) => (window.__opened.push(url), { opener: null });
  });
  const form = page.locator("#booking form");
  await form.locator('button[type="submit"]').click();
  await sleep(200);
  const invalid = await page.evaluate(() => ({
    alert: !!document.querySelector('#booking [role="alert"]'),
    name: document.querySelector('#booking [name="name"]').getAttribute("aria-invalid"),
    service: document.querySelector('#booking [name="service"]').getAttribute("aria-invalid"),
    focused: document.activeElement?.getAttribute("name"),
    opened: window.__opened.length,
  }));
  check("[form] empty submit shows errors, focuses first field, sends nothing", invalid.alert && invalid.name === "true" && invalid.service === "true" && invalid.focused === "name" && invalid.opened === 0, JSON.stringify(invalid));

  await form.locator('[name="name"]').fill("أحمد علي");
  await form.locator('[name="service"]').selectOption("visa");
  await form.locator('[name="phone"]').fill("12ab");
  await form.locator('[name="date"]').fill("2020-01-01");
  await form.locator('[name="travelers"]').fill("0");
  await form.locator('button[type="submit"]').click();
  await sleep(200);
  const partial = await page.evaluate(() => ["phone", "date", "travelers"].map((n) => document.querySelector(`#booking [name="${n}"]`).getAttribute("aria-invalid")));
  check("[form] rejects bad phone, past date, invalid travellers", partial.every((v) => v === "true"), JSON.stringify(partial));

  const future = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  await form.locator('[name="phone"]').fill("0782 688 8850");
  await form.locator('[name="date"]').fill(future);
  await form.locator('[name="travelers"]').fill("3");
  await form.locator('[name="destination"]').fill("إسطنبول");
  await form.locator('button[type="submit"]').click();
  await sleep(300);
  const sent = await page.evaluate(() => ({ url: window.__opened[0] ?? "", status: !!document.querySelector('#booking [role="status"]') }));
  const text = sent.url.startsWith(`${WA}?text=`) ? decodeURIComponent(sent.url.split("?text=")[1]) : "";
  check(
    "[form] valid submit opens prefilled WhatsApp + honest status",
    sent.status && text.includes("أحمد علي") && text.includes("خدمات التأشيرات") && text.includes(future) && text.includes("إسطنبول"),
    text.replace(/\n/g, " ⏎ "),
  );
  await page.locator("#booking").screenshot({ path: path.join(shotDir, "form-success.png") });
  check("[form] no console errors", problems.length === 0, problems.slice(0, 6).join(" | "));
  await ctx.close();
}

await browser.close();

// ---------------------------------------------------------------- WebGL unavailable
{
  const noGl = await chromium.launch({ channel, args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] });
  const page = await noGl.newPage({ viewport: { width: 1440, height: 900 } });
  const problems = watch(page);
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.locator("#about").scrollIntoViewIfNeeded();
  await sleep(2000);
  const state = await page.evaluate(() => ({ canvas: !!document.querySelector("#about canvas"), fallback: getComputedStyle(document.querySelector("#about img")).opacity }));
  check("[no-webgl] static globe shown, no canvas", !state.canvas && state.fallback === "1", JSON.stringify(state));
  check("[no-webgl] no errors", problems.length === 0, problems.slice(0, 6).join(" | "));
  await noGl.close();
}

// ---------------------------------------------------------------- 404
{
  const res = await fetch(`${base}/no-such-page/`);
  const body = await res.text();
  check("[404] unknown route serves 404 page", res.status === 404 && body.includes("404"));
}

server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${shotDir}`);
process.exit(failed.length ? 1 : 0);

// Renders the Open Graph share images (1200×630) for both languages in a real browser,
// so Arabic shaping and the Cairo typeface render exactly as on the site.
// Run with: npm run og   (requires an installed Edge/Chrome; BROWSER_CHANNEL=msedge|chrome)
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "public/og");
await mkdir(outDir, { recursive: true });

const hero = (await readFile(path.join(root, "public/images/hero-wing-1280.webp"))).toString("base64");
const mark = await readFile(path.join(root, "src/app/icon.svg"), "utf8");

const copy = {
  ar: {
    dir: "rtl",
    eyebrow: "النجف الأشرف · سياحة وسفر",
    line1: "رحلتك تبدأ",
    line2: "بالاتجاه الصحيح",
    services: "تذاكر طيران · تأشيرات · تأمين صحي للسفر · موافقات دخول · برامج سياحية",
    name: "الاتجاه",
    tagline: "للسفر والسياحة",
  },
  en: {
    dir: "ltr",
    eyebrow: "Najaf, Iraq · Travel & Tourism",
    line1: "Your journey starts",
    line2: "in the right direction",
    services: "Flights · Visas · Travel insurance · Entry approvals · Tours",
    name: "Etijah",
    tagline: "TRAVEL & TOURISM",
  },
};

const html = (c) => `<!doctype html><html dir="${c.dir}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;900&display=block" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;overflow:hidden;font-family:Cairo,sans-serif;background:#051c33;color:#fff;position:relative}
  .bg{position:absolute;inset:0;background:url(data:image/webp;base64,${hero}) center/cover;${c.dir === "rtl" ? "transform:scaleX(-1)" : ""}}
  .shade{position:absolute;inset:0;background:linear-gradient(${c.dir === "rtl" ? "to left" : "to right"},rgba(5,28,51,.96) 30%,rgba(7,47,83,.55) 70%,rgba(7,47,83,.1))}
  .wrap{position:absolute;inset:0;padding:64px 72px;display:flex;flex-direction:column;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:16px}
  .brand svg{width:72px;height:72px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.35))}
  .brand b{display:block;font-size:38px;font-weight:900;line-height:1.1;background:linear-gradient(#f68738,#ea2b34);-webkit-background-clip:text;background-clip:text;color:transparent}
  .brand small{display:block;font-size:15px;font-weight:700;opacity:.75;margin-top:6px;letter-spacing:${c.dir === "rtl" ? "0" : ".14em"}}
  .eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:20px;font-weight:700;color:#f9ac66}
  .eyebrow i{width:10px;height:10px;border-radius:50%;background:#f58220}
  h1{font-size:${c.dir === "rtl" ? 84 : 72}px;line-height:1.15;font-weight:900;margin-top:14px}
  h1 span{display:block;color:#f7973f}
  p{font-size:22px;font-weight:500;opacity:.85}
</style></head><body><div class="bg"></div><div class="shade"></div>
<div class="wrap">
  <div class="brand">${mark}<div><b>${c.name}</b><small>${c.tagline}</small></div></div>
  <div><div class="eyebrow"><i></i>${c.eyebrow}</div><h1>${c.line1}<span>${c.line2}</span></h1></div>
  <p>${c.services}</p>
</div></body></html>`;

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [locale, c] of Object.entries(copy)) {
  await page.setContent(html(c), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, `og-${locale}.jpg`), type: "jpeg", quality: 86 });
  console.log(`✓ public/og/og-${locale}.jpg`);
}
await browser.close();

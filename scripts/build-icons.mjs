// Generates the favicon, Apple touch icon and PWA icons from the company's logo symbol.
// Run with: npm run icons
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { MARK_PLANE, MARK_RING, markSvg } from "../src/components/brand/etijah-mark.ts";

const root = path.resolve(import.meta.dirname, "..");

// Re-centre the symbol on a canvas of `size`, scaled to `scale` of it, over a background.
function iconSvg({ background, scale, circle = false }) {
  const inner = markSvg("i")
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");
  const s = 446 * (1 / scale);
  const offset = (s - 446) / 2;
  const bg = circle
    ? `<circle cx="${280 - offset + s / 2}" cy="${188.5 - offset + s / 2}" r="${s / 2}" fill="${background}"/>`
    : `<rect x="${280 - offset}" y="${188.5 - offset}" width="${s}" height="${s}" fill="${background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${280 - offset} ${188.5 - offset} ${s} ${s}">${bg}${inner}</svg>`;
}

// Sanity check that the shared geometry is present.
if (!MARK_RING || MARK_PLANE.length !== 4) throw new Error("Logo mark data missing");

// Favicon: symbol on a white disc so it stays legible on dark browser tabs.
await writeFile(path.join(root, "src/app/icon.svg"), iconSvg({ background: "#FFFFFF", scale: 0.78, circle: true }) + "\n");
// Apple touch icon: opaque white square (iOS applies its own rounding).
await sharp(Buffer.from(iconSvg({ background: "#FFFFFF", scale: 0.72 })), { density: 300 })
  .resize(180, 180)
  .png()
  .toFile(path.join(root, "src/app/apple-icon.png"));

const iconDir = path.join(root, "public/icons");
await mkdir(iconDir, { recursive: true });
for (const size of [192, 512]) {
  await sharp(Buffer.from(iconSvg({ background: "#FFFFFF", scale: 0.74, circle: true })), { density: 600 })
    .resize(size, size)
    .png()
    .toFile(path.join(iconDir, `icon-${size}.png`));
}
// Maskable: full-bleed background, symbol inside the 80% safe zone.
await sharp(Buffer.from(iconSvg({ background: "#FFFFFF", scale: 0.6 })), { density: 600 })
  .resize(512, 512)
  .png()
  .toFile(path.join(iconDir, "icon-maskable-512.png"));

// Plain symbol for reuse (e.g. documents, social profiles).
await writeFile(path.join(root, "public/brand/etijah-mark.svg"), markSvg() + "\n");

console.log("✓ icons → src/app/icon.svg, src/app/apple-icon.png, public/icons/*, public/brand/etijah-mark.svg");

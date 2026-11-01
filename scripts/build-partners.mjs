// Normalises the partner (airline) logos for the "Partners" slider.
// Sources live in assets/partners (PNG, WebP or SVG); output goes to public/partners and
// src/data/partners.json. Every logo is trimmed to its artwork, a solid white background
// is made transparent, and the result is scaled into one common box, so the slider can
// size each logo from its aspect ratio alone.
// Run with: npm run partners
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const srcDir = path.join(root, "assets/partners");
const outDir = path.join(root, "public/partners");
const manifestPath = path.join(root, "src/data/partners.json");

// The largest rendered logo is about 160×64 CSS px; this box covers 2.5× screens.
const BOX = { width: 420, height: 168 };

/**
 * "Colour to alpha" against white: the logo looks identical on white, but the white box
 * disappears. Opacity is boosted so solid colours stay solid and only the anti-aliased
 * edges become translucent. Near-white noise (JPEG artefacts) is dropped entirely.
 */
async function whiteToAlpha(input) {
  const { data, info } = await input.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const ink = 255 - Math.min(data[i], data[i + 1], data[i + 2]);
    const a = ink <= 10 ? 0 : Math.min(1, (ink / 255) * 4);
    if (a === 0) {
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = 0;
      continue;
    }
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(255 - (255 - data[i + c]) / a);
    data[i + 3] = Math.round(a * 255);
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const files = (await readdir(srcDir)).filter((f) => /\.(png|webp|jpe?g|svg)$/i.test(f)).sort();
const manifest = {};

for (const file of files) {
  const name = file.replace(/\.[a-z]+$/i, "");
  const input = sharp(path.join(srcDir, file), file.endsWith(".svg") ? { density: 150 } : {});
  const { isOpaque } = await input.stats();
  const flat = isOpaque ? await whiteToAlpha(input.clone()) : await input.clone().ensureAlpha().png().toBuffer();

  const trimmed = await sharp(flat).trim({ threshold: 10 }).toBuffer();
  const { data, info } = await sharp(trimmed)
    .resize({ ...BOX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 90, effort: 6 })
    .toBuffer({ resolveWithObject: true });
  await writeFile(path.join(outDir, `${name}.webp`), data);

  manifest[name] = { width: info.width, height: info.height };
  console.log(`✓ ${name} → ${info.width}×${info.height} (${(data.length / 1024).toFixed(1)} KB)${isOpaque ? ", white removed" : ""}`);
}

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Manifest written to ${path.relative(root, manifestPath)}`);

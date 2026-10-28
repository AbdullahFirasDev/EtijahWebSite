// Generates responsive AVIF/WebP variants and a manifest with blur placeholders.
// Source photos live in assets/images; output goes to public/images and src/data/images.json.
// Run with: npm run images
import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const srcDir = path.join(root, "assets/images");
const outDir = path.join(root, "public/images");
const manifestPath = path.join(root, "src/data/images.json");

// Width ladders per image family; keep them small to limit page weight.
const ladders = {
  "hero-": [640, 960, 1280, 1920, 2560],
  "cta-": [640, 960, 1280, 1920],
  "why-": [480, 768, 1080],
  "dest-": [480, 768, 1080, 1440],
};
const ladderFor = (name) =>
  Object.entries(ladders).find(([prefix]) => name.startsWith(prefix))?.[1] ?? [640, 1280];

await mkdir(outDir, { recursive: true });
await mkdir(path.dirname(manifestPath), { recursive: true });

const files = (await readdir(srcDir)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
const manifest = {};

for (const file of files) {
  const name = file.replace(/\.(jpe?g|png)$/i, "");
  const input = sharp(path.join(srcDir, file)).rotate();
  const { width, height } = await input.metadata();
  const widths = ladderFor(name).filter((w) => w <= width);

  for (const w of widths) {
    const resized = input.clone().resize({ width: w, withoutEnlargement: true });
    await resized.clone().avif({ quality: 52, effort: 5 }).toFile(path.join(outDir, `${name}-${w}.avif`));
    await resized.clone().webp({ quality: 74, effort: 5 }).toFile(path.join(outDir, `${name}-${w}.webp`));
  }

  const blur = await input.clone().resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
  manifest[name] = {
    width,
    height,
    widths,
    blur: `data:image/webp;base64,${blur.toString("base64")}`,
  };
  console.log(`✓ ${name} (${width}×${height}) → ${widths.join(", ")}`);
}

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Manifest written to ${path.relative(root, manifestPath)}`);

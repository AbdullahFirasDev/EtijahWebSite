// Builds the dotted-land data for the 3D globe and a matching static fallback image
// (used before WebGL loads, on mobile, with reduced motion, or when WebGL is unavailable).
// Run with: npm run globe
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { geoContains } from "d3-geo";
import sharp from "sharp";
import { feature } from "topojson-client";
import { NAJAF, ROUTE_TARGETS, arcPoints, latLngToVector, rotateView } from "../src/lib/globe-math.ts";

const root = path.resolve(import.meta.dirname, "..");
const topology = JSON.parse(
  await readFile(path.join(root, "node_modules/world-atlas/land-110m.json"), "utf8"),
);
const land = feature(topology, topology.objects.land);

// Rows of evenly spaced dots, denser toward the equator (equal-area look).
const STEP = 1.6;
const coords = [];
for (let lat = -56; lat <= 78; lat += STEP) {
  const count = Math.max(1, Math.round((360 / STEP) * Math.cos(lat * (Math.PI / 180))));
  for (let i = 0; i < count; i++) {
    const lng = -180 + (360 / count) * i;
    if (geoContains(land, [lng, lat])) coords.push(+lat.toFixed(2), +lng.toFixed(2));
  }
}

const dataPath = path.join(root, "src/data/globe-points.json");
await mkdir(path.dirname(dataPath), { recursive: true });
await writeFile(dataPath, JSON.stringify(coords));
console.log(`✓ ${coords.length / 2} land dots → ${path.relative(root, dataPath)}`);

// ---- Static fallback render (orthographic, same orientation as the WebGL scene) ----
const S = 1000;
const C = S / 2;
const R = S * 0.42;
const px = ([x, y]) => [C + x * R, C - y * R];

let dots = "";
for (let i = 0; i < coords.length; i += 2) {
  const v = rotateView(latLngToVector(coords[i], coords[i + 1]));
  if (v[2] <= 0.02) continue;
  const [x, y] = px(v);
  const r = (1.35 + 1.25 * v[2]).toFixed(2);
  const o = (0.28 + 0.62 * v[2]).toFixed(2);
  dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill-opacity="${o}"/>`;
}

let arcs = "";
let ends = "";
for (const target of Object.values(ROUTE_TARGETS)) {
  const pts = arcPoints(NAJAF, target, 80).map((p) => rotateView(p));
  let d = "";
  let pen = false;
  for (const p of pts) {
    const hidden = p[2] < 0 && p[0] * p[0] + p[1] * p[1] < 1;
    if (hidden) {
      pen = false;
      continue;
    }
    const [x, y] = px(p);
    d += `${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    pen = true;
  }
  if (d) arcs += `<path d="${d}"/>`;
  const end = rotateView(latLngToVector(target[0], target[1]));
  if (end[2] > 0) {
    const [x, y] = px(end);
    ends += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/>`;
  }
}

const [nx, ny] = px(rotateView(latLngToVector(NAJAF[0], NAJAF[1])));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="atmo" cx="50%" cy="50%" r="50%">
      <stop offset="0.86" stop-color="#78BEF5" stop-opacity="0"/>
      <stop offset="0.9" stop-color="#78BEF5" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#78BEF5" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sphere" cx="38%" cy="30%" r="75%">
      <stop offset="0" stop-color="#1A86D8"/>
      <stop offset="0.38" stop-color="#0866B2"/>
      <stop offset="0.75" stop-color="#06457E"/>
      <stop offset="1" stop-color="#042747"/>
    </radialGradient>
    <radialGradient id="rim" cx="50%" cy="50%" r="50%">
      <stop offset="0.82" stop-color="#A9D6FA" stop-opacity="0"/>
      <stop offset="1" stop-color="#A9D6FA" stop-opacity="0.42"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#F58220" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#F58220" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="${C}" cy="${C}" r="${(R * 1.18).toFixed(1)}" fill="url(#atmo)"/>
  <circle cx="${C}" cy="${C}" r="${R}" fill="url(#sphere)"/>
  <g fill="#D4EAFB">${dots}</g>
  <circle cx="${C}" cy="${C}" r="${R}" fill="url(#rim)"/>
  <g fill="none" stroke="#BFE0FA" stroke-opacity="0.9" stroke-width="3" stroke-linecap="round">${arcs}</g>
  <g fill="#FFFFFF">${ends}</g>
  <circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="26" fill="url(#halo)"/>
  <circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="7.5" fill="#F58220" stroke="#FFFFFF" stroke-width="2.5"/>
</svg>`;

const outDir = path.join(root, "public/images");
await mkdir(outDir, { recursive: true });
const base = sharp(Buffer.from(svg));
for (const w of [640, 1000]) {
  const img = base.clone().resize(w, w);
  await img.clone().webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(path.join(outDir, `globe-fallback-${w}.webp`));
  await img.clone().avif({ quality: 60, effort: 6 }).toFile(path.join(outDir, `globe-fallback-${w}.avif`));
}
console.log("✓ globe fallback → public/images/globe-fallback-{640,1000}.{webp,avif}");

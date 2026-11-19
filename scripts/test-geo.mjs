// Integrity checks for the reference geography (src/data): unique slugs and IATA codes,
// Arabic names without stray Latin letters, every destination airport present in the airport list,
// every country code valid. Run: npm run test:geo
import { AIRPORT_ROWS } from "../src/data/airports.ts";
import { GEO_COUNTRIES } from "../src/data/destinations.ts";

const problems = [];
const codes = new Set();
for (const [code, country, ar, en] of AIRPORT_ROWS) {
  if (!/^[A-Z]{3}$/.test(code)) problems.push(`airport code ${code}`);
  if (codes.has(code)) problems.push(`duplicate airport ${code}`);
  codes.add(code);
  if (!/^[A-Z]{2}$/.test(country)) problems.push(`airport ${code}: country ${country}`);
  if (/[A-Za-z]/.test(ar)) problems.push(`airport ${code}: Latin letters in Arabic name "${ar}"`);
  if (!en.trim()) problems.push(`airport ${code}: empty English name`);
}

const slugs = new Set();
const countries = new Set();
let total = 0;
for (const { code, items } of GEO_COUNTRIES) {
  if (countries.has(code)) problems.push(`country ${code} listed twice`);
  countries.add(code);
  const names = new Set();
  for (const [slug, ar, en, kind, airport] of items) {
    total++;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) problems.push(`${code}: bad slug "${slug}"`);
    if (slugs.has(slug)) problems.push(`duplicate slug ${slug}`);
    slugs.add(slug);
    if (/[A-Za-zႠ-ჿ]/.test(ar)) problems.push(`${slug}: non-Arabic letters in "${ar}"`);
    if (ar.trim().length < 2 || en.trim().length < 2 || ar.length > 80 || en.length > 80) problems.push(`${slug}: name length`);
    if (names.has(ar)) problems.push(`${code}: duplicate Arabic name ${ar}`);
    names.add(ar);
    if (kind !== "c" && kind !== "a") problems.push(`${slug}: kind ${kind}`);
    if (airport && !codes.has(airport)) problems.push(`${slug}: airport ${airport} not in the airport list`);
  }
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join("\n"));
  process.exit(1);
}
console.log(`✓ ${countries.size} countries · ${total} destinations · ${AIRPORT_ROWS.length} airports`);

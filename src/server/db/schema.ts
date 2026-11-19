// MongoDB collections and indexes. Dependency-free apart from the driver (no "server-only"),
// so the CLI (scripts/db.mjs) and the app share exactly the same definitions.
import type { CreateIndexesOptions, Db, IndexSpecification, MongoClient } from "mongodb";

export const COLLECTIONS = [
  "staff_users",
  "company_users",
  "sessions",
  "counters",
  "settings",
  "rate_limits",
  "audit_log",
  "media",
  "destinations",
  "services",
  "hotels",
  "programs",
  "departures",
  "leads",
  "lead_events",
  "companies",
  "company_hotels",
  "b2b_requests",
  "quotes",
  "quote_events",
  "airlines",
  "commission_rules",
  "tickets",
  "migrations",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

type IndexDef = [IndexSpecification, CreateIndexesOptions?];

const unique = (name: string): CreateIndexesOptions => ({ name, unique: true });
const named = (name: string): CreateIndexesOptions => ({ name });

/** Every list, filter and lookup in the portal is backed by one of these. */
export const INDEXES: Partial<Record<CollectionName, IndexDef[]>> = {
  staff_users: [[{ email: 1 }, unique("email_unique")], [{ role: 1, active: 1 }, named("role_active")]],
  company_users: [[{ email: 1 }, unique("email_unique")], [{ company_id: 1, active: 1 }, named("company")]],
  sessions: [
    [{ expires_at: 1 }, { name: "ttl_expires", expireAfterSeconds: 0 }],
    [{ realm: 1, user_id: 1 }, named("realm_user")],
  ],
  rate_limits: [
    [{ bucket: 1, key: 1, at: 1 }, named("lookup")],
    [{ at: 1 }, { name: "ttl_day", expireAfterSeconds: 86_400 }],
  ],
  audit_log: [
    [{ entity: 1, entity_id: 1, created_at: -1 }, named("entity")],
    [{ created_at: -1 }, named("recent")],
    [{ user_id: 1, created_at: -1 }, named("user")],
  ],
  media: [[{ created_at: -1 }, named("recent")]],
  destinations: [[{ slug: 1 }, unique("slug_unique")], [{ country_code: 1, name_ar: 1 }, named("country")]],
  services: [[{ sort: 1 }, named("sort")]],
  hotels: [
    [{ slug: 1 }, unique("slug_unique")],
    [{ destination_id: 1 }, named("destination")],
    [{ status: 1, country_code: 1, stars: 1 }, named("filter")],
    [{ name_ar: 1 }, named("name_ar")],
    [{ name_en: 1 }, named("name_en")],
  ],
  programs: [
    [{ code: 1 }, unique("code_unique")],
    [{ slug: 1 }, unique("slug_unique")],
    [{ "share.token": 1 }, { name: "share_token", unique: true, partialFilterExpression: { "share.token": { $type: "string" } } }],
    [{ status: 1, type: 1, updated_at: -1 }, named("status_type")],
    [{ country_codes: 1, status: 1 }, named("country")],
    [{ destination_ids: 1 }, named("destinations")],
    [{ "hotel_options.hotel_id": 1 }, named("hotels")],
    [{ price_from: 1 }, named("price")],
  ],
  departures: [
    [{ code: 1 }, unique("code_unique")],
    [{ program_id: 1, depart_date: 1 }, named("program")],
    [{ depart_date: 1, status: 1 }, named("date")],
  ],
  leads: [
    [{ ref: 1 }, unique("ref_unique")],
    [{ status: 1, created_at: -1 }, named("status")],
    [{ program_id: 1 }, named("program")],
    [{ departure_id: 1, status: 1 }, named("departure")],
    [{ kind: 1, created_at: -1 }, named("kind")],
  ],
  lead_events: [[{ lead_id: 1, created_at: -1 }, named("lead")]],
  companies: [[{ status: 1, name: 1 }, named("status_name")], [{ "contacts.id": 1 }, named("contacts")]],
  company_hotels: [[{ company_id: 1, hotel_id: 1 }, unique("company_hotel_unique")], [{ hotel_id: 1 }, named("hotel")]],
  b2b_requests: [
    [{ ref: 1 }, unique("ref_unique")],
    [{ company_id: 1, created_at: -1 }, named("company")],
    [{ status: 1, created_at: -1 }, named("status")],
  ],
  quotes: [
    [{ ref: 1 }, unique("ref_unique")],
    [{ token: 1 }, unique("token_unique")],
    [{ company_id: 1, updated_at: -1 }, named("company")],
    [{ status: 1, valid_until: 1 }, named("status_validity")],
    [{ lead_id: 1 }, named("lead")],
    [{ "hotels.hotel_id": 1 }, named("hotels")],
    [{ updated_at: -1 }, named("recent")],
  ],
  quote_events: [[{ quote_id: 1, created_at: -1 }, named("quote")]],
  airlines: [
    [{ iata: 1 }, { name: "iata_unique", unique: true, partialFilterExpression: { iata: { $type: "string" } } }],
    [{ status: 1, name_ar: 1 }, named("status_name")],
  ],
  commission_rules: [
    [{ scope: 1, airline_id: 1, company_id: 1, valid_from: -1 }, named("lookup")],
    [{ company_id: 1, airline_id: 1 }, named("company")],
  ],
  tickets: [
    [{ ref: 1 }, unique("ref_unique")],
    [{ airline_id: 1, ticket_number: 1 }, unique("ticket_unique")],
    [{ company_id: 1, issued_at: -1 }, named("company")],
    [{ airline_id: 1, issued_at: -1 }, named("airline")],
    [{ issued_at: -1 }, named("issued")],
    [{ payment_status: 1, issued_at: -1 }, named("payment")],
  ],
};

/** Creates missing collections and indexes. Idempotent: safe on every start-up. */
export async function ensureSchema(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of COLLECTIONS) {
    if (!existing.has(name)) await db.createCollection(name).catch((e: { codeName?: string }) => {
      if (e.codeName !== "NamespaceExists") throw e;
    });
  }
  for (const [name, defs] of Object.entries(INDEXES)) {
    if (!defs?.length) continue;
    await db.collection(name).createIndexes(defs.map(([key, options]) => ({ key: key as Record<string, 1 | -1>, ...options })));
  }
}

/**
 * Transactions need a replica set (or sharded cluster). Atlas always is one; a self-hosted
 * server must be started with --replSet and initiated once (see README). Fails early with a
 * clear message instead of failing later on the first transaction.
 */
export async function assertTransactions(client: MongoClient): Promise<void> {
  const hello = (await client.db("admin").command({ hello: 1 })) as { setName?: string; msg?: string };
  if (!hello.setName && hello.msg !== "isdbgrid") {
    throw new Error(
      "MongoDB is running as a standalone server, but Etijah needs a replica set for transactions. " +
        "Use MongoDB Atlas (always a replica set) — see README.",
    );
  }
}

/** Connection settings from the environment (shared by the app and the scripts). */
export function mongoConfig(env: Record<string, string | undefined> = process.env) {
  const uri = env.MONGODB_URI?.trim();
  const dbName = env.MONGODB_DB_NAME?.trim();
  if (!uri) throw new Error("MONGODB_URI is not set. Add it in Vercel → Settings → Environment Variables (locally: `vercel env pull .env.local`).");
  if (!dbName) throw new Error("MONGODB_DB_NAME is not set. Add it in Vercel → Settings → Environment Variables (locally: `vercel env pull .env.local`).");
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(dbName)) throw new Error("MONGODB_DB_NAME may only contain letters, digits, '-' and '_'.");
  return { uri, dbName };
}

/** Default reference data for a brand-new database (same as the old 0002_defaults.sql). */
export const DEFAULT_SERVICES = [
  { _id: 1, icon: "plane", name_ar: "تذاكر الطيران ذهاباً وإياباً", name_en: "Return flights", sort: 10 },
  { _id: 2, icon: "hotel", name_ar: "الإقامة الفندقية", name_en: "Hotel accommodation", sort: 20 },
  { _id: 3, icon: "meals", name_ar: "الوجبات", name_en: "Meals", sort: 30 },
  { _id: 4, icon: "transfer", name_ar: "النقل من وإلى المطار", name_en: "Airport transfers", sort: 40 },
  { _id: 5, icon: "tours", name_ar: "الجولات السياحية", name_en: "Sightseeing tours", sort: 50 },
  { _id: 6, icon: "guide", name_ar: "مرشد سياحي", name_en: "Tour guide", sort: 60 },
  { _id: 7, icon: "visa", name_ar: "التأشيرة", name_en: "Visa", sort: 70 },
  { _id: 8, icon: "insurance", name_ar: "التأمين الصحي للسفر", name_en: "Travel health insurance", sort: 80 },
];

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  currencies: ["USD", "IQD"],
  default_currency: "USD",
  quote_validity_days: 7,
  quote_terms_ar:
    "• الأسعار صالحة حتى تاريخ انتهاء العرض المذكور، وتخضع لتوفر المقاعد والغرف عند التأكيد.\n• يُعتمد الحجز بعد تأكيد الموافقة وسداد العربون المتفق عليه.\n• قد تتغير أسعار تذاكر الطيران والضرائب من شركات الطيران حتى إصدار التذاكر.\n• تخضع سياسة الإلغاء والتعديل لشروط الفنادق وشركات الطيران المعتمدة في البرنامج.",
  quote_terms_en:
    "• Prices are valid until the expiry date of this offer and are subject to seat and room availability at confirmation.\n• Bookings are confirmed after written acceptance and payment of the agreed deposit.\n• Airfares and airline taxes may change until tickets are issued.\n• Cancellation and amendment policies follow the terms of the hotels and airlines in the program.",
};

/**
 * Seeds reference data into an empty database (services, settings). Never overwrites: only
 * inserts what is missing, and only when the database has never been initialised or migrated.
 */
export async function seedDefaults(db: Db): Promise<void> {
  const marker = await db.collection<{ _id: string }>("migrations").findOne({ _id: { $in: ["defaults", "sqlite-import"] } });
  if (marker) return;
  const t = new Date().toISOString();
  if ((await db.collection("services").countDocuments()) === 0) {
    await db.collection("services").insertMany(DEFAULT_SERVICES.map((s) => ({ ...s, active: true, created_at: t, updated_at: t })) as never[]);
    await db.collection<{ _id: string; value: number }>("counters").updateOne({ _id: "services" }, { $max: { value: DEFAULT_SERVICES.length } }, { upsert: true });
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.collection<{ _id: string; value: unknown }>("settings").updateOne({ _id: key }, { $setOnInsert: { value } }, { upsert: true });
  }
  await db.collection<{ _id: string; at: string }>("migrations").updateOne({ _id: "defaults" }, { $setOnInsert: { at: t } }, { upsert: true });
}

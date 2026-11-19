import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { MongoClient, type ClientSession, type Collection, type Db, type Document } from "mongodb";
import { assertTransactions, ensureSchema, mongoConfig, seedDefaults, type CollectionName } from "./schema";

interface DbState {
  client: MongoClient;
  db: Db;
}

// Kept on globalThis so dev-mode hot reloads reuse one connection pool.
const g = globalThis as unknown as { __etijahMongo?: Promise<DbState> };

async function connect(): Promise<DbState> {
  const { uri, dbName } = mongoConfig();
  const client = new MongoClient(uri, {
    appName: "etijah-web",
    // Small pools: on Vercel every function instance keeps its own pool (Atlas counts them all).
    maxPoolSize: Number(process.env.MONGODB_POOL_SIZE) || 10,
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: 10_000,
    retryWrites: true,
  });
  // Lets Vercel Fluid Compute close idle connections before an instance is suspended.
  attachDatabasePool(client);
  await client.connect();
  await assertTransactions(client);
  const db = client.db(dbName);
  await ensureSchema(db);
  await seedDefaults(db);
  return { client, db };
}

function state(): Promise<DbState> {
  if (!g.__etijahMongo) {
    g.__etijahMongo = connect().catch((error) => {
      g.__etijahMongo = undefined;
      throw error;
    });
  }
  return g.__etijahMongo;
}

export async function db(): Promise<Db> {
  return (await state()).db;
}

/** Loosely typed document with this project's numeric `_id` (the default for untyped handles). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDoc = { _id: number; [key: string]: any };

/** Typed collection handle. */
export async function col<T extends Document = AnyDoc>(name: CollectionName): Promise<Collection<T>> {
  return (await state()).db.collection<T>(name);
}

/**
 * Runs `fn` in a multi-document transaction (snapshot reads, majority writes). Retries on
 * transient errors, so `fn` must only touch the database through the given session and must be
 * safe to run more than once. Nested calls join the outer transaction.
 */
export async function tx<T>(fn: (session: ClientSession) => Promise<T>, outer?: ClientSession): Promise<T> {
  if (outer?.inTransaction()) return fn(outer);
  const { client } = await state();
  const session = client.startSession();
  try {
    let result!: T;
    await session.withTransaction(
      async (s) => {
        result = await fn(s);
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" },
    );
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Next numeric id for `name` (atomic $inc). Called outside transactions on purpose: a counter
 * inside a transaction would serialise every writer on one document. Gaps are harmless.
 */
export async function nextId(name: string): Promise<number> {
  const counters = await col<{ _id: string; value: number }>("counters");
  const r = await counters.findOneAndUpdate({ _id: name }, { $inc: { value: 1 } }, { upsert: true, returnDocument: "after" });
  return r!.value;
}

export const now = () => new Date().toISOString();

/** Escapes user input for use inside a RegExp (search boxes). */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case-insensitive "contains" filter for search boxes. */
export const contains = (q: string) => ({ $regex: escapeRegex(q.trim()), $options: "i" });

/** Strips `_id` → `id` for React props and action results (plain, serialisable objects). */
export function withId<T extends { _id: unknown }>(doc: T): Omit<T, "_id"> & { id: T["_id"] } {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id } as Omit<T, "_id"> & { id: T["_id"] };
}

/** Closes the pool (scripts and tests). */
export async function closeDb() {
  const s = g.__etijahMongo;
  g.__etijahMongo = undefined;
  if (s) await (await s.catch(() => null))?.client.close();
}

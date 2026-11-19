import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ClientSession } from "mongodb";
import { headers } from "next/headers";
import { col, nextId } from "./db";

let cachedSecret: string | null = null;

/**
 * Server secret for HMAC signatures (PDF render links, IP hashing). Uses APP_SECRET when set;
 * otherwise one is generated on first use and kept in the database (settings.app_secret, which
 * the SQLite migration carries over so existing signed links stay valid). Set APP_SECRET
 * explicitly when running several instances.
 */
export async function appSecret(): Promise<string> {
  if (process.env.APP_SECRET && process.env.APP_SECRET.length >= 32) return process.env.APP_SECRET;
  if (cachedSecret) return cachedSecret;
  const settings = await col<{ _id: string; value: unknown }>("settings");
  // Atomic "insert if missing", then read back whatever won (several workers may start at once).
  await settings.updateOne({ _id: "app_secret" }, { $setOnInsert: { value: randomBytes(32).toString("base64url") } }, { upsert: true });
  const row = await settings.findOne({ _id: "app_secret" });
  cachedSecret = String(row!.value);
  return cachedSecret;
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export async function sign(value: string): Promise<string> {
  return createHmac("sha256", await appSecret()).update(value).digest("base64url");
}

export async function verifySignature(value: string, signature: string | null | undefined): Promise<boolean> {
  if (!signature) return false;
  const expected = Buffer.from(await sign(value));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Client IP and user agent of the current request (behind a reverse proxy, from X-Forwarded-For). */
export async function requestMeta() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return {
    ip,
    // Raw IPs are not stored; a keyed hash is enough for rate limiting and abuse review.
    ipHash: (await sign(`ip:${ip}`)).slice(0, 24),
    userAgent: (h.get("user-agent") ?? "").slice(0, 300),
    secure: h.get("x-forwarded-proto") === "https" || (h.get("origin") ?? "").startsWith("https://"),
  };
}

/**
 * Sliding-window rate limit. Returns false when `key` already made `limit` attempts in the last
 * `windowSeconds` (and records nothing in that case). Old entries expire through a TTL index.
 */
export async function rateLimit(bucket: string, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const limits = await col<{ bucket: string; key: string; at: Date }>("rate_limits");
  const since = new Date(Date.now() - windowSeconds * 1000);
  const count = await limits.countDocuments({ bucket, key, at: { $gte: since } }, { limit });
  if (count >= limit) return false;
  await limits.insertOne({ bucket, key, at: new Date() });
  return true;
}

export async function clearRateLimit(bucket: string, key: string) {
  await (await col("rate_limits")).deleteMany({ bucket, key });
}

export type RefPrefix = "REQ" | "QT" | "GRP" | "PRG" | "B2B" | "TKT";

/** Next sequential reference, e.g. nextRef("REQ") → "REQ-2026-00042" (atomic, gap-tolerant). */
export async function nextRef(prefix: RefPrefix): Promise<string> {
  const yearly = prefix !== "PRG";
  const year = new Date().getUTCFullYear();
  const name = yearly ? `${prefix}-${year}` : prefix;
  const value = await nextId(name);
  const width = prefix === "REQ" || prefix === "TKT" ? 5 : prefix === "GRP" ? 3 : 4;
  return yearly ? `${prefix}-${year}-${String(value).padStart(width, "0")}` : `${prefix}-${String(value).padStart(width, "0")}`;
}

export interface AuditDoc {
  user_id: number | null;
  actor: "staff" | "company" | "system" | "cli";
  action: string;
  entity: string;
  entity_id: string | null;
  meta: unknown;
  created_at: string;
}

/** Appends to the audit log (inside the caller's transaction when a session is given). */
export async function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId?: string | number | null,
  meta?: unknown,
  opts: { session?: ClientSession; actor?: AuditDoc["actor"] } = {},
) {
  const log = await col<AuditDoc>("audit_log");
  await log.insertOne(
    {
      user_id: userId,
      actor: opts.actor ?? (userId == null ? "system" : "staff"),
      action,
      entity,
      entity_id: entityId == null ? null : String(entityId),
      meta: meta ?? null,
      created_at: new Date().toISOString(),
    },
    { session: opts.session },
  );
}

/** Recent audit entries for one record, with the staff member's name. */
export async function recentAudit(entity: string, entityId: string | number, limit = 20) {
  const log = await col<AuditDoc>("audit_log");
  const rows = await log
    .aggregate<{ action: string; created_at: string; meta: unknown; user_name: string | null; actor: string }>([
      { $match: { entity, entity_id: String(entityId) } },
      { $sort: { created_at: -1 } },
      { $limit: limit },
      { $lookup: { from: "staff_users", localField: "user_id", foreignField: "_id", as: "u" } },
      { $project: { _id: 0, action: 1, created_at: 1, meta: 1, actor: 1, user_name: { $ifNull: [{ $first: "$u.name" }, null] } } },
    ])
    .toArray();
  return rows;
}

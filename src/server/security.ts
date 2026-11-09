import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { all, get, run } from "./db";

let cachedSecret: string | null = null;

/**
 * Server secret for HMAC signatures (PDF render links, IP hashing). Uses APP_SECRET when set;
 * otherwise one is generated on first use and kept in the database, so a fresh install works
 * without configuration. Set APP_SECRET explicitly when running several instances.
 */
export function appSecret(): string {
  if (process.env.APP_SECRET && process.env.APP_SECRET.length >= 32) return process.env.APP_SECRET;
  if (cachedSecret) return cachedSecret;
  const row = get<{ value: string }>("SELECT value FROM settings WHERE key = 'app_secret'");
  if (row) {
    cachedSecret = JSON.parse(row.value) as string;
  } else {
    cachedSecret = randomBytes(32).toString("base64url");
    run("INSERT OR IGNORE INTO settings (key, value) VALUES ('app_secret', ?)", JSON.stringify(cachedSecret));
    cachedSecret = JSON.parse(get<{ value: string }>("SELECT value FROM settings WHERE key = 'app_secret'")!.value) as string;
  }
  return cachedSecret;
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function sign(value: string): string {
  return createHmac("sha256", appSecret()).update(value).digest("base64url");
}

export function verifySignature(value: string, signature: string | null | undefined): boolean {
  if (!signature) return false;
  const expected = Buffer.from(sign(value));
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
    ipHash: sign(`ip:${ip}`).slice(0, 24),
    userAgent: (h.get("user-agent") ?? "").slice(0, 300),
    secure: h.get("x-forwarded-proto") === "https" || (h.get("origin") ?? "").startsWith("https://"),
  };
}

/**
 * Sliding-window rate limit stored in SQLite. Returns false when `key` already made
 * `limit` attempts in the last `windowSeconds` (and records nothing in that case).
 */
export function rateLimit(bucket: string, key: string, limit: number, windowSeconds: number): boolean {
  const nowMs = Date.now();
  const since = nowMs - windowSeconds * 1000;
  run("DELETE FROM rate_limits WHERE bucket = ? AND at < ?", bucket, nowMs - 86_400_000);
  const count = get<{ n: number }>("SELECT COUNT(*) AS n FROM rate_limits WHERE bucket = ? AND key = ? AND at >= ?", bucket, key, since)!.n;
  if (count >= limit) return false;
  run("INSERT INTO rate_limits (bucket, key, at) VALUES (?, ?, ?)", bucket, key, nowMs);
  return true;
}

export function clearRateLimit(bucket: string, key: string) {
  run("DELETE FROM rate_limits WHERE bucket = ? AND key = ?", bucket, key);
}

/** Next sequential reference, e.g. nextRef("REQ") → "REQ-2026-00042". Call inside tx(). */
export function nextRef(prefix: "REQ" | "QT" | "GRP" | "PRG"): string {
  const yearly = prefix !== "PRG";
  const year = new Date().getUTCFullYear();
  const name = yearly ? `${prefix}-${year}` : prefix;
  run("INSERT INTO counters (name, value) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET value = value + 1", name);
  const value = get<{ value: number }>("SELECT value FROM counters WHERE name = ?", name)!.value;
  const width = prefix === "REQ" ? 5 : prefix === "GRP" ? 3 : 4;
  return yearly ? `${prefix}-${year}-${String(value).padStart(width, "0")}` : `${prefix}-${String(value).padStart(width, "0")}`;
}

export function audit(userId: number | null, action: string, entity: string, entityId?: string | number | null, meta?: unknown) {
  run(
    "INSERT INTO audit_log (user_id, action, entity, entity_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    userId,
    action,
    entity,
    entityId == null ? null : String(entityId),
    meta == null ? null : JSON.stringify(meta),
    new Date().toISOString(),
  );
}

export function recentAudit(entity: string, entityId: string | number, limit = 20) {
  return all<{ action: string; created_at: string; user_name: string | null; meta: string | null }>(
    `SELECT a.action, a.created_at, a.meta, u.name AS user_name FROM audit_log a
     LEFT JOIN staff_users u ON u.id = a.user_id
     WHERE a.entity = ? AND a.entity_id = ? ORDER BY a.id DESC LIMIT ?`,
    entity,
    String(entityId),
    limit,
  );
}

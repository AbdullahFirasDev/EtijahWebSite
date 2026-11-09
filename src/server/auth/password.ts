// scrypt password hashing. Dependency-free (Node built-ins only) so scripts/db.mjs can use it.
// Format: scrypt$N$r$p$<salt base64url>$<hash base64url>
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, options: ScryptOptions, keyLength: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, keyLength, { ...options, maxmem: 128 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P }, KEY_LENGTH);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await derive(password, Buffer.from(salt, "base64url"), { N: Number(n), r: Number(r), p: Number(p) }, expected.length);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Minimum policy, checked on the server for every password set or changed. */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "يجب ألا تقل كلمة المرور عن 10 أحرف.";
  if (password.length > 200) return "كلمة المرور طويلة جداً.";
  if (!/[A-Za-z؀-ۿ]/.test(password) || !/\d/.test(password)) return "يجب أن تحتوي كلمة المرور على حروف وأرقام.";
  return null;
}

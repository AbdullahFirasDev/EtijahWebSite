import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { can, type Permission, type Role } from "@/lib/permissions";
import { get, now, run } from "../db";
import { randomToken, requestMeta, sha256 } from "../security";

export const SESSION_COOKIE = "etijah_staff";
const SESSION_DAYS = 7;

export interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export class AuthError extends Error {
  constructor(message = "غير مصرح لك بتنفيذ هذا الإجراء.") {
    super(message);
    this.name = "AuthError";
  }
}

export async function createSession(userId: number) {
  const token = randomToken(32);
  const meta = await requestMeta();
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_DAYS * 86_400_000);
  run(
    "INSERT INTO staff_sessions (id, user_id, created_at, expires_at, last_seen_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
    sha256(token),
    userId,
    created.toISOString(),
    expires.toISOString(),
    created.toISOString(),
    meta.ipHash,
    meta.userAgent,
  );
  // Housekeeping: drop expired sessions.
  run("DELETE FROM staff_sessions WHERE expires_at < ?", created.toISOString());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure whenever the site is served over HTTPS (directly or behind a TLS proxy).
    secure: meta.secure || process.env.SESSION_COOKIE_SECURE === "true",
    path: "/",
    expires,
    priority: "high",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) run("DELETE FROM staff_sessions WHERE id = ?", sha256(token));
  jar.delete(SESSION_COOKIE);
}

/** The signed-in staff member for this request, or null. Cached per request. */
export const getStaff = cache(async (): Promise<StaffUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const row = get<StaffUser & { expires_at: string; last_seen_at: string }>(
    `SELECT u.id, u.name, u.email, u.role, s.expires_at, s.last_seen_at
     FROM staff_sessions s JOIN staff_users u ON u.id = s.user_id
     WHERE s.id = ? AND u.active = 1`,
    id,
  );
  if (!row) return null;
  const t = now();
  if (row.expires_at < t) {
    run("DELETE FROM staff_sessions WHERE id = ?", id);
    return null;
  }
  // Throttled activity stamp (at most every 5 minutes).
  if (Date.parse(row.last_seen_at) < Date.now() - 300_000) run("UPDATE staff_sessions SET last_seen_at = ? WHERE id = ?", t, id);
  return { id: row.id, name: row.name, email: row.email, role: row.role };
});

/** For pages: redirects to the login page, or to the dashboard when the role lacks `permission`. */
export async function requireStaffPage(permission?: Permission): Promise<StaffUser> {
  const staff = await getStaff();
  if (!staff) redirect("/staff/login/");
  if (permission && !can(staff.role, permission)) redirect("/staff/?denied=1");
  return staff;
}

/** For server actions and route handlers: throws AuthError instead of redirecting. */
export async function requireStaff(permission?: Permission): Promise<StaffUser> {
  const staff = await getStaff();
  if (!staff) throw new AuthError("انتهت جلستك. يرجى تسجيل الدخول مجدداً.");
  if (permission && !can(staff.role, permission)) throw new AuthError();
  return staff;
}

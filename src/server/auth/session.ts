import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { can, type CompanyPermission, type Permission, type Role } from "@/lib/permissions";
import { col } from "../db";
import { randomToken, requestMeta, sha256 } from "../security";

export const SESSION_COOKIE = "etijah_staff";
export const COMPANY_COOKIE = "etijah_b2b";
const SESSION_DAYS = 7;

export type Realm = "staff" | "company";

export interface SessionDoc {
  _id: string;
  realm: Realm;
  user_id: number;
  company_id: number | null;
  created_at: string;
  expires_at: Date;
  last_seen_at: string;
  ip_hash: string | null;
  user_agent: string | null;
}

export interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface CompanyUser {
  id: number;
  name: string;
  email: string;
  companyId: number;
  permissions: CompanyPermission[];
}

export class AuthError extends Error {
  constructor(message = "غير مصرح لك بتنفيذ هذا الإجراء.") {
    super(message);
    this.name = "AuthError";
  }
}

const cookieName = (realm: Realm) => (realm === "staff" ? SESSION_COOKIE : COMPANY_COOKIE);

/** Starts a session. The database stores only the SHA-256 of the cookie token. */
export async function createSession(realm: Realm, userId: number, companyId: number | null = null) {
  const token = randomToken(32);
  const meta = await requestMeta();
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_DAYS * 86_400_000);
  const sessions = await col<SessionDoc>("sessions");
  await sessions.insertOne({
    _id: sha256(token),
    realm,
    user_id: userId,
    company_id: companyId,
    created_at: created.toISOString(),
    expires_at: expires,
    last_seen_at: created.toISOString(),
    ip_hash: meta.ipHash,
    user_agent: meta.userAgent,
  });

  const jar = await cookies();
  jar.set(cookieName(realm), token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure whenever the site is served over HTTPS (directly or behind a TLS proxy).
    secure: meta.secure || process.env.SESSION_COOKIE_SECURE === "true",
    path: "/",
    expires,
    priority: "high",
  });
}

export async function destroySession(realm: Realm) {
  const jar = await cookies();
  const token = jar.get(cookieName(realm))?.value;
  if (token) await (await col<SessionDoc>("sessions")).deleteOne({ _id: sha256(token), realm });
  jar.delete(cookieName(realm));
}

/** Valid, unexpired session of `realm` for this request's cookie (activity stamp throttled). */
async function currentSession(realm: Realm): Promise<SessionDoc | null> {
  const token = (await cookies()).get(cookieName(realm))?.value;
  if (!token || token.length > 100) return null;
  const sessions = await col<SessionDoc>("sessions");
  const s = await sessions.findOne({ _id: sha256(token), realm });
  if (!s) return null;
  if (s.expires_at.getTime() < Date.now()) {
    await sessions.deleteOne({ _id: s._id });
    return null;
  }
  if (Date.parse(s.last_seen_at) < Date.now() - 300_000) await sessions.updateOne({ _id: s._id }, { $set: { last_seen_at: new Date().toISOString() } });
  return s;
}

/** The signed-in staff member for this request, or null. Cached per request. */
export const getStaff = cache(async (): Promise<StaffUser | null> => {
  const s = await currentSession("staff");
  if (!s) return null;
  const users = await col<{ _id: number; name: string; email: string; role: Role; active: boolean }>("staff_users");
  const u = await users.findOne({ _id: s.user_id, active: true }, { projection: { name: 1, email: 1, role: 1 } });
  return u ? { id: u._id, name: u.name, email: u.email, role: u.role } : null;
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

// ------------------------------------------------------------------ B2B company users
/**
 * The signed-in company user, or null. The company is taken from the user record (never from
 * the request), and both the user and the company must still be active with the portal enabled.
 */
export const getCompanyUser = cache(async (): Promise<CompanyUser | null> => {
  const s = await currentSession("company");
  if (!s) return null;
  const users = await col<{ _id: number; company_id: number; name: string; email: string; permissions: CompanyPermission[]; active: boolean }>("company_users");
  const u = await users.findOne({ _id: s.user_id, active: true });
  if (!u || u.company_id !== s.company_id) return null;
  const companies = await col<{ _id: number; status: string; portal?: { enabled?: boolean } }>("companies");
  const c = await companies.findOne({ _id: u.company_id }, { projection: { status: 1, portal: 1 } });
  if (!c || c.status === "archived" || !c.portal?.enabled) return null;
  return { id: u._id, name: u.name, email: u.email, companyId: u.company_id, permissions: u.permissions ?? [] };
});

export const companyCan = (u: CompanyUser, p: CompanyPermission) => u.permissions.includes(p);

export async function requireCompanyPage(permission?: CompanyPermission): Promise<CompanyUser> {
  const u = await getCompanyUser();
  if (!u) redirect("/b2b/login/");
  if (permission && !companyCan(u, permission)) redirect("/b2b/?denied=1");
  return u;
}

export async function requireCompanyUser(permission?: CompanyPermission): Promise<CompanyUser> {
  const u = await getCompanyUser();
  if (!u) throw new AuthError("Your session has ended. Please sign in again. / انتهت جلستك، سجّل الدخول مجدداً.");
  if (permission && !companyCan(u, permission)) throw new AuthError();
  return u;
}

/** Ends every session of a user (deactivation, password reset). */
export async function endSessionsOf(realm: Realm, userId: number, keepSessionId?: string) {
  const sessions = await col<SessionDoc>("sessions");
  await sessions.deleteMany(keepSessionId ? { realm, user_id: userId, _id: { $ne: keepSessionId } } : { realm, user_id: userId });
}

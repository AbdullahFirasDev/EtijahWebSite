import "server-only";
import type { Role } from "@/lib/permissions";
import { hashPassword, verifyPassword } from "../auth/password";
import { endSessionsOf } from "../auth/session";
import { col, nextId, now } from "../db";

export interface StaffUserDoc {
  _id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  active: boolean;
  failed_logins: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
}

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
const users = () => col<StaffUserDoc>("staff_users");
const PUBLIC = { name: 1, email: 1, role: 1, active: 1, last_login_at: 1, created_at: 1 } as const;
const toRow = (u: Pick<StaffUserDoc, "_id" | keyof typeof PUBLIC>): UserRow => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
  last_login_at: u.last_login_at,
  created_at: u.created_at,
});

export async function listUsers(): Promise<UserRow[]> {
  return (await (await users()).find({}, { projection: PUBLIC }).sort({ active: -1, name: 1 }).toArray()).map(toRow);
}

export async function getUser(id: number): Promise<UserRow | null> {
  const u = await (await users()).findOne({ _id: id }, { projection: PUBLIC });
  return u ? toRow(u) : null;
}

export const countAdmins = async () => (await users()).countDocuments({ role: "admin", active: true });
export const emailTaken = async (email: string, exceptId = 0) => !!(await (await users()).findOne({ email, _id: { $ne: exceptId } }, { projection: { _id: 1 } }));

// Constant-cost dummy hash, so response time does not reveal whether an e-mail exists.
const DUMMY_HASH = "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** Shared lockout logic for staff and company accounts (5 failures → 15 minutes). */
export async function authenticateIn<T extends { _id: number; password_hash: string; active: boolean; failed_logins: number; locked_until: string | null }>(
  collection: "staff_users" | "company_users",
  email: string,
  password: string,
): Promise<{ user: T } | { error: "invalid" | "locked" }> {
  const c = await col<T>(collection);
  const row = (await c.findOne({ email } as never)) as T | null;
  const valid = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !row.active) return { error: "invalid" };
  if (row.locked_until && row.locked_until > now()) return { error: "locked" };
  if (!valid) {
    const failures = (row.failed_logins ?? 0) + 1;
    const lock = failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
    await c.updateOne({ _id: row._id } as never, { $set: { failed_logins: lock ? 0 : failures, locked_until: lock } } as never);
    return { error: lock ? "locked" : "invalid" };
  }
  await c.updateOne({ _id: row._id } as never, { $set: { failed_logins: 0, locked_until: null, last_login_at: now() } } as never);
  return { user: row };
}

export const authenticate = (email: string, password: string) => authenticateIn<StaffUserDoc>("staff_users", email, password);

export async function createUser(input: { name: string; email: string; role: Role; password: string }): Promise<number> {
  const t = now();
  const id = await nextId("staff_users");
  await (await users()).insertOne({
    _id: id,
    name: input.name,
    email: input.email,
    password_hash: await hashPassword(input.password),
    role: input.role,
    active: true,
    failed_logins: 0,
    locked_until: null,
    last_login_at: null,
    created_at: t,
    updated_at: t,
  });
  return id;
}

export async function updateUser(id: number, input: { name: string; email: string; role: Role; active: boolean }) {
  await (await users()).updateOne({ _id: id }, { $set: { name: input.name, email: input.email, role: input.role, active: input.active, updated_at: now() } });
  // Deactivating a user ends their sessions immediately.
  if (!input.active) await endSessionsOf("staff", id);
}

export async function setPassword(id: number, password: string, keepSession?: string) {
  await (await users()).updateOne({ _id: id }, { $set: { password_hash: await hashPassword(password), failed_logins: 0, locked_until: null, updated_at: now() } });
  // Sign out other devices.
  await endSessionsOf("staff", id, keepSession);
}

export async function checkPassword(id: number, password: string) {
  const row = await (await users()).findOne({ _id: id }, { projection: { password_hash: 1 } });
  return !!row && verifyPassword(password, row.password_hash);
}

export async function activeStaffNames() {
  return (await (await users()).find({ active: true }, { projection: { name: 1 } }).sort({ name: 1 }).toArray()).map((u) => ({ id: u._id, name: u.name }));
}

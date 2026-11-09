import "server-only";
import type { Role } from "@/lib/permissions";
import { hashPassword, verifyPassword } from "../auth/password";
import { all, get, now, run } from "../db";

export interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: number;
  last_login_at: string | null;
  created_at: string;
}

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

export const listUsers = () => all<UserRow>("SELECT id, name, email, role, active, last_login_at, created_at FROM staff_users ORDER BY active DESC, name");
export const getUser = (id: number) => get<UserRow>("SELECT id, name, email, role, active, last_login_at, created_at FROM staff_users WHERE id = ?", id);
export const countAdmins = () => get<{ n: number }>("SELECT COUNT(*) AS n FROM staff_users WHERE role = 'admin' AND active = 1")!.n;
export const emailTaken = (email: string, exceptId = 0) => !!get("SELECT 1 FROM staff_users WHERE email = ? AND id != ?", email, exceptId);

/**
 * Verifies credentials with per-account lockout (5 failures → 15 minutes). Always runs a
 * hash comparison so response time does not reveal whether the email exists.
 */
export async function authenticate(email: string, password: string): Promise<{ user: UserRow } | { error: "invalid" | "locked" }> {
  const row = get<UserRow & { password_hash: string; failed_logins: number; locked_until: string | null }>(
    "SELECT * FROM staff_users WHERE email = ?",
    email,
  );
  const hash = row?.password_hash ?? "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const valid = await verifyPassword(password, hash);
  if (!row || !row.active) return { error: "invalid" };
  if (row.locked_until && row.locked_until > now()) return { error: "locked" };
  if (!valid) {
    const failures = row.failed_logins + 1;
    const lock = failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
    run("UPDATE staff_users SET failed_logins = ?, locked_until = ? WHERE id = ?", lock ? 0 : failures, lock, row.id);
    return { error: lock ? "locked" : "invalid" };
  }
  run("UPDATE staff_users SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?", now(), row.id);
  return { user: row };
}

export async function createUser(input: { name: string; email: string; role: Role; password: string }) {
  const t = now();
  return run(
    "INSERT INTO staff_users (name, email, password_hash, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
    input.name,
    input.email,
    await hashPassword(input.password),
    input.role,
    t,
    t,
  ).id;
}

export function updateUser(id: number, input: { name: string; email: string; role: Role; active: boolean }) {
  run("UPDATE staff_users SET name = ?, email = ?, role = ?, active = ?, updated_at = ? WHERE id = ?", input.name, input.email, input.role, input.active, now(), id);
  // Deactivating a user ends their sessions immediately.
  if (!input.active) run("DELETE FROM staff_sessions WHERE user_id = ?", id);
}

export async function setPassword(id: number, password: string, keepSession?: string) {
  run("UPDATE staff_users SET password_hash = ?, failed_logins = 0, locked_until = NULL, updated_at = ? WHERE id = ?", await hashPassword(password), now(), id);
  // Sign out other devices.
  if (keepSession) run("DELETE FROM staff_sessions WHERE user_id = ? AND id != ?", id, keepSession);
  else run("DELETE FROM staff_sessions WHERE user_id = ?", id);
}

export async function checkPassword(id: number, password: string) {
  const row = get<{ password_hash: string }>("SELECT password_hash FROM staff_users WHERE id = ?", id);
  return !!row && verifyPassword(password, row.password_hash);
}

// Database and staff-account CLI.
//   npm run db:migrate
//   npm run staff:list
//   npm run staff:create -- --email you@example.com --name "الاسم" --role admin [--password "..."]
//   npm run staff:reset-password -- --email you@example.com [--password "..."] [--activate]
//
// Reads .env files exactly like Next.js, so it always uses the same DATABASE_PATH as the server
// (default data/etijah.db). Without --password, a strong password is generated and printed once.
// Passwords are stored only as scrypt hashes: a lost password cannot be recovered, only reset.
import { randomInt } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { DatabaseSync } from "node:sqlite";
import nextEnv from "@next/env";
import { migrate } from "../src/server/db/migrate.ts";
import { hashPassword, passwordProblem } from "../src/server/auth/password.ts";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);
// Values already in the environment win (tests pass their own DATABASE_PATH).
nextEnv.loadEnvConfig(root, process.env.NODE_ENV === "development", { info: () => {}, error: console.error });

const file = path.resolve(process.env.DATABASE_PATH || path.join(root, "data", "etijah.db"));
mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file, { timeout: 5000 });
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

const [command, ...rest] = process.argv.slice(2);
const { values } = parseArgs({
  args: rest,
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string" },
    password: { type: "string" },
    activate: { type: "boolean" },
  },
  strict: true,
});

const applied = migrate(db, path.join(root, "db", "migrations"));
if (applied.length) console.log(`Applied migrations: ${applied.join(", ")}`);
console.log(`Database: ${file}`);

/** Easy to read and type: 4 groups of 4 from an alphabet without look-alikes (≈ 79 bits). */
function generatePassword() {
  const letters = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  for (;;) {
    const groups = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => all[randomInt(all.length)]).join(""));
    const pw = groups.join("-");
    if (!passwordProblem(pw)) return pw; // guarantees letters and digits
  }
}

function choosePassword() {
  const password = values.password ?? generatePassword();
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  return password;
}

const findUser = (email) => db.prepare("SELECT id, name, email, role, active FROM staff_users WHERE email = ?").get(email);

function printCredentials(email, password, generated) {
  console.log(`\n  Login:    /staff/login/`);
  console.log(`  Email:    ${email}`);
  if (generated) console.log(`  Password: ${password}\n\n  Shown once. Change it after signing in (حسابي → تغيير كلمة المرور).`);
  else console.log("  Password: (the one you passed with --password)");
}

async function main() {
  switch (command) {
    case "migrate":
      console.log("Database ready.");
      return;

    case "list-staff": {
      const rows = db.prepare("SELECT id, name, email, role, active, last_login_at FROM staff_users ORDER BY id").all();
      if (!rows.length) {
        console.log('No staff accounts yet. Create one with: npm run staff:create -- --email you@example.com --name "الاسم" --role admin');
        return;
      }
      for (const u of rows) console.log(`#${u.id}  ${u.email}  ${u.role}${u.active ? "" : "  (deactivated)"}  ${u.name}  last login: ${u.last_login_at ?? "never"}`);
      return;
    }

    case "create-staff": {
      const email = values.email?.trim().toLowerCase();
      const name = values.name?.trim();
      const role = values.role ?? "admin";
      if (!email || !name) throw new Error('Usage: create-staff --email x@y.z --name "Name" --role admin|sales|content [--password ...]');
      if (!["admin", "sales", "content"].includes(role)) throw new Error("role must be admin, sales or content");
      if (findUser(email)) throw new Error(`An account with ${email} already exists. To set a new password: npm run staff:reset-password -- --email ${email}`);
      const password = choosePassword();
      const now = new Date().toISOString();
      db.prepare("INSERT INTO staff_users (name, email, password_hash, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(
        name,
        email,
        await hashPassword(password),
        role,
        now,
        now,
      );
      console.log(`Created ${role} account for ${email}`);
      printCredentials(email, password, !values.password);
      return;
    }

    case "reset-password": {
      const email = values.email?.trim().toLowerCase();
      if (!email) throw new Error("Usage: reset-password --email x@y.z [--password ...] [--activate]   (see accounts: npm run staff:list)");
      const user = findUser(email);
      if (!user) throw new Error(`No account for ${email}. See the accounts with: npm run staff:list`);
      const password = choosePassword();
      const now = new Date().toISOString();
      // Only the password changes; the account, its role and all other data stay as they are.
      // Failed-login lockout is cleared and existing sessions are signed out.
      db.prepare(
        "UPDATE staff_users SET password_hash = ?, failed_logins = 0, locked_until = NULL, active = CASE WHEN ? THEN 1 ELSE active END, updated_at = ? WHERE id = ?",
      ).run(await hashPassword(password), values.activate ? 1 : 0, now, user.id);
      db.prepare("DELETE FROM staff_sessions WHERE user_id = ?").run(user.id);
      db.prepare("INSERT INTO audit_log (user_id, action, entity, entity_id, meta, created_at) VALUES (NULL, 'reset_password_cli', 'user', ?, NULL, ?)").run(String(user.id), now);
      console.log(`Password reset for ${email} (${user.role})`);
      if (!user.active && !values.activate) console.log("Note: this account is deactivated. Add --activate to enable it.");
      printCredentials(email, password, !values.password);
      return;
    }

    default:
      console.log("Commands: migrate | list-staff | create-staff | reset-password");
  }
}

main()
  .catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.close());

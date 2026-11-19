// Database and staff-account CLI (MongoDB).
//   npm run db:init                      create collections and indexes, seed reference data
//   npm run db:check                     connection, replica set (transactions) and counts
//   npm run db:seed-geo [-- --dry-run] [-- --country TR,AE]
//                                        add the reference cities/tourist areas (src/data/destinations.ts)
//   npm run staff:list
//   npm run staff:create -- --email you@example.com --name "الاسم" --role admin [--password "..."]
//   npm run staff:reset-password -- --email you@example.com [--password "..."] [--activate]
//
// Reads .env files exactly like Next.js, so it always uses the same MONGODB_URI / MONGODB_DB_NAME
// as the server. Without --password, a strong password is generated and printed once. Passwords
// are stored only as scrypt hashes: a lost password cannot be recovered, only reset.
import { randomInt } from "node:crypto";
import path from "node:path";
import { parseArgs } from "node:util";
import nextEnv from "@next/env";
import { MongoClient } from "mongodb";
import { hashPassword, passwordProblem } from "../src/server/auth/password.ts";
import { GEO_COUNTRIES } from "../src/data/destinations.ts";
import { importGeo } from "../src/server/db/geo.ts";
import { assertTransactions, COLLECTIONS, ensureSchema, mongoConfig, seedDefaults } from "../src/server/db/schema.ts";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);
// Values already in the environment win (tests pass their own MONGODB_URI / MONGODB_DB_NAME).
nextEnv.loadEnvConfig(root, process.env.NODE_ENV === "development", { info: () => {}, error: console.error });

const ROLES = ["admin", "tourism_manager", "sales", "accountant", "content"];
const [command, ...rest] = process.argv.slice(2);
const { values } = parseArgs({
  args: rest,
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string" },
    password: { type: "string" },
    activate: { type: "boolean" },
    "dry-run": { type: "boolean" },
    country: { type: "string" },
  },
  strict: true,
});

/** Easy to read and type: 4 groups of 4 from an alphabet without look-alikes (≈ 79 bits). */
function generatePassword() {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    const pw = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("")).join("-");
    if (!passwordProblem(pw)) return pw;
  }
}

function choosePassword() {
  const password = values.password ?? generatePassword();
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  return password;
}

function printCredentials(email, password, generated) {
  console.log(`\n  Login:    /staff/login/`);
  console.log(`  Email:    ${email}`);
  if (generated) console.log(`  Password: ${password}\n\n  Shown once. Change it after signing in (حسابي → تغيير كلمة المرور).`);
  else console.log("  Password: (the one you passed with --password)");
}

async function main() {
  const { uri, dbName } = mongoConfig();
  const client = new MongoClient(uri, { appName: "etijah-cli", serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  try {
    await assertTransactions(client);
    const db = client.db(dbName);
    await ensureSchema(db);
    await seedDefaults(db);
    console.log(`Database: ${dbName} @ ${uri.replace(/\/\/[^@]*@/, "//***@")}`);
    const users = db.collection("staff_users");

    switch (command) {
      case "init":
        console.log("Collections and indexes are ready.");
        return;

      case "check": {
        const hello = await client.db("admin").command({ hello: 1 });
        console.log(`Replica set: ${hello.setName ?? "(sharded cluster)"} · primary: ${hello.primary ?? hello.me ?? "?"}`);
        for (const name of COLLECTIONS) console.log(`  ${name.padEnd(18)} ${await db.collection(name).estimatedDocumentCount()}`);
        const migrated = await db.collection("migrations").findOne({ _id: "sqlite-import" });
        console.log(migrated ? `SQLite import: ${migrated.at} from ${migrated.source}` : "SQLite import: not run on this database");
        return;
      }

      case "list-staff": {
        const rows = await users.find({}, { projection: { password_hash: 0 } }).sort({ _id: 1 }).toArray();
        if (!rows.length) {
          console.log('No staff accounts yet. Create one with: npm run staff:create -- --email you@example.com --name "الاسم" --role admin');
          return;
        }
        for (const u of rows) console.log(`#${u._id}  ${u.email}  ${u.role}${u.active ? "" : "  (deactivated)"}  ${u.name}  last login: ${u.last_login_at ?? "never"}`);
        return;
      }

      case "create-staff": {
        const email = values.email?.trim().toLowerCase();
        const name = values.name?.trim();
        const role = values.role ?? "admin";
        if (!email || !name) throw new Error(`Usage: create-staff --email x@y.z --name "Name" --role ${ROLES.join("|")} [--password ...]`);
        if (!ROLES.includes(role)) throw new Error(`role must be one of: ${ROLES.join(", ")}`);
        if (await users.findOne({ email })) throw new Error(`An account with ${email} already exists. To set a new password: npm run staff:reset-password -- --email ${email}`);
        const password = choosePassword();
        const now = new Date().toISOString();
        const counter = await db.collection("counters").findOneAndUpdate({ _id: "staff_users" }, { $inc: { value: 1 } }, { upsert: true, returnDocument: "after" });
        await users.insertOne({
          _id: counter.value,
          name,
          email,
          password_hash: await hashPassword(password),
          role,
          active: true,
          failed_logins: 0,
          locked_until: null,
          last_login_at: null,
          created_at: now,
          updated_at: now,
        });
        await db.collection("audit_log").insertOne({ user_id: null, actor: "cli", action: "create_cli", entity: "user", entity_id: String(counter.value), meta: { role }, created_at: now });
        console.log(`Created ${role} account for ${email}`);
        printCredentials(email, password, !values.password);
        return;
      }

      case "reset-password": {
        const email = values.email?.trim().toLowerCase();
        if (!email) throw new Error("Usage: reset-password --email x@y.z [--password ...] [--activate]   (see accounts: npm run staff:list)");
        const user = await users.findOne({ email });
        if (!user) throw new Error(`No account for ${email}. See the accounts with: npm run staff:list`);
        const password = choosePassword();
        const now = new Date().toISOString();
        // Only the password changes; the account, its role and all other data stay as they are.
        await users.updateOne(
          { _id: user._id },
          { $set: { password_hash: await hashPassword(password), failed_logins: 0, locked_until: null, updated_at: now, ...(values.activate ? { active: true } : {}) } },
        );
        await db.collection("sessions").deleteMany({ realm: "staff", user_id: user._id });
        await db.collection("audit_log").insertOne({ user_id: null, actor: "cli", action: "reset_password_cli", entity: "user", entity_id: String(user._id), meta: null, created_at: now });
        console.log(`Password reset for ${email} (${user.role})`);
        if (!user.active && !values.activate) console.log("Note: this account is deactivated. Add --activate to enable it.");
        printCredentials(email, password, !values.password);
        return;
      }

      case "seed-geo": {
        const countries = values.country ? values.country.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean) : undefined;
        const dryRun = !!values["dry-run"];
        const r = await importGeo(db, GEO_COUNTRIES, { countries, dryRun });
        for (const c of r.countries) console.log(`  ${c.code}  +${String(c.added).padStart(3)} new · ${String(c.completed).padStart(3)} completed · ${String(c.existing).padStart(3)} already there`);
        console.log(`${dryRun ? "[dry run] would add" : "Added"} ${r.added} destinations, completed ${r.completed} existing ones (kind / airport), ${r.existing} unchanged.`);
        if (!dryRun && (r.added || r.completed)) {
          await db.collection("audit_log").insertOne({ user_id: null, actor: "cli", action: "import_geo_cli", entity: "destination", entity_id: null, meta: { added: r.added, completed: r.completed, countries: countries ?? "all" }, created_at: new Date().toISOString() });
          await db.collection("migrations").updateOne({ _id: "geo-reference" }, { $set: { at: new Date().toISOString(), added: r.added } }, { upsert: true });
        }
        return;
      }

      default:
        console.log("Commands: init | check | seed-geo | list-staff | create-staff | reset-password");
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

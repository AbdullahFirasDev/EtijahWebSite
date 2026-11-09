// Applies db/migrations/NNNN_name.sql files in order, once each.
// Dependency-free (Node built-ins only) so scripts/db.mjs can import it directly.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

export const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

export function migrate(db: DatabaseSync, dir: string = MIGRATIONS_DIR): string[] {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const files = readdirSync(/*turbopackIgnore: true*/ dir)
    .filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f))
    .sort();
  const applied = new Set(
    (db.prepare("SELECT id FROM schema_migrations").all() as { id: string }[]).map((r) => r.id),
  );
  const done: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, file), "utf8");
    // IMMEDIATE takes the write lock up front, so parallel processes (e.g. build workers)
    // serialise here; the re-check skips a migration another process just applied.
    db.exec("BEGIN IMMEDIATE");
    try {
      if (!db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(file)) {
        db.exec(sql);
        db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(file, new Date().toISOString());
        done.push(file);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return done;
}

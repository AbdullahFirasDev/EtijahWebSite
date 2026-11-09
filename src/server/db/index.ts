import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import { migrate } from "./migrate";

/** SQLite file location. Override with DATABASE_PATH (absolute, or relative to the project root). */
export const DATABASE_PATH = path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH || path.join(process.cwd(), "data", "etijah.db"));

type Param = SQLInputValue | boolean | undefined;

interface DbState {
  conn: DatabaseSync;
  statements: Map<string, StatementSync>;
  depth: number;
}

// Kept on globalThis so dev-mode hot reloads reuse one connection.
const g = globalThis as unknown as { __etijahDb?: DbState };

function state(): DbState {
  if (!g.__etijahDb) {
    mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
    const conn = new DatabaseSync(DATABASE_PATH, { timeout: 5000 });
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;");
    migrate(conn);
    g.__etijahDb = { conn, statements: new Map(), depth: 0 };
  }
  return g.__etijahDb;
}

function statement(sql: string) {
  const s = state();
  let stmt = s.statements.get(sql);
  if (!stmt) {
    stmt = s.conn.prepare(sql);
    s.statements.set(sql, stmt);
  }
  return stmt;
}

// node:sqlite accepts neither booleans nor undefined.
const bind = (params: Param[]): SQLInputValue[] =>
  params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : p));

/** Plain object copy (node:sqlite rows have a null prototype, which React can't serialise). */
const plain = <T>(row: unknown): T => ({ ...(row as object) }) as T;

export function get<T>(sql: string, ...params: Param[]): T | undefined {
  const row = statement(sql).get(...bind(params));
  return row ? plain<T>(row) : undefined;
}

export function all<T>(sql: string, ...params: Param[]): T[] {
  return statement(sql).all(...bind(params)).map((r) => plain<T>(r));
}

export function run(sql: string, ...params: Param[]) {
  const r = statement(sql).run(...bind(params));
  return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
}

/** Runs `fn` atomically. Nested calls join the outer transaction (via savepoints). */
export function tx<T>(fn: () => T): T {
  const s = state();
  const name = `sp${s.depth}`;
  s.conn.exec(s.depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${name}`);
  s.depth++;
  try {
    const result = fn();
    s.depth--;
    s.conn.exec(s.depth === 0 ? "COMMIT" : `RELEASE ${name}`);
    return result;
  } catch (error) {
    s.depth--;
    s.conn.exec(s.depth === 0 ? "ROLLBACK" : `ROLLBACK TO ${name}; RELEASE ${name}`);
    throw error;
  }
}

export const now = () => new Date().toISOString();

/** Builds `?, ?, ?` for IN (...) clauses. */
export const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(", ");

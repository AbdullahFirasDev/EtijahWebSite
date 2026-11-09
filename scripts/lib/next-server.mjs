// Starts the app (`next start`, or `next dev` with { dev: true }) on a free port with a fresh,
// temporary database and media folder. Used by the smoke and end-to-end tests.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

export async function startNextServer({ dev = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "etijah-test-"));
  const port = await freePort();
  const env = {
    ...process.env,
    DATABASE_PATH: path.join(dir, "test.db"),
    MEDIA_DIR: path.join(dir, "media"),
    PDF_CACHE_DIR: path.join(dir, "pdf"),
    PORT: String(port),
  };
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, dev ? "dev" : "start", "--port", String(port)], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const ready = () => /Ready|started server/i.test(log);
  for (let i = 0; i < 240 && !ready() && child.exitCode === null; i++) await new Promise((r) => setTimeout(r, 250));
  if (!ready()) {
    child.kill();
    throw new Error(`Next.js did not start (run \`npm run build\` first?)\n${log}`);
  }
  return {
    base: `http://localhost:${port}`,
    dbPath: env.DATABASE_PATH,
    log: () => log,
    async stop() {
      child.kill();
      await new Promise((r) => setTimeout(r, 800));
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* Windows may keep the SQLite file locked for a moment */
      }
    },
  };
}

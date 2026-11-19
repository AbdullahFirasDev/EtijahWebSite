// Starts the app (`next start`, or `next dev` with { dev: true }) on a free port with its own
// throw-away database (etijah_test_<time>) on the configured MongoDB Atlas cluster, dropped
// afterwards. Used by the smoke and end-to-end tests, so tests never touch the real database.
// Needs MONGODB_URI (and BLOB_READ_WRITE_TOKEN for uploads): `vercel env pull .env.local`.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import nextEnv from "@next/env";
import { MongoClient } from "mongodb";

const root = path.resolve(import.meta.dirname, "..", "..");
nextEnv.loadEnvConfig(root, false, { info: () => {}, error: console.error });

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

/** A temporary database on the configured cluster (transactions work exactly as in production). */
export async function startTestMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Run `vercel env pull .env.local` first.");
  const dbName = `etijah_test_${Date.now().toString(36)}`;
  const stop = async () => {
    const client = await MongoClient.connect(uri);
    await client.db(dbName).dropDatabase().catch(() => undefined);
    await client.close();
  };
  return { uri, dbName, stop };
}

export async function startNextServer({ dev = false } = {}) {
  const port = await freePort();
  const mongo = await startTestMongo();
  const env = {
    ...process.env,
    MONGODB_URI: mongo.uri,
    MONGODB_DB_NAME: mongo.dbName,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "",
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
    await mongo.stop();
    throw new Error(`Next.js did not start (run \`npm run build\` first?)\n${log}`);
  }
  return {
    base: `http://localhost:${port}`,
    mongo: { uri: mongo.uri, dbName: mongo.dbName },
    env: { MONGODB_URI: mongo.uri, MONGODB_DB_NAME: mongo.dbName },
    log: () => log,
    async stop() {
      child.kill();
      await new Promise((r) => setTimeout(r, 800));
      await mongo.stop().catch(() => undefined);
    },
  };
}

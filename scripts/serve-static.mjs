// Minimal static server for the exported site (out/), mirroring how Apache serves it:
// directory → index.html, unknown paths → 404.html with a 404 status.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { createGzip } from "node:zlib";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

export function serveStatic(rootDir, port = 0) {
  const root = path.resolve(rootDir);
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    let status = 200;
    try {
      if (statSync(file).isDirectory()) file = path.join(file, "index.html");
      statSync(file);
    } catch {
      file = path.join(root, "404.html");
      status = 404;
    }
    createReadStream(file)
      .on("open", function () {
        const type = TYPES[path.extname(file)] ?? "application/octet-stream";
        // Compress text like Apache mod_deflate does (see public/.htaccess).
        const gzip = /text|javascript|json|xml|svg|manifest/.test(type) && /gzip/.test(req.headers["accept-encoding"] ?? "");
        res.writeHead(status, { "content-type": type, ...(gzip ? { "content-encoding": "gzip", vary: "Accept-Encoding" } : {}) });
        (gzip ? this.pipe(createGzip()) : this).pipe(res);
      })
      .on("error", () => res.writeHead(404, { "content-type": "text/plain" }).end("Not found"));
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

if (import.meta.main) {
  const port = Number(process.env.PORT) || 3000;
  await serveStatic(path.resolve(import.meta.dirname, "../out"), port);
  console.log(`Serving out/ at http://127.0.0.1:${port}/`);
}

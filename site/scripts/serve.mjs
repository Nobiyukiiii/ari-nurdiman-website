#!/usr/bin/env node
/** Tiny dev server: builds, serves dist/, rebuilds when content/src/public change. No dependencies. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const port = Number(process.env.PORT) || 3000;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain" };

const build = () => { const r = spawnSync(process.execPath, [path.join(root, "build.mjs")], { cwd: root, stdio: "inherit" }); return r.status === 0; };
build();

let timer;
for (const dir of ["content", "src", "public"]) {
  fs.watch(path.join(root, dir), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(build, 150); });
}
fs.watch(path.join(root, "build.mjs"), () => { clearTimeout(timer); timer = setTimeout(build, 150); });

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(dist, p);
  if (!f.startsWith(dist)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { res.writeHead(404, { "content-type": types[".html"] }).end(fs.readFileSync(path.join(dist, "404.html"))); return; }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`\nhttp://localhost:${port}  (rebuilds on change)`));

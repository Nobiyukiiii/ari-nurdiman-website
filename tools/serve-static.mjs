#!/usr/bin/env node
/** Minimal static file server with CORS, for local development: node tools/serve-static.mjs <dir> [port] */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] || ".");
const port = Number(process.argv[3]) || 8080;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain" };

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(dir, p);
  if (!f.startsWith(dir)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  const headers = { "access-control-allow-origin": "*", "cache-control": "no-store" };
  if (!fs.existsSync(f)) { res.writeHead(404, headers).end("Not found"); return; }
  res.writeHead(200, { ...headers, "content-type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`serving ${dir} on http://localhost:${port}`));

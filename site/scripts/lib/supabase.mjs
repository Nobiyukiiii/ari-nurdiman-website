/** Minimal Supabase REST helpers (fetch only, no dependencies). Shared by pull and seed. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Loads ROOT/.env (KEY=VALUE per line) into process.env without overriding real env vars. */
export function loadEnv() {
  const f = path.join(ROOT, ".env");
  if (!fs.existsSync(f)) return;
  for (const raw of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export function client(url, key) {
  if (!url || !key) throw new Error("Missing Supabase credentials (see .env.example)");
  const base = url.replace(/\/$/, "");
  const headers = (extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, ...extra });
  const fail = async (res, what) => { throw new Error(`${what} failed: ${res.status} ${(await res.text()).slice(0, 300)}`); };
  return {
    base,
    async select(table, query = "select=*") {
      const res = await fetch(`${base}/rest/v1/${table}?${query}`, { headers: headers() });
      if (!res.ok) await fail(res, `GET ${table}`);
      return res.json();
    },
    async upsert(table, rows, onConflict) {
      const res = await fetch(`${base}/rest/v1/${table}?on_conflict=${onConflict}`, {
        method: "POST",
        headers: headers({ "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(rows),
      });
      if (!res.ok) await fail(res, `UPSERT ${table}`);
    },
    async insert(table, rows) {
      const res = await fetch(`${base}/rest/v1/${table}`, {
        method: "POST",
        headers: headers({ "content-type": "application/json", prefer: "return=minimal" }),
        body: JSON.stringify(rows),
      });
      if (!res.ok) await fail(res, `INSERT ${table}`);
    },
    publicUrl: (p) => `${base}/storage/v1/object/public/media/${p.split("/").map(encodeURIComponent).join("/")}`,
    async upload(p, buf, contentType) {
      const res = await fetch(`${base}/storage/v1/object/media/${p.split("/").map(encodeURIComponent).join("/")}`, {
        method: "POST",
        headers: headers({ "content-type": contentType, "x-upsert": "true", "cache-control": "max-age=31536000" }),
        body: buf,
      });
      if (!res.ok) await fail(res, `UPLOAD ${p}`);
    },
  };
}

/** Same canonical string on the server (this file) and in the admin panel, so both compute the same version. */
export function contentVersion(parts) {
  const lines = [];
  for (const [table, rows] of parts) {
    for (const r of [...rows].sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0))) lines.push(`${table}:${r.id}:${r.updated_at}`);
  }
  return crypto.createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
}

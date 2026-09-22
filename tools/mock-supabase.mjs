#!/usr/bin/env node
/**
 * Tiny local imitation of the parts of Supabase this project uses
 * (Auth password login, PostgREST tables, public Storage bucket).
 * For development and automated tests only. NOT a security boundary.
 *
 *   node tools/mock-supabase.mjs [--port 54321]
 *
 * Login: admin@example.com / password123     anon key: anon-key     service key: service-key
 * Emulated policies: anon reads published rows only; writes need a login token or the service key.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[process.argv.indexOf("--port") + 1]) || 54321;
const dataDir = process.env.MOCK_DATA || path.join(here, ".mock-data");
const storageDir = path.join(dataDir, "storage");
fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(storageDir, { recursive: true });

const ANON = "anon-key", SERVICE = "service-key";
const USER = { id: "11111111-1111-1111-1111-111111111111", email: "admin@example.com" };
const PASSWORD = "password123";
const STATUS_TABLES = new Set(["releases", "photos", "videos", "news"]);
const ADMIN_ONLY = new Set(["admin_settings", "publish_log", "admins"]);
const TABLES = ["site_settings", "releases", "photos", "videos", "news", "admin_settings", "publish_log", "admins", "ui_text"];
const db = Object.fromEntries(TABLES.map((t) => [t, []]));
db.admins.push({ user_id: USER.id, email: USER.email, id: USER.id });
const sessions = new Map(); // access token -> user
const refreshes = new Map();
let logId = 0;

const send = (res, code, body, headers = {}) => {
  const isJson = body !== undefined && typeof body !== "string" && !Buffer.isBuffer(body);
  res.writeHead(code, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS", "access-control-expose-headers": "*", ...(isJson ? { "content-type": "application/json" } : {}), ...headers });
  res.end(body === undefined ? undefined : isJson ? JSON.stringify(body) : body);
};
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); });
const uuid = () => crypto.randomUUID();

function role(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token === SERVICE) return "service";
  if (sessions.has(token)) return "admin";
  return "anon";
}

function applyFilters(rows, params) {
  let out = rows;
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    const m = v.match(/^(eq|neq|in|is|gt|gte|lt|lte)\.(.*)$/s);
    if (!m) continue;
    const [, op, val] = m;
    out = out.filter((r) => {
      const cell = r[k];
      if (op === "eq") return String(cell) === val;
      if (op === "neq") return String(cell) !== val;
      if (op === "is") return val === "null" ? cell === null || cell === undefined : String(cell) === val;
      if (op === "in") return val.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(cell));
      if (op === "gt") return cell > val;
      if (op === "gte") return cell >= val;
      if (op === "lt") return cell < val;
      return cell <= val;
    });
  }
  return out;
}
function applyOrder(rows, order) {
  if (!order) return rows;
  const keys = order.split(",").map((s) => { const [col, dir = "asc", nulls] = s.split("."); return { col, desc: dir === "desc", nullsLast: nulls === "nullslast" }; });
  return [...rows].sort((a, b) => {
    for (const { col, desc, nullsLast } of keys) {
      const av = a[col], bv = b[col];
      const an = av === null || av === undefined, bn = bv === null || bv === undefined;
      if (an || bn) { if (an && bn) continue; return (an ? 1 : -1) * (nullsLast || !desc ? 1 : -1); }
      if (av === bv) continue;
      const c = av > bv ? 1 : -1;
      return desc ? -c : c;
    }
    return 0;
  });
}
function withDefaults(table, row) {
  const now = new Date().toISOString();
  const r = { ...row };
  if (table === "site_settings") r.id = 1;
  else if (table !== "admin_settings" && table !== "admins" && r.id === undefined) r.id = table === "publish_log" ? ++logId : uuid();
  if (table === "ui_text") { /* no status: always public */ }
  if (table === "releases") { r.status ??= "draft"; r.release_type ??= "single"; r.sort ??= 0; r.credits ??= []; r.related_links ??= []; r.tracks ??= []; r.description_lang ??= "id"; }
  if (STATUS_TABLES.has(table)) { r.status ??= "published"; r.sort ??= 0; }
  r.created_at ??= now; r.updated_at = now;
  return r;
}
const uniqueKey = { releases: "slug", site_settings: "id", admin_settings: "key", ui_text: "key" };

async function handleRest(req, res, url, table) {
  if (!TABLES.includes(table)) return send(res, 404, { message: "unknown table" });
  const who = role(req);
  const rows = db[table];
  const params = [...url.searchParams];
  const write = req.method !== "GET";
  if (who === "anon" && (write || ADMIN_ONLY.has(table))) return send(res, write ? 401 : 200, write ? { code: "42501", message: "new row violates row-level security policy" } : []);
  const visible = () => (who === "anon" && STATUS_TABLES.has(table) ? rows.filter((r) => r.status === "published") : rows);

  if (req.method === "GET") {
    let out = applyFilters(visible(), params);
    out = applyOrder(out, url.searchParams.get("order"));
    const limit = Number(url.searchParams.get("limit"));
    if (limit) out = out.slice(0, limit);
    return send(res, 200, out);
  }
  const prefer = req.headers.prefer || "";
  const wantRows = prefer.includes("return=representation");
  if (req.method === "POST") {
    const body = JSON.parse((await readBody(req)).toString() || "[]");
    const list = Array.isArray(body) ? body : [body];
    const merge = prefer.includes("resolution=merge-duplicates");
    const key = url.searchParams.get("on_conflict") || uniqueKey[table];
    const saved = [];
    for (const item of list) {
      const existing = key ? rows.find((r) => String(r[key]) === String(item[key] ?? (table === "site_settings" ? 1 : undefined))) : null;
      if (existing && merge) { Object.assign(existing, item, { updated_at: new Date().toISOString() }); saved.push(existing); continue; }
      if (existing) return send(res, 409, { code: "23505", message: `duplicate key value violates unique constraint "${table}_${key}_key"` });
      const row = withDefaults(table, item);
      rows.push(row); saved.push(row);
    }
    return wantRows ? send(res, 201, saved) : send(res, 201);
  }
  if (req.method === "PATCH") {
    const patch = JSON.parse((await readBody(req)).toString() || "{}");
    const hit = applyFilters(rows, params);
    for (const r of hit) {
      if (patch.slug && rows.some((o) => o !== r && o.slug === patch.slug)) return send(res, 409, { code: "23505", message: "duplicate key value violates unique constraint \"releases_slug_key\"" });
      Object.assign(r, patch, { updated_at: new Date().toISOString() });
    }
    return wantRows ? send(res, 200, hit) : send(res, 204);
  }
  if (req.method === "DELETE") {
    const hit = new Set(applyFilters(rows, params));
    db[table] = rows.filter((r) => !hit.has(r));
    return wantRows ? send(res, 200, [...hit]) : send(res, 204);
  }
  send(res, 405, { message: "method not allowed" });
}

const safeJoin = (base, rel) => { const f = path.join(base, decodeURIComponent(rel)); return f.startsWith(base) ? f : null; };
function listDir(dir, prefix) {
  // Like Supabase: immediate children only; folders come back with id null.
  const d = path.join(dir, prefix || "");
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).map((e) => (e.isDirectory()
    ? { name: e.name, id: null, metadata: null }
    : { name: e.name, id: crypto.randomUUID(), metadata: { size: fs.statSync(path.join(d, e.name)).size } }));
}

async function handleStorage(req, res, url, parts) {
  // parts: after /storage/v1/
  if (parts[0] === "object" && parts[1] === "public" && req.method === "GET") {
    const bucket = parts[2]; const f = safeJoin(path.join(storageDir, bucket), parts.slice(3).join("/"));
    if (!f || !fs.existsSync(f)) return send(res, 404, { message: "not found" });
    const ext = path.extname(f).toLowerCase();
    return send(res, 200, fs.readFileSync(f), { "content-type": { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[ext] || "application/octet-stream" });
  }
  const who = role(req);
  if (who === "anon") return send(res, 401, { message: "Unauthorized" });
  if (parts[0] === "object" && parts[1] === "list" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    return send(res, 200, listDir(path.join(storageDir, parts[2]), body.prefix || ""));
  }
  if (parts[0] === "object" && req.method === "POST") {
    const bucket = parts[1]; const f = safeJoin(path.join(storageDir, bucket), parts.slice(2).join("/"));
    if (!f) return send(res, 400, { message: "bad path" });
    if (fs.existsSync(f) && req.headers["x-upsert"] !== "true") return send(res, 400, { message: "The resource already exists" });
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, await readBody(req));
    return send(res, 200, { Key: `${bucket}/${parts.slice(2).join("/")}` });
  }
  if (parts[0] === "object" && req.method === "DELETE") {
    const bucket = parts[1]; const body = JSON.parse((await readBody(req)).toString() || "{}");
    for (const p of body.prefixes || []) { const f = safeJoin(path.join(storageDir, bucket), p); if (f && fs.existsSync(f)) fs.rmSync(f); }
    return send(res, 200, []);
  }
  send(res, 404, { message: "not found" });
}

async function handleAuth(req, res, url, parts) {
  if (parts[0] === "token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    if (grant === "password") {
      if (body.email !== USER.email || body.password !== PASSWORD) return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials" });
    } else if (grant === "refresh_token") {
      if (!refreshes.has(body.refresh_token)) return send(res, 400, { error: "invalid_grant", error_description: "Invalid Refresh Token" });
    } else return send(res, 400, { error: "unsupported_grant_type" });
    const access = `mock-${crypto.randomBytes(8).toString("hex")}`, refresh = crypto.randomBytes(8).toString("hex");
    sessions.set(access, USER); refreshes.set(refresh, USER);
    return send(res, 200, { access_token: access, refresh_token: refresh, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: USER });
  }
  if (parts[0] === "logout") return send(res, 204);
  send(res, 404, { message: "not found" });
}

http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return send(res, 204);
    const url = new URL(req.url, "http://x");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "rest" && parts[1] === "v1") return await handleRest(req, res, url, parts[2]);
    if (parts[0] === "storage" && parts[1] === "v1") return await handleStorage(req, res, url, parts.slice(2));
    if (parts[0] === "auth" && parts[1] === "v1") return await handleAuth(req, res, url, parts.slice(2));
    if (parts[0] === "__state") return send(res, 200, db);
    send(res, 404, { message: "not found" });
  } catch (e) {
    console.error(e);
    send(res, 500, { message: String(e.message || e) });
  }
}).listen(port, () => console.log(`mock supabase on http://localhost:${port}  (admin@example.com / password123, anon-key, service-key)`));

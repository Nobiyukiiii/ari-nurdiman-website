/** Small Supabase client (Auth + PostgREST + Storage) built on fetch. No dependencies. */
const SESSION_KEY = "ari-admin-session";

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

async function toError(res) {
  let body = null;
  try { body = await res.json(); } catch { /* not json */ }
  const code = body?.code || body?.error;
  let msg = body?.message || body?.error_description || body?.msg || `Permintaan gagal (${res.status})`;
  if (code === "23505") msg = "Nilai yang harus unik sudah dipakai (misalnya slug yang sama).";
  if (code === "42501" || res.status === 401 || res.status === 403) msg = "Tidak punya izin. Pastikan Anda masuk sebagai admin.";
  if (code === "23514") msg = "Ada nilai yang tidak valid (mis. slug hanya boleh huruf kecil, angka, dan tanda hubung).";
  return new ApiError(msg, res.status, code);
}

export class Api {
  constructor({ SUPABASE_URL, SUPABASE_ANON_KEY }) {
    this.url = SUPABASE_URL.replace(/\/$/, "");
    this.anon = SUPABASE_ANON_KEY;
    try { this.session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { this.session = null; }
  }

  /* ---------- auth ---------- */
  get email() { return this.session?.user?.email || ""; }
  get userId() { return this.session?.user?.id || ""; }
  get signedIn() { return !!this.session?.access_token; }

  #store(data) {
    this.session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600), user: data.user || this.session?.user };
    localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
  }
  async #token(grant, body) {
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=${grant}`, { method: "POST", headers: { apikey: this.anon, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const e = await toError(res);
      if (grant === "password") e.message = "Email atau kata sandi salah.";
      throw e;
    }
    this.#store(await res.json());
  }
  signIn(email, password) { return this.#token("password", { email, password }); }
  async refresh() {
    if (!this.session?.refresh_token) return false;
    try { await this.#token("refresh_token", { refresh_token: this.session.refresh_token }); return true; }
    catch { this.session = null; localStorage.removeItem(SESSION_KEY); return false; }
  }
  async signOut() {
    try { if (this.signedIn) await fetch(`${this.url}/auth/v1/logout`, { method: "POST", headers: this.#headers() }); } catch { /* offline is fine */ }
    this.session = null; localStorage.removeItem(SESSION_KEY);
  }
  async isAdmin() {
    if (!this.signedIn) return false;
    const rows = await this.select("admins", `select=user_id&user_id=eq.${this.userId}`);
    return rows.length > 0;
  }

  /* ---------- transport ---------- */
  #headers(extra = {}) { return { apikey: this.anon, Authorization: `Bearer ${this.session?.access_token || this.anon}`, ...extra }; }
  async raw(path, opts = {}, retry = true) {
    if (this.session && this.session.expires_at - Date.now() / 1000 < 45) await this.refresh();
    const res = await fetch(this.url + path, { ...opts, headers: this.#headers(opts.headers) });
    if (res.status === 401 && retry && this.session?.refresh_token && (await this.refresh())) return this.raw(path, opts, false);
    return res;
  }
  async json(path, opts) {
    const res = await this.raw(path, opts);
    if (!res.ok) throw await toError(res);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  /* ---------- database ---------- */
  select(table, query = "select=*") { return this.json(`/rest/v1/${table}?${query}`); }
  async insert(table, row) {
    const out = await this.json(`/rest/v1/${table}`, { method: "POST", headers: { "content-type": "application/json", prefer: "return=representation" }, body: JSON.stringify(row) });
    return Array.isArray(out) ? out[0] : out;
  }
  async upsert(table, row, onConflict) {
    const out = await this.json(`/rest/v1/${table}?on_conflict=${onConflict}`, { method: "POST", headers: { "content-type": "application/json", prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(row) });
    return Array.isArray(out) ? out[0] : out;
  }
  async update(table, filter, patch) {
    const out = await this.json(`/rest/v1/${table}?${filter}`, { method: "PATCH", headers: { "content-type": "application/json", prefer: "return=representation" }, body: JSON.stringify(patch) });
    return Array.isArray(out) ? out[0] : out;
  }
  remove(table, filter) { return this.json(`/rest/v1/${table}?${filter}`, { method: "DELETE" }); }

  /* ---------- storage (public bucket "media") ---------- */
  #enc(p) { return p.split("/").map(encodeURIComponent).join("/"); }
  publicUrl(p) { return p ? `${this.url}/storage/v1/object/public/media/${this.#enc(p)}` : ""; }
  async upload(p, blob) {
    const res = await this.raw(`/storage/v1/object/media/${this.#enc(p)}`, { method: "POST", headers: { "content-type": blob.type || "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000" }, body: blob });
    if (!res.ok) throw await toError(res);
    return p;
  }
  async removeFiles(paths) {
    if (!paths.length) return;
    const res = await this.raw("/storage/v1/object/media", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ prefixes: paths }) });
    if (!res.ok) throw await toError(res);
  }
  /** Lists every file in the bucket (walks folders). */
  async listAllFiles(prefix = "") {
    const out = [];
    const res = await this.json("/storage/v1/object/list/media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }) });
    for (const item of res || []) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null || item.id === undefined) out.push(...(await this.listAllFiles(full)));
      else out.push(full);
    }
    return out;
  }
}

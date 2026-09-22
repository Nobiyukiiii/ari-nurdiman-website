/** Sync state between the database (what the admin edits) and the live website (what visitors see). */

async function sha16(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
const cmp = (a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);

/** Must produce exactly what site/scripts/lib/supabase.mjs `contentVersion` produces at build time. */
export async function dbVersion(api) {
  const q = "select=id,updated_at&status=eq.published";
  const [settings, releases, photos, videos, news, uiText] = await Promise.all([
    api.select("site_settings", "select=id,updated_at&id=eq.1"),
    api.select("releases", q), api.select("photos", q), api.select("videos", q), api.select("news", q),
    api.select("ui_text", "select=key,updated_at"),
  ]);
  const lines = [];
  for (const [table, rows] of [["settings", settings], ["releases", releases], ["photos", photos], ["videos", videos], ["news", news], ["ui_text", uiText.map((r) => ({ id: r.key, updated_at: r.updated_at }))]]) {
    for (const r of [...rows].sort(cmp)) lines.push(`${table}:${r.id}:${r.updated_at}`);
  }
  return sha16(lines.join("\n"));
}

export async function siteVersion(siteUrl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000); // an unreachable site must not leave the badge on "checking" forever
  try {
    const res = await fetch(`${siteUrl.replace(/\/$/, "")}/version.json?t=${Date.now()}`, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "timeout" : e.message);
  } finally { clearTimeout(timer); }
}

/** @returns {{state: 'synced'|'pending'|'unknown'|'nosite', db?: string, site?: object, error?: string}} */
export async function getSyncState(api, siteUrl) {
  const db = await dbVersion(api);
  if (!siteUrl) return { state: "nosite", db };
  try {
    const site = await siteVersion(siteUrl);
    return { state: site.contentVersion === db ? "synced" : "pending", db, site };
  } catch (e) {
    return { state: "unknown", db, error: e.message };
  }
}

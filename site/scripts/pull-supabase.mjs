#!/usr/bin/env node
/**
 * Pulls PUBLISHED content from Supabase into content/*.json and downloads every
 * image into public/assets/, so the built website never hot-links Supabase.
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/pull-supabase.mjs
 *
 * Uses only the public (anon) key: the database policies expose published rows only.
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, client, contentVersion, loadEnv } from "./lib/supabase.mjs";

loadEnv();
const force = process.argv.includes("--force");
const sb = client(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "content", f), "utf8"));
const writeJson = (f, d) => fs.writeFileSync(path.join(ROOT, "content", f), JSON.stringify(d, null, 2) + "\n");
const nn = (v) => (v === null || v === undefined || v === "" ? undefined : v); // omit empty values

function deepMerge(base, over) {
  if (Array.isArray(over) || over === null || typeof over !== "object") return over === undefined ? base : over;
  const out = { ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}) };
  for (const [k, v] of Object.entries(over)) out[k] = deepMerge(out[k], v);
  return out;
}

const order = "order=sort.asc,created_at.asc";
const [settingsRows, releases, photos, videos, news, uiRows] = await Promise.all([
  sb.select("site_settings", "select=*&id=eq.1"),
  sb.select("releases", `select=*&status=eq.published&${order}`),
  sb.select("photos", `select=*&status=eq.published&${order}`),
  sb.select("videos", `select=*&status=eq.published&${order}`),
  sb.select("news", `select=*&status=eq.published&order=date.desc.nullslast,created_at.desc`),
  sb.select("ui_text", "select=key,value,updated_at"),
]);
if (!settingsRows.length) throw new Error("site_settings is empty. Run `npm run seed` once, or save the settings in the admin panel.");

/* ---- ui text overrides: dot-path keys (e.g. "nav.music") merged over content/ui.json ---- */
const ui = readJson("ui.json");
for (const row of uiRows) {
  if (row.value === null || row.value === undefined || row.value === "") continue; // empty = keep built-in default
  const keys = row.key.split(".");
  let cur = ui;
  keys.slice(0, -1).forEach((k) => { if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {}; cur = cur[k]; });
  cur[keys[keys.length - 1]] = row.value;
}

/* ---- map database rows to the JSON shapes build.mjs expects ---- */
const site = deepMerge(readJson("site.json"), settingsRows[0].data);
const artistName = site.name || "Ari Nurdiman";

const releasesJson = releases.map((r) => ({
  slug: r.slug,
  title: r.title,
  artist: artistName,
  year: r.year,
  releaseType: r.release_type,
  ...(nn(r.release_date) ? { releaseDate: r.release_date } : {}),
  ...(nn(r.duration) ? { duration: r.duration } : {}),
  ...(r.duration_seconds ? { durationSeconds: r.duration_seconds } : {}),
  cover: { file: r.cover_path || "", alt: r.cover_alt || `Cover artwork “${r.title}” oleh ${artistName}` },
  ...(nn(r.description) ? { description: { lang: r.description_lang || "id", paragraphs: r.description.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) } } : {}),
  spotifyTrackId: nn(r.spotify_track_id) ?? null,
  youtubeVideoId: nn(r.youtube_video_id) ?? null,
  lyricsUrl: nn(r.lyrics_url) ?? null,
  credits: r.credits || [],
  relatedLinks: r.related_links || [],
  tracks: r.tracks || [],
}));
const photosJson = photos.map((p) => ({ file: p.path, alt: p.alt || "", caption: p.caption || "", ...(p.width ? { width: p.width } : {}), ...(p.height ? { height: p.height } : {}) }));
const videosJson = videos.map((v) => ({ title: v.title, youtubeId: v.youtube_id, ...(nn(v.thumb_path) ? { thumb: v.thumb_path } : {}) }));
const newsJson = news.map((n) => ({ title: n.title, ...(nn(n.date) ? { date: n.date } : {}), ...(nn(n.excerpt) ? { excerpt: n.excerpt } : {}), ...(nn(n.url) ? { url: n.url } : {}), ...(nn(n.image_path) ? { image: n.image_path, imageAlt: n.image_alt || "" } : {}) }));

/* ---- images: download into public/assets, prune what is no longer referenced ---- */
const wanted = new Set();
const add = (p) => { if (p) wanted.add(p); };
add(site.artist?.photo?.file);
add(site.sections?.finalCorners?.image?.file);
releasesJson.forEach((r) => add(r.cover.file));
photosJson.forEach((p) => add(p.file));
videosJson.forEach((v) => add(v.thumb));
newsJson.forEach((n) => add(n.image));

const assets = path.join(ROOT, "public", "assets");
const manifestFile = path.join(assets, ".synced.json");
const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : [];
let failed = 0, downloaded = 0;
for (const p of wanted) {
  if (p.includes("..") || p.startsWith("/")) { console.error(`skip unsafe path ${p}`); failed++; continue; }
  const dest = path.join(assets, p);
  if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
  try {
    const res = await fetch(sb.publicUrl(p));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!(res.headers.get("content-type") || "").startsWith("image/")) throw new Error(`not an image (${res.headers.get("content-type")})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) throw new Error("file too small");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    downloaded++;
  } catch (e) {
    failed++;
    console.error(`FAILED image ${p}: ${e.message}`);
  }
}
for (const p of previous) {
  if (!wanted.has(p)) { try { fs.rmSync(path.join(assets, p)); } catch { /* already gone */ } }
}
fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(manifestFile, JSON.stringify([...wanted].sort(), null, 2));

/* ---- write content ---- */
writeJson("site.json", site);
writeJson("ui.json", ui);
writeJson("releases.json", releasesJson);
writeJson("gallery.json", photosJson);
writeJson("videos.json", videosJson);
writeJson("news.json", newsJson);
const version = contentVersion([["settings", settingsRows], ["releases", releases], ["photos", photos], ["videos", videos], ["news", news], ["ui_text", uiRows.map((r) => ({ id: r.key, updated_at: r.updated_at }))]]);
writeJson("_meta.json", { source: "supabase", contentVersion: version, pulledAt: new Date().toISOString() });

console.log(`Pulled from Supabase: ${releases.length} releases, ${photos.length} photos, ${videos.length} videos, ${news.length} news; ${downloaded} image(s) downloaded, ${wanted.size} referenced. Version ${version}`);
if (failed && !process.argv.includes("--lenient")) {
  console.error(`${failed} image(s) failed. Aborting so a broken site is not deployed (use --lenient to continue).`);
  process.exit(1);
}

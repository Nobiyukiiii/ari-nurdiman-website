#!/usr/bin/env node
/**
 * One-time (idempotent) upload of the current local content to Supabase, so the
 * admin panel starts with exactly what the website shows today.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-supabase.mjs
 *
 * Needs the SERVICE ROLE key (bypasses RLS). Keep it on your computer only.
 * Run `npm run assets` first so the local images exist and can be uploaded.
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, client, loadEnv } from "./lib/supabase.mjs";

loadEnv();
const sb = client(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "content", f), "utf8"));
const local = (p) => path.join(ROOT, "public", "assets", p);
const mime = (p) => ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[path.extname(p).toLowerCase()] || "application/octet-stream");

/** Uploads a local image; returns its storage path, or null when the file does not exist yet. */
async function uploadIfPresent(p) {
  if (!p) return null;
  if (!fs.existsSync(local(p))) { console.warn(`  missing local image, skipped: public/assets/${p}`); return null; }
  await sb.upload(p, fs.readFileSync(local(p)), mime(p));
  console.log(`  uploaded ${p}`);
  return p;
}

function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = String(v);
  }
  return out;
}

console.log("UI text");
const existingUi = await sb.select("ui_text", "select=key&limit=1");
if (existingUi.length) console.log("  ui_text: already has data, skipped");
else {
  const flat = flatten(readJson("ui.json"));
  await sb.insert("ui_text", Object.entries(flat).map(([key, value]) => ({ key, value })));
  console.log(`  seeded ${Object.keys(flat).length} keys`);
}

const site = readJson("site.json");
console.log("Settings");
site.artist.photo.file = (await uploadIfPresent(site.artist.photo.file)) || "";
await sb.upsert("site_settings", [{ id: 1, data: site }], "id");

console.log("Releases");
const releases = readJson("releases.json");
const rows = [];
for (const [i, r] of releases.entries()) {
  const cover = await uploadIfPresent(r.cover?.file);
  rows.push({
    slug: r.slug,
    title: r.title,
    release_type: String(r.releaseType || "single").toLowerCase(),
    year: r.year,
    release_date: r.releaseDate || null,
    duration: r.duration || null,
    duration_seconds: r.durationSeconds || null,
    cover_path: cover,
    cover_alt: r.cover?.alt || null,
    description: r.description?.paragraphs?.join("\n\n") || null,
    description_lang: r.description?.lang || "id",
    spotify_track_id: r.spotifyTrackId || null,
    youtube_video_id: r.youtubeVideoId || null,
    lyrics_url: r.lyricsUrl || null,
    credits: r.credits || [],
    related_links: r.relatedLinks || [],
    tracks: r.tracks || [],
    sort: (i + 1) * 10,
    status: "published",
  });
}
if (rows.length) await sb.upsert("releases", rows, "slug");

async function seedIfEmpty(table, items, map) {
  if (!items.length) return;
  const existing = await sb.select(table, "select=id&limit=1");
  if (existing.length) { console.log(`${table}: already has data, skipped`); return; }
  console.log(table);
  const out = [];
  for (const [i, it] of items.entries()) out.push({ ...(await map(it)), sort: (i + 1) * 10, status: "published" });
  await sb.insert(table, out);
}
await seedIfEmpty("photos", readJson("gallery.json"), async (g) => ({ path: (await uploadIfPresent(g.file)) || g.file, alt: g.alt || null, caption: g.caption || null, width: g.width || null, height: g.height || null }));
await seedIfEmpty("videos", readJson("videos.json"), async (v) => ({ title: v.title, youtube_id: v.youtubeId, thumb_path: await uploadIfPresent(v.thumb) }));
await seedIfEmpty("news", readJson("news.json"), async (n) => ({ title: n.title, date: n.date || null, excerpt: n.excerpt || null, url: n.url || null, image_path: await uploadIfPresent(n.image), image_alt: n.imageAlt || null }));

console.log("\nDone. Next: create your admin user in Supabase (Auth > Users) and add it to public.admins (see supabase/schema.sql).");

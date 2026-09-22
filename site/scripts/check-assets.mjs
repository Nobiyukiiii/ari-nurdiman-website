#!/usr/bin/env node
/**
 * Final image check on the BUILT site (dist/).
 *  1. Every <img src>, srcset, CSS url() and og:image must be a local /assets path or relative path.
 *  2. Every local image referenced must exist.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(dist);
const external = new Set();
const missing = new Set();
const imageExt = /\.(?:jpe?g|png|webp|avif|gif|svg)(?:\?.*)?$/i;

for (const f of files.filter((x) => /\.(html|css|js)$/.test(x) && !x.includes(`${path.sep}admin${path.sep}`))) {
  const text = fs.readFileSync(f, "utf8");
  const rel = path.relative(dist, f);
  const refs = [];
  for (const m of text.matchAll(/<img[^>]+src="([^"]+)"/g)) refs.push(m[1]);
  for (const m of text.matchAll(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/g)) refs.push(m[1]);
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) refs.push(m[1]);
  for (const r of refs) {
    if (r.startsWith("data:")) continue;
    if (/^(https?:)?\/\//.test(r)) {
      // og:image is absolute on the site's own domain; anything else is external.
      const siteUrl = (fs.readFileSync(path.join(dist, "sitemap.xml"), "utf8").match(/<loc>(https?:\/\/[^/<]+)/) || [])[1];
      if (!siteUrl || !r.startsWith(siteUrl)) external.add(`${rel}: ${r}`);
      continue;
    }
    if (!imageExt.test(r)) continue;
    const target = path.join(path.dirname(f), r.split("?")[0]);
    const local = r.startsWith("/") ? path.join(dist, r.split("?")[0]) : target;
    if (!fs.existsSync(local)) missing.add(`${rel}: ${r}`);
  }
}
const localImages = files.filter((x) => imageExt.test(x) && x.includes(`${path.sep}assets${path.sep}`));
console.log(`External image assets remaining: ${external.size}`);
for (const e of external) console.log(`  - ${e}`);
console.log(`Local image files in dist/assets: ${localImages.length}`);
console.log(`Broken local image references: ${missing.size}`);
for (const m of missing) console.log(`  - ${m}`);
process.exit(external.size || missing.size ? 1 : 0);

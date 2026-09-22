#!/usr/bin/env node
/**
 * One-time (development) step: downloads every image listed in
 * scripts/assets.manifest.json into public/assets/ so the site never
 * hot-links an external image CDN.
 *
 *   npm run assets            download missing files
 *   npm run assets -- --force re-download everything
 *
 * The website itself only ever references /assets/... paths.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const force = process.argv.includes("--force");
const manifest = JSON.parse(await readFile(resolve(root, "scripts/assets.manifest.json"), "utf8"));

const isJpeg = (b) => b[0] === 0xff && b[1] === 0xd8;
const isPng = (b) => b[0] === 0x89 && b[1] === 0x50;
const isWebp = (b) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP";

let failed = 0;
for (const item of manifest) {
  const target = resolve(root, item.file);
  const exists = await stat(target).then((s) => s.size > 0, () => false);
  if (exists && !force) {
    console.log(`skip     ${item.file} (already present)`);
    continue;
  }
  try {
    const res = await fetch(item.url, { headers: { "user-agent": "Mozilla/5.0 (asset-localizer)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 4096) throw new Error(`file too small (${buf.length} bytes)`);
    if (!(isJpeg(buf) || isPng(buf) || isWebp(buf))) throw new Error("response is not a JPEG/PNG/WebP image");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buf);
    console.log(`ok       ${item.file} (${Math.round(buf.length / 1024)} KB)`);
  } catch (err) {
    failed += 1;
    console.error(`FAILED   ${item.file}: ${err.message}\n         ${item.url}`);
  }
}

console.log(failed ? `\n${failed} download(s) failed.` : "\nAll assets are local.");
process.exit(failed ? 1 : 0);

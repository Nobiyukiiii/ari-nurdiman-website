# Ari Nurdiman, official website (static HTML)

Plain HTML, CSS and vanilla JavaScript. No framework, no runtime dependencies, no database.
Content lives in `content/*.json`; `node build.mjs` turns it into ready-to-host pages in `dist/`.

```bash
npm run dev      # build + local server on http://localhost:3000, rebuilds on every change
npm run build    # writes dist/  (upload dist/ to any static host)
npm run assets   # downloads the images in scripts/assets.manifest.json into public/assets/
npm run check    # build + confirms "External image assets remaining: 0" and no broken images
```

Requires Node 18+. `dist/` also opens by double-click (all links are relative).

## Supabase sync (used with the admin panel)

```bash
npm run pull          # published content + images from Supabase -> content/*.json and public/assets/
npm run build:remote  # pull + build (this is the command the host runs)
npm run seed          # one-time: upload the current local content and images to Supabase
```
Credentials go in `.env` (see `.env.example`). Without Supabase, `npm run build` uses `content/*.json` as before. Every build writes `dist/version.json`; the admin panel compares it with the database to show the sync status.

## Before launch

1. `npm run assets` (needs internet access to the original image hosts) so every image is local.
2. Set `siteUrl` in `content/site.json` (canonical URLs, Open Graph, sitemap).
3. Add verified Instagram / TikTok / YouTube URLs, contact email and Final Corners details when available (see `content/README.md`).
4. Confirm image rights; licenses are unknown (see `data/sources.md`).

## Structure

```
content/   all editable text and data (JSON)         <- the admin panel edits this
public/assets/{artist,releases,gallery}/             <- images the admin panel uploads
src/       css, js, fonts (self-hosted)
build.mjs  generator (pages, sitemap, robots, JSON-LD)
scripts/   dev server, asset downloader, final image check
data/      sources.md (research + attribution, development only)
dist/      generated output
```

## Interactions

Handwriting reveal of the signature, torn-paper edges, scroll reveals, hero mouse depth and parallax, 3D tilt cards, magnetic buttons, draggable release rail, sliding vinyl on song pages, marquee, custom cursor, paper-wipe page transitions, scroll progress, video/photo lightbox. All animation is off under `prefers-reduced-motion`; touch devices skip cursor, tilt and magnetic effects.

## Adding an admin panel later

Any tool that edits `content/*.json` and uploads images to `public/assets/` works: Decap CMS, Sveltia CMS, a small Node/PHP form, or Cloudflare Pages + a Git commit. After a change, run `node build.mjs` and deploy `dist/`.

#!/usr/bin/env node
/**
 * Static site generator for ariNurdiman.
 * Reads content/*.json, writes plain HTML/CSS/JS to dist/. No dependencies.
 *
 *   node build.mjs
 *
 * Everything the visitor reads lives in content/. An admin panel only has to
 * edit those JSON files (and drop images in public/assets/), then run the build.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "content", f), "utf8"));

const site = readJson("site.json");
const ui = readJson("ui.json");
const releasesRaw = readJson("releases.json");
const videosRaw = readJson("videos.json");
const galleryRaw = readJson("gallery.json");
const newsRaw = readJson("news.json");

const warnings = [];
const warn = (m) => warnings.push(m);
const exists = (file) => !!file && fs.existsSync(path.join(ROOT, "public", "assets", file));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const json = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const SITE_URL = String(site.siteUrl || "").replace(/\/$/, "");

/* ------------------------------------------------------------------ data */
const releases = releasesRaw; // JSON order = previous/next order
for (const r of releases) if (!r.slug || !r.title) throw new Error("Every release needs slug and title");
const sortedReleases = [...releases].sort((a, b) => {
  if (a.releaseDate && b.releaseDate) return b.releaseDate.localeCompare(a.releaseDate);
  if (a.releaseDate) return -1;
  if (b.releaseDate) return 1;
  return 0;
});
const latest = sortedReleases[0];
const S = site.sections;
const has = {
  videos: !!S.videos.enabled && videosRaw.length > 0,
  gallery: !!S.gallery.enabled && galleryRaw.some((g) => exists(g.file)),
  news: !!S.news.enabled && newsRaw.length > 0,
  fc: !!S.finalCorners.enabled && !!S.finalCorners.name && !!S.finalCorners.summary,
};
const photo = site.artist.photo;
const hasPhoto = exists(photo.file);
if (!hasPhoto) warn(`Missing artist photo: public/assets/${photo.file} (hero shows release artwork only)`);
for (const r of releases) if (!exists(r.cover.file)) warn(`Missing cover: public/assets/${r.cover.file} (typographic fallback used)`);
for (const g of galleryRaw) if (S.gallery.enabled && !exists(g.file)) warn(`Missing gallery image: public/assets/${g.file} (skipped)`);

const socials = Object.entries(site.socials).filter(([k, v]) => k !== "" && v).map(([k, v]) => ({ key: k, url: v, label: k === "youtube" ? "YouTube" : k === "tiktok" ? "TikTok" : k[0].toUpperCase() + k.slice(1) }));
const spotify = site.socials.spotify;

/* ----------------------------------------------------------------- icons */
const ICON = {
  spotify: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21zm4.8 15.150a.65.65 0 0 1-.9.2c-2.450-1.500-5.500-1.800-9.100-1a.65.65 0 1 1-.3-1.270c3.900-.9 7.300-.5 10.100 1.150.3.200.4.600.2.900zm1.300-2.800a.8.8 0 0 1-1.100.3c-2.800-1.700-7.100-2.200-10.400-1.200a.8.8 0 1 1-.5-1.500c3.800-1.100 8.500-.6 11.700 1.400.4.200.5.700.3 1zm.1-2.900c-3.400-2-9-2.200-12.200-1.200a1 1 0 1 1-.6-1.900c3.700-1.100 9.900-.9 13.800 1.400a1 1 0 0 1-1 1.700z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.200a3 3 0 0 0-2.100-2.100C19 4.600 12 4.600 12 4.600s-7 0-8.900.5A3 3 0 0 0 1 7.200 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.800a3 3 0 0 0 2.100 2.100c1.900.5 8.900.5 8.900.5s7 0 8.900-.5a3 3 0 0 0 2.100-2.100 31 31 0 0 0 .5-4.800 31 31 0 0 0-.5-4.800zM9.700 15V9l5.800 3z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.200c3.200 0 3.600 0 4.800.1 3.300.1 4.800 1.700 4.900 4.900.1 1.300.1 1.600.1 4.800s0 3.600-.1 4.800c-.1 3.200-1.700 4.800-4.900 4.900-1.300.1-1.600.1-4.800.1s-3.600 0-4.800-.1c-3.300-.1-4.800-1.700-4.900-4.900-.1-1.300-.1-1.600-.1-4.800s0-3.600.1-4.800C2.400 3.900 4 2.400 7.200 2.300 8.400 2.200 8.800 2.200 12 2.200zM12 0C8.700 0 8.300 0 7.100.1 2.700.3.300 2.700.1 7.100 0 8.300 0 8.700 0 12s0 3.700.1 4.900c.2 4.400 2.600 6.800 7 7 1.200.1 1.600.1 4.900.1s3.700 0 4.900-.1c4.400-.2 6.800-2.600 7-7 .1-1.200.1-1.600.1-4.900s0-3.700-.1-4.900c-.2-4.400-2.600-6.800-7-7C15.700 0 15.300 0 12 0zm0 5.800a6.200 6.200 0 1 0 0 12.400 6.200 6.200 0 0 0 0-12.400zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.400-11.800a1.400 1.400 0 1 0 0 2.900 1.400 1.400 0 0 0 0-2.900z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.600 5.800A4.300 4.300 0 0 1 15.500 3h-3.100v12.400a2.600 2.600 0 1 1-2.600-2.600c.3 0 .5 0 .8.100V9.700a5.800 5.800 0 1 0 5 5.700V9a7.400 7.400 0 0 0 4.300 1.400V7.300a4.300 4.300 0 0 1-3.300-1.500z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l14 8-14 8z"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4M10 6l-6 6 6 6"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>',
};
const socialIcon = (s) => ICON[s.key] || "";

/* --------------------------------------------------------------- helpers */
const fmtDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
const typeLabel = (r) => ui.types?.[String(r.releaseType).toLowerCase()] || r.releaseType;
const line = (r) => `${typeLabel(r)} · ${r.year}`;
const fill = (s) => String(s || "").replace("{latest}", latest ? latest.title : "");
const ROT = ["-1.5deg", "1.3deg", "-0.8deg", "1.7deg", "-1.1deg", "0.9deg"];

function img(base, asset, { alt = "", title = "", loading = "lazy", priority = false } = {}) {
  if (!asset || !exists(asset.file)) return `<div class="cover-fallback"><span>${esc(title)}</span></div>`;
  return `<img src="${base}assets/${asset.file}" alt="${esc(alt)}" width="${asset.width || 500}" height="${asset.height || 500}" ${priority ? 'fetchpriority="high"' : `loading="${loading}"`} decoding="async" data-title="${esc(title)}">`;
}
const coverImg = (base, r, opts = {}) => img(base, r.cover, { alt: r.cover.alt || `Cover ${r.title}`, title: r.title, ...opts });
const ext = (url, cls, inner, extra = "") => `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" ${extra}>${inner}<span class="sr-only"> ${esc(ui.opensNewTab)}</span></a>`;
const tape = (style) => `<span class="tape" style="${style}" aria-hidden="true"></span>`;
const doodleArrow = (style) => `<svg class="doodle" style="${style}" viewBox="0 0 90 60" width="90" height="60" aria-hidden="true"><path d="M4 8c22-2 48 6 62 30 3 5 6 10 8 14M56 46l18 6 4-19"/></svg>`;

/* ------------------------------------------------------------ navigation */
const navItems = [
  { key: "home", label: ui.nav.home, href: "" },
  { key: "music", label: ui.nav.music, href: "music/" },
  ...(has.videos ? [{ key: "videos", label: ui.nav.videos, href: "videos/" }] : []),
  { key: "about", label: ui.nav.about, href: "about/" },
  ...(has.gallery ? [{ key: "gallery", label: ui.nav.gallery, href: "gallery/" }] : []),
  ...(has.news ? [{ key: "news", label: ui.nav.news, href: "news/" }] : []),
  ...(has.fc ? [{ key: "finalCorners", label: ui.nav.finalCorners, href: "about/#final-corners" }] : []),
  { key: "contact", label: ui.nav.contact, href: "contact/" },
];

function header(ctx) {
  const links = navItems.map((n) => `<a href="${ctx.base}${n.href}"${ctx.key === n.key ? ' aria-current="page"' : ""}>${esc(n.label)}</a>`).join("");
  const icons = socials.map((s) => ext(s.url, "icon-link", socialIcon(s), `aria-label="${esc(s.label)}"`)).join("");
  return `
<header class="nav" data-nav>
  <div class="nav__row">
    <a class="logo" href="${ctx.base}" aria-label="${esc(site.name)}, ${esc(ui.officialWebsite)}">${esc(site.name)}</a>
    <nav class="nav__links" aria-label="Primary">${links}</nav>
    <div class="nav__social">${icons}</div>
    <button class="burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="${esc(ui.menuOpen)}" data-open-label="${esc(ui.menuOpen)}" data-close-label="${esc(ui.menuClose)}"><span></span><span></span></button>
  </div>
</header>
<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menu">
  <nav aria-label="Mobile">${links}</nav>
  <div class="menu__social">${icons}</div>
</div>`;
}

function footer(ctx) {
  const links = navItems.filter((n) => n.key !== "home").map((n) => `<a href="${ctx.base}${n.href}">${esc(n.label)}</a>`).join("");
  const icons = socials.map((s) => ext(s.url, "icon-link", socialIcon(s), `aria-label="${esc(s.label)}"`)).join("");
  return `
<footer class="footer">
  <div class="footer__row">
    <div><a class="logo" href="${ctx.base}">${esc(site.name)}</a><p class="footer__copy">${esc(ui.officialWebsite)}</p></div>
    <nav class="footer__links" aria-label="Footer">${links}</nav>
    <div class="footer__social">${icons}</div>
  </div>
  <div class="footer__bottom"><p>&copy; ${esc(site.copyrightYear || new Date().getFullYear())} ${esc(site.name)}</p><a href="${ctx.base}credits/">${esc(ui.credits)}</a></div>
</footer>`;
}

/* ----------------------------------------------------------------- shell */
function assetsVersion(file) {
  return crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT, "src", file))).digest("hex").slice(0, 8);
}
const V = { css: assetsVersion("css/style.css"), js: assetsVersion("js/site.js") };

function page({ base, key, path: p, title, description, body, image, ogType = "website", jsonLd, noindex = false, bodyClass = "" }) {
  const fullTitle = title ? `${title} | ${site.name}` : site.seo.title;
  const desc = description || site.seo.description;
  const canonical = SITE_URL ? `${SITE_URL}/${p}` : "";
  const ogImage = image && SITE_URL ? `${SITE_URL}/assets/${image}` : "";
  const ctx = { base, key };
  return `<!doctype html>
<html lang="${esc(site.lang)}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex, follow">' : ""}
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta name="theme-color" content="#0d0c0b">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ""}
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(desc)}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ""}
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%230d0c0b'/%3E%3Ctext x='32' y='44' font-size='34' text-anchor='middle' fill='%23c8a56a' font-family='Georgia,serif' font-style='italic'%3EAN%3C/text%3E%3C/svg%3E">
<link rel="preload" href="${base}assets/fonts/mrs-saint-delafield-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${base}assets/fonts/cormorant-garamond-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}assets/css/style.css?v=${V.css}">
<script>document.documentElement.className="js";try{if(sessionStorage.getItem("wipe")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.classList.add("wipe-in");setTimeout(function(){document.documentElement.classList.remove("wipe-in")},2500)}sessionStorage.removeItem("wipe")}catch(e){}</script>
${jsonLd ? `<script type="application/ld+json">${json(jsonLd)}</script>` : ""}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
<a class="skip" href="#main">${esc(ui.skip)}</a>
<div class="progress" aria-hidden="true"></div>
<div class="cursor" aria-hidden="true"><div class="cursor__ring"></div><span class="cursor__label"></span></div>
<div class="wipe" aria-hidden="true"></div>
${header(ctx)}
<main id="main">
${body}
</main>
${footer(ctx)}
${has.videos || has.gallery ? `<dialog class="lightbox" aria-label="Preview"><div class="lightbox__inner"><button class="lightbox__close" type="button">${esc(ui.close)}</button><div class="stage"></div></div></dialog>` : ""}
<script src="${base}assets/js/site.js?v=${V.js}" defer></script>
</body>
</html>
`;
}

/* -------------------------------------------------------------- sections */
function tornWrap(inner, { id = "", tear = "top bottom", pull = "both" } = {}) {
  const cls = `tear-shadow${pull === "both" || pull === "up" ? " torn--pull-up" : ""}${pull === "both" || pull === "down" ? " torn--pull-down" : ""}`;
  return `<div class="${cls}"><section class="torn on-paper"${id ? ` id="${id}"` : ""} data-tear="${tear}"><div class="torn__paper"></div><div class="torn__inner"><div class="section">${inner}</div></div></section></div>`;
}

function hero(base) {
  const prints = sortedReleases.slice(0, 4).map((r, i) => `
      <a class="print" href="${base}music/${r.slug}/" data-reveal="drop" data-cursor="${esc(ui.view)}" style="--d:${(1.1 + i * 0.18).toFixed(2)}s" aria-label="${esc(r.title)}">
        ${tape(`left:50%;top:-0.7rem;margin-left:-2.6rem;--r:${i % 2 ? 5 : -6}deg`)}${coverImg(base, r, { loading: "eager" })}
      </a>`).join("");
  const iconRow = socials.length > 1 ? `<div class="hero__social">${socials.map((s) => ext(s.url, "icon-link", socialIcon(s), `aria-label="${esc(s.label)}"`)).join("")}</div>` : "";
  return `
<section class="hero${hasPhoto ? " has-photo" : ""}" aria-label="${esc(site.name)}">
  ${hasPhoto ? `<div class="hero__photo" data-parallax="0.1" data-depth="14">${img(base, photo, { alt: photo.alt, title: site.name, priority: true })}</div>` : ""}
  <div class="hero__shade"></div>
  <svg class="hero__flora" data-depth="9" viewBox="0 0 120 260" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true"><path d="M60 260C58 200 52 150 40 90"/><path d="M60 260C64 190 78 140 96 70"/><path d="M52 210c-14-6-24-18-26-34M55 172c12-8 18-20 20-34M70 190c14-8 22-20 24-36M42 100c-8-12-6-26 2-36M94 76c4-14 0-24-8-32"/><circle cx="46" cy="56" r="3.5"/><circle cx="86" cy="38" r="3"/><circle cx="26" cy="172" r="2.5"/><circle cx="95" cy="150" r="2.5"/></svg>
  <div class="hero__prints" data-depth="26">${prints}</div>
  <div class="hero__inner">
    <p class="eyebrow" data-reveal="fade" style="--d:.1s">${esc(site.hero.eyebrow)}</p>
    <h1 class="hero__name signature" aria-label="${esc(site.name)}"><span data-write aria-hidden="true" style="--d:.3s;--write:2.4s">${esc(site.name)}</span></h1>
    <p class="hero__tagline" data-reveal="up" style="--d:1.2s">${esc(site.hero.tagline)}</p>
    <div class="hero__actions" data-reveal="up" style="--d:1.45s">
      <a class="btn btn--paper" href="${base}music/" data-magnetic>${esc(site.hero.secondaryCta)}</a>
      ${ext(spotify, "btn btn--ghost", `${ICON.play}${esc(site.hero.primaryCta)}`, "data-magnetic")}
      ${iconRow}
    </div>
  </div>
  <span class="hero__scroll eyebrow" aria-hidden="true">${esc(ui.scrollHint)}</span>
</section>`;
}

function releaseCard(base, r, i) {
  return `<a class="card" role="listitem" href="${base}music/${r.slug}/" data-tilt data-cursor="${esc(ui.view)}">
      <div class="card__cover" style="--r:${ROT[i % ROT.length]}">${coverImg(base, r)}<span class="glare"></span><span class="card__play" aria-hidden="true">${ICON.play}</span></div>
      <h3>${esc(r.title)}</h3><p>${esc(line(r))}</p>
    </a>`;
}

function releasesSection(base) {
  const s = S.releases;
  const cards = sortedReleases.map((r, i) => releaseCard(base, r, i)).join("");
  const note = fill(s.note);
  return tornWrap(`
    <div class="wrap releases">
      <div class="releases__intro">
        ${tape("left:-1.5rem;top:-2.2rem;--r:-16deg")}
        <p class="eyebrow" data-reveal="fade">${esc(s.eyebrow)}</p>
        <h2 class="h-display h-2" data-reveal="up">${esc(s.title)}</h2>
        <p class="lead" data-reveal="up" style="--d:.1s">${esc(s.text)}</p>
        ${ext(spotify, "btn btn--solid", `${esc(s.cta)}${ICON.right.replace("<svg", '<svg style="fill:none;stroke:currentColor;stroke-width:1.6"')}`, "data-magnetic")}
        ${note ? `<span class="hand releases__note" style="--r:-5deg;--d:.4s" data-reveal="fade">${esc(note)}${doodleArrow("right:-4.2rem;top:-0.4rem;width:5rem;height:auto;transform:rotate(-8deg)")}</span>` : ""}
      </div>
      <div class="releases__rail" data-rail>
        <div class="rail" role="list" data-stagger="110" data-stagger-kind="drop">${cards}</div>
        <button class="rail__next" type="button" aria-label="${esc(ui.next)}">${ICON.right}</button>
        <div class="rail__bar" aria-hidden="true"><span></span></div>
      </div>
    </div>`, { id: "music" });
}

function aboutSection(base, { full = false } = {}) {
  const s = S.about;
  const paras = (full ? site.sections.about.bio : site.sections.about.bio.slice(0, 2)).map((p, i) => `<p data-reveal="up" style="--d:${0.1 * i}s">${esc(p)}</p>`).join("");
  const note = s.note ? `<span class="hand about__note" style="--r:-7deg" data-reveal="fade">${esc(s.note)}</span>` : "";
  const photoBlock = hasPhoto
    ? `<div class="about__photo" data-reveal="left">${tape("left:8%;top:-0.8rem;--r:-8deg")}<div class="frame" data-cursor="${esc(ui.artistPhotoCursor)}">${img(base, photo, { alt: photo.alt, title: site.name })}</div>${note}</div>`
    : "";
  return `
<section class="section section--dark" id="about">
  <div class="wrap about${hasPhoto ? "" : " no-photo"}">
    ${photoBlock}
    <div class="about__body">
      ${full ? "" : `<p class="eyebrow" data-reveal="fade">${esc(s.eyebrow)}</p>`}
      <h2 class="h-display h-2" data-reveal="up">${esc(s.title)}</h2>
      ${paras}
      ${full ? "" : `<a class="btn-arrow" href="${base}about/">${esc(s.cta)}${ICON.right}</a>`}
      ${hasPhoto ? "" : note}
    </div>
  </div>
</section>`;
}

function listenSection() {
  const s = S.listen;
  const t = sortedReleases.map((r) => `<span>${esc(r.title)}</span>`).join("");
  return `
<section class="section section--dark" id="listen" aria-labelledby="listen-title">
  <div class="wrap">
    <div class="marquee" aria-hidden="true"><div class="marquee__track">${t}${t}${t}${t}</div></div>
    <div class="listen">
      <div class="listen__text">
        <p class="eyebrow" data-reveal="fade">${esc(s.eyebrow)}</p>
        <h2 class="h-display h-2" id="listen-title" data-reveal="up" style="margin-top:1rem">${esc(s.title)}</h2>
        <p data-reveal="up" style="--d:.1s">${esc(s.text)}</p>
        ${ext(spotify, "btn btn--paper", `${ICON.play}${esc(ui.listenSpotify)}`, "data-magnetic")}
      </div>
      <div class="listen__player" data-reveal="zoom">
        ${tape("left:50%;top:-0.8rem;margin-left:-2.6rem;--r:-3deg")}
        <iframe title="${esc(ui.spotifyPlayerTitle)}" src="https://open.spotify.com/embed/artist/${esc(site.spotifyArtistId)}?utm_source=generator&theme=0" height="352" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>
      </div>
    </div>
  </div>
</section>`;
}

function videoItems(base) {
  return videosRaw.map((v) => `
      <button class="video" type="button" data-lightbox="video" data-id="${esc(v.youtubeId)}" data-title="${esc(v.title)}" data-cursor="${esc(ui.play)}">
        ${v.thumb && exists(v.thumb) ? img(base, { file: v.thumb, width: 1280, height: 720 }, { alt: "", title: v.title }) : ""}
        <span class="video__play" aria-hidden="true">${ICON.play}</span>
        <span class="video__title">${esc(v.title)}</span>
      </button>`).join("");
}
function videosSection(base, { full = false } = {}) {
  const s = S.videos;
  return `
<section class="section section--dark" id="videos">
  <div class="wrap band${full ? "" : " band--split"}">
    ${full ? "" : `<div class="band__head">
      <p class="eyebrow" data-reveal="fade">${esc(s.eyebrow)}</p>
      <h2 class="h-display h-2" data-reveal="up">${esc(s.title)}</h2>
      <p class="lead" data-reveal="up" style="--d:.1s">${esc(s.text)}</p>
      <a class="btn-arrow" href="${base}videos/">${esc(s.cta)}${ICON.right}</a>
    </div>`}
    <div class="videos" data-stagger="120" data-stagger-kind="zoom">${videoItems(base)}</div>
  </div>
</section>`;
}

function galleryItems(base) {
  return galleryRaw.filter((g) => exists(g.file)).map((g, i) => `
      <button class="print" type="button" data-lightbox="image" data-src="${base}assets/${esc(g.file)}" data-alt="${esc(g.alt || g.caption || "")}" data-cursor="${esc(ui.view)}">
        ${tape(`left:50%;top:-0.7rem;margin-left:-2.6rem;--r:${i % 2 ? 6 : -5}deg`)}
        ${img(base, g, { alt: g.alt || g.caption || "", title: g.caption || "" })}
        ${g.caption ? `<span class="cap">${esc(g.caption)}</span>` : ""}
      </button>`).join("");
}
function gallerySection(base, { full = false } = {}) {
  const s = S.gallery;
  return `
<section class="section section--dark" id="gallery">
  <div class="wrap band${full ? "" : " band--split"}">
    ${full ? "" : `<div class="band__head">
      <p class="eyebrow" data-reveal="fade">${esc(s.eyebrow)}</p>
      <h2 class="h-display h-2" data-reveal="up">${esc(s.title)}</h2>
      <p class="lead" data-reveal="up" style="--d:.1s">${esc(s.text)}</p>
      <a class="btn-arrow" href="${base}gallery/">${esc(s.cta)}${ICON.right}</a>
    </div>`}
    <div class="polaroids" data-stagger="100" data-stagger-kind="drop">${galleryItems(base)}</div>
  </div>
</section>`;
}

function newsCards(base, list) {
  return list.map((n) => `
      <article class="news__card">
        ${n.image && exists(n.image) ? img(base, { file: n.image, width: 800, height: 450 }, { alt: n.imageAlt || "", title: n.title }) : ""}
        <div class="news__body">
          ${n.date ? `<time datetime="${esc(n.date)}">${esc(fmtDate(n.date))}</time>` : ""}
          <h3>${esc(n.title)}</h3>
          ${n.excerpt ? `<p>${esc(n.excerpt)}</p>` : ""}
          ${n.url ? ext(n.url, "btn-arrow", `${esc(ui.readMore)}${ICON.right}`) : ""}
        </div>
      </article>`).join("");
}
function newsSection(base, { full = false } = {}) {
  const s = S.news;
  const list = [...newsRaw].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, full ? 100 : 3);
  return tornWrap(`
    <div class="wrap band${full ? "" : " band--split"}">
      ${full ? "" : `<div class="band__head">
        <p class="eyebrow">${esc(s.eyebrow)}</p>
        <h2 class="h-display h-2" data-reveal="up">${esc(s.title)}</h2>
        <p class="lead" data-reveal="up" style="--d:.1s">${esc(s.text)}</p>
        <a class="btn-arrow" href="${base}news/">${esc(s.cta)}${ICON.right}</a>
      </div>`}
      <div class="news" data-stagger="110" data-stagger-kind="drop">${newsCards(base, list)}</div>
    </div>`, { id: "news", pull: "both" });
}

function finalCornersSection(base) {
  const s = S.finalCorners;
  const image = s.image && exists(s.image.file) ? s.image : null;
  return `
<section class="section section--dark" id="final-corners">
  <div class="wrap fc${image ? " has-img" : ""}">
    ${image ? `<div class="fc__img" data-reveal="left">${img(base, image, { alt: image.alt || s.name, title: s.name })}</div>` : ""}
    <div>
      <p class="eyebrow" data-reveal="fade">${esc(s.eyebrow)}</p>
      <h2 class="h-display h-1" data-reveal="up" style="margin-top:1rem">${esc(s.name)}</h2>
      ${s.role ? `<p class="muted" style="margin-top:.8rem">${esc(s.role)}</p>` : ""}
      <p class="lead" style="margin-top:1.4rem;max-width:34rem;--d:.1s" data-reveal="up">${esc(s.summary)}</p>
      ${s.url ? `<div style="margin-top:2rem">${ext(s.url, "btn btn--ghost", esc(s.name), "data-magnetic")}</div>` : ""}
    </div>
  </div>
</section>`;
}

function pagehead(eyebrow, title, lead) {
  return `
<section class="pagehead">
  <div class="wrap">
    <p class="eyebrow" data-reveal="fade">${esc(eyebrow)}</p>
    <h1 class="h-display h-1" style="margin-top:1rem" data-reveal="up">${esc(title)}</h1>
    ${lead ? `<p class="lead" data-reveal="up" style="--d:.1s">${esc(lead)}</p>` : ""}
  </div>
</section>`;
}

/* ----------------------------------------------------------------- pages */
const pages = [];
const add = (p, html) => pages.push({ p, html });
const artistImage = hasPhoto ? photo.file : (latest && exists(latest.cover.file) ? latest.cover.file : "");

// Home
add("index.html", page({
  base: "", key: "home", path: "", image: artistImage,
  jsonLd: {
    "@context": "https://schema.org", "@type": "MusicGroup", name: site.name, url: SITE_URL ? `${SITE_URL}/` : undefined,
    ...(hasPhoto && SITE_URL ? { image: `${SITE_URL}/assets/${photo.file}` } : {}),
    genre: site.artist.genres, sameAs: socials.map((s) => s.url),
    track: releases.map((r) => ({ "@type": "MusicRecording", name: r.title, ...(SITE_URL ? { url: `${SITE_URL}/music/${r.slug}/` } : {}) })),
  },
  body: [hero(""), releasesSection(""), aboutSection(""), listenSection(), has.videos ? videosSection("") : "", has.gallery ? gallerySection("") : "", has.news ? newsSection("") : "", has.fc ? finalCornersSection("") : ""].join("\n"),
}));

// Music
{
  const years = [...new Set(releases.map((r) => r.year))].sort((a, b) => b - a);
  const groups = years.map((y) => {
    const items = sortedReleases.filter((r) => r.year === y);
    return `<h2 class="year" data-reveal="up">${y}</h2><div class="grid-cards" role="list" data-stagger="90" data-stagger-kind="drop">${items.map((r, i) => releaseCard("../", r, i)).join("")}</div>`;
  }).join("");
  add("music/index.html", page({
    base: "../", key: "music", path: "music/", title: ui.musicTitle, image: artistImage,
    description: `Rilisan pilihan Ari Nurdiman: ${sortedReleases.map((r) => r.title).join(", ")}.`,
    jsonLd: { "@context": "https://schema.org", "@type": "ItemList", name: "Ari Nurdiman, rilisan pilihan", itemListElement: releases.map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.title, ...(SITE_URL ? { url: `${SITE_URL}/music/${r.slug}/` } : {}) })) },
    body: `${pagehead(site.hero.eyebrow, ui.musicTitle, ui.musicSub)}${tornWrap(`<div class="wrap">${groups}</div>`, { pull: "both" })}${listenSection()}`,
  }));
}

// Songs
releases.forEach((r, idx) => {
  const base = "../../";
  const prev = releases[(idx - 1 + releases.length) % releases.length];
  const next = releases[(idx + 1) % releases.length];
  const details = [r.releaseDate ? `${ui.released} ${fmtDate(r.releaseDate)}` : null, r.duration ? `${ui.duration} ${r.duration}` : null].filter(Boolean).join(", ");
  const desc = r.description?.paragraphs?.length ? `<div class="song-sec"><h2 id="about-song">${esc(ui.aboutSong)}</h2><div class="song-text" lang="${esc(r.description.lang || site.lang)}">${r.description.paragraphs.map((t) => `<p>${esc(t)}</p>`).join("")}</div></div>` : "";
  const hasCredits = r.credits?.length > 0, hasLyrics = !!r.lyricsUrl, hasRelated = r.relatedLinks?.length > 0;
  const stream = `<div class="song-sec"><h2>${esc(ui.streaming)}</h2><div>
      <div class="embed">${r.spotifyTrackId
        ? `<iframe title="${esc(r.title)} di Spotify" src="https://open.spotify.com/embed/track/${esc(r.spotifyTrackId)}?utm_source=generator&theme=0" height="152" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`
        : `<iframe title="${esc(ui.spotifyPlayerTitle)}" src="https://open.spotify.com/embed/artist/${esc(site.spotifyArtistId)}?utm_source=generator&theme=0" height="352" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`}</div>
      ${r.youtubeVideoId ? `<div class="embed embed--video"><iframe title="${esc(r.title)} di YouTube" src="https://www.youtube-nocookie.com/embed/${esc(r.youtubeVideoId)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>` : ""}
    </div></div>`;
  const hasTracks = r.tracks?.length > 0;
  const extras = [
    hasTracks ? `<div class="song-sec"><h2>${esc(ui.tracklist)}</h2><ol class="tracklist">${r.tracks.map((t) => `<li><span>${esc(t.title)}</span>${t.duration ? `<span class="muted">${esc(t.duration)}</span>` : ""}</li>`).join("")}</ol></div>` : "",
    hasCredits ? `<div class="song-sec"><h2>${esc(ui.songCredits)}</h2><dl class="credit-list">${r.credits.map((c) => `<div><dt>${esc(c.role)}</dt><dd>${esc(c.name)}</dd></div>`).join("")}</dl></div>` : "",
    hasLyrics ? `<div class="song-sec"><h2>${esc(ui.lyrics)}</h2><div>${ext(r.lyricsUrl, "btn btn--ghost", esc(ui.readLyrics))}</div></div>` : "",
    hasRelated ? `<div class="song-sec"><h2>${esc(ui.related)}</h2><ul class="linklist" style="margin-top:0">${r.relatedLinks.map((l) => `<li>${ext(l.url, "", `${esc(l.label)}${ICON.up}`)}</li>`).join("")}</ul></div>` : "",
  ].join("");
  const body = `
<section class="song">
  <div class="wrap">
    <a class="song__back" href="${base}music/">${ICON.left}${esc(ui.backToMusic)}</a>
    <div class="song__grid">
      <div class="record" data-reveal="drop" data-cursor="${esc(ui.play)}" style="--r:0deg">
        <div class="record__disc" aria-hidden="true"><div class="record__label">${esc(site.name)}</div></div>
        <div class="record__sleeve">${coverImg(base, r, { loading: "eager", priority: true })}</div>
      </div>
      <div class="song__info">
        <span class="eyebrow" data-reveal="fade">${esc(site.name)}</span>
        <h1 class="h-display h-1" data-reveal="up" style="--d:.1s">${esc(r.title)}</h1>
        <p class="song__meta" data-reveal="up" style="--d:.2s">${esc(line(r))}</p>
        ${details ? `<p class="song__details" data-reveal="up" style="--d:.25s">${esc(details)}</p>` : ""}
        <div class="song__actions" data-reveal="up" style="--d:.35s">
          ${ext(spotify, "btn btn--paper", `${ICON.play}${esc(ui.listenSpotify)}`, "data-magnetic")}
          ${r.youtubeVideoId ? ext(`https://www.youtube.com/watch?v=${r.youtubeVideoId}`, "btn btn--ghost", esc(ui.watchYoutube), "data-magnetic") : ""}
        </div>
      </div>
    </div>
  </div>
</section>
${desc ? tornWrap(`<div class="wrap">${desc}</div>`, { pull: "both" }) : ""}
<section class="section section--dark">
  <div class="wrap">
    ${stream}${extras ? `<div style="margin-top:4rem">${extras}</div>` : ""}
    <nav class="pn" aria-label="${esc(ui.moreReleasesNav)}">
      <a href="${base}music/${prev.slug}/"><small>${ICON.left}${esc(ui.prevSong)}</small><span>${esc(prev.title)}</span></a>
      <a href="${base}music/${next.slug}/"><small>${esc(ui.nextSong)}${ICON.right}</small><span>${esc(next.title)}</span></a>
    </nav>
  </div>
</section>`;
  add(`music/${r.slug}/index.html`, page({
    base, key: "music", path: `music/${r.slug}/`, title: r.title, ogType: "music.song", image: exists(r.cover.file) ? r.cover.file : artistImage,
    description: `“${r.title}” oleh ${site.name}. ${r.releaseDate ? `Dirilis ${fmtDate(r.releaseDate)}.` : `${r.year}.`} Dengarkan di Spotify.`,
    jsonLd: {
      "@context": "https://schema.org", "@type": String(r.releaseType).toLowerCase() === "single" ? "MusicRecording" : "MusicAlbum", name: r.title,
      ...(SITE_URL ? { url: `${SITE_URL}/music/${r.slug}/` } : {}),
      ...(exists(r.cover.file) && SITE_URL ? { image: `${SITE_URL}/assets/${r.cover.file}` } : {}),
      byArtist: { "@type": "MusicGroup", name: site.name },
      ...(String(r.releaseType).toLowerCase() === "single"
        ? (r.durationSeconds ? { duration: `PT${Math.floor(r.durationSeconds / 60)}M${r.durationSeconds % 60}S` } : {})
        : { albumReleaseType: String(r.releaseType).toLowerCase() === "ep" ? "EPRelease" : "AlbumRelease", ...(hasTracks ? { numberOfTracks: r.tracks.length, track: r.tracks.map((t) => ({ "@type": "MusicRecording", name: t.title })) } : {}) }),
      ...(r.releaseDate ? { datePublished: r.releaseDate } : {}),
    },
    body,
  }));
});

// About
{
  const dated = sortedReleases.filter((r) => r.releaseDate).reverse();
  const tl = dated.length ? `<ol class="timeline" data-stagger="120" data-stagger-kind="left">${dated.map((r) => `<li><time datetime="${esc(r.releaseDate)}">${esc(fmtDate(r.releaseDate))}</time><br><a href="../music/${r.slug}/">${esc(r.title)}</a><p class="muted" style="font-size:.85rem">${esc(typeLabel(r))}</p></li>`).join("")}</ol>` : "";
  const facts = `<dl class="facts"><div><dt>${esc(ui.from)}</dt><dd>${esc(site.artist.city)}</dd></div><div><dt>${esc(ui.sound)}</dt><dd>${esc(site.artist.genres.join(", "))}</dd></div></dl>`;
  add("about/index.html", page({
    base: "../", key: "about", path: "about/", title: ui.aboutTitle, image: artistImage,
    description: `${S.about.bio[0]} ${S.about.bio[1]}`,
    jsonLd: {
      "@context": "https://schema.org", "@type": "Person", name: site.name, jobTitle: "Singer-songwriter",
      birthPlace: { "@type": "Place", name: site.artist.birthplace }, homeLocation: { "@type": "Place", name: site.artist.city },
      ...(hasPhoto && SITE_URL ? { image: `${SITE_URL}/assets/${photo.file}` } : {}), sameAs: socials.map((s) => s.url),
    },
    body: `${pagehead(site.hero.eyebrow, ui.aboutTitle, "")}
${aboutSection("../", { full: true })}
<section class="section section--dark" style="padding-top:0"><div class="wrap"><div class="song-sec"><h2>${esc(ui.timeline)}</h2><div>${facts}${tl}</div></div></div></section>
${has.fc ? finalCornersSection("../") : ""}`,
  }));
}

// Optional pages (only when content exists)
if (has.videos) add("videos/index.html", page({ base: "../", key: "videos", path: "videos/", title: ui.nav.videos, image: artistImage, body: `${pagehead(S.videos.eyebrow, S.videos.title, S.videos.text)}${videosSection("../", { full: true })}` }));
if (has.gallery) add("gallery/index.html", page({ base: "../", key: "gallery", path: "gallery/", title: ui.nav.gallery, image: artistImage, body: `${pagehead(S.gallery.eyebrow, S.gallery.title, S.gallery.text)}${gallerySection("../", { full: true })}` }));
if (has.news) add("news/index.html", page({ base: "../", key: "news", path: "news/", title: ui.nav.news, image: artistImage, body: `${pagehead(S.news.eyebrow, S.news.title, S.news.text)}${newsSection("../", { full: true })}` }));

// Contact
{
  const email = site.contact.email;
  const list = `<ul class="linklist">${socials.map((s) => `<li>${ext(s.url, "", `${esc(s.label)}${ICON.up}`)}</li>`).join("")}</ul>`;
  add("contact/index.html", page({
    base: "../", key: "contact", path: "contact/", title: ui.nav.contact, image: artistImage, description: site.contactPage.text,
    body: `${pagehead(site.hero.eyebrow, site.contactPage.title, site.contactPage.text)}
<section class="section section--dark" style="padding-top:0"><div class="wrap">
  ${email ? `<p class="lead" style="margin-bottom:1.6rem"><a class="btn btn--paper" href="mailto:${esc(email)}" data-magnetic>${esc(email)}</a></p>` : ""}
  ${list}
</div></section>`,
  }));
}

// Credits
add("credits/index.html", page({
  base: "../", key: "credits", path: "credits/", title: ui.credits, noindex: true,
  body: `${pagehead(site.hero.eyebrow, ui.credits, "")}
<section class="section section--dark" style="padding-top:0"><div class="wrap prose">
  ${site.credits.text.map((c) => `<p>${esc(c.what)}: teks dari ${ext(c.url, "", esc(c.from))}, berlisensi ${ext(c.licenseUrl, "", esc(c.license))}.</p>`).join("")}
  <p class="muted">${esc(site.credits.images)}</p>
</div></section>`,
}));

// 404 (root-relative so it works at any depth)
add("404.html", page({
  base: "/", key: "", path: "404.html", title: ui.notFoundTitle, noindex: true,
  body: `<section class="pagehead" style="min-height:80svh;display:flex;align-items:center"><div class="wrap">
  <h1 class="h-display h-1">${esc(ui.notFoundTitle)}</h1><p class="lead">${esc(ui.notFoundText)}</p>
  <p style="margin-top:2rem"><a class="btn btn--paper" href="/">${esc(ui.goHome)}</a></p></div></section>`,
}));

/* ------------------------------------------------------------------ write */
fs.rmSync(DIST, { recursive: true, force: true });
const write = (rel, data) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
for (const { p, html } of pages) write(p, html);

const copyDir = (from, to) => {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const s = path.join(from, e.name), d = path.join(to, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
};
copyDir(path.join(ROOT, "src", "fonts"), path.join(DIST, "assets", "fonts"));
copyDir(path.join(ROOT, "src", "css"), path.join(DIST, "assets", "css"));
copyDir(path.join(ROOT, "src", "js"), path.join(DIST, "assets", "js"));
copyDir(path.join(ROOT, "public"), path.join(DIST));

const urls = pages.filter((x) => !["404.html", "credits/index.html"].includes(x.p)).map((x) => x.p.replace(/index\.html$/, ""));
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE_URL}/${u}</loc></url>`).join("\n")}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nAllow: /\n${SITE_URL ? `Sitemap: ${SITE_URL}/sitemap.xml\n` : ""}`);

const metaFile = path.join(ROOT, "content", "_meta.json");
const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, "utf8")) : { source: "local", contentVersion: "local" };
write("version.json", JSON.stringify({ source: meta.source, contentVersion: meta.contentVersion, builtAt: new Date().toISOString() }));
// Lets the admin panel (another origin) read the version and show sync status. Works on Cloudflare Pages and Netlify.
write("_headers", "/version.json\n  Access-Control-Allow-Origin: *\n  Cache-Control: no-store\n");

console.log(`Built ${pages.length} pages -> dist/ (content: ${meta.source}, version ${meta.contentVersion})`);
for (const w of warnings) console.log(`  warning: ${w}`);

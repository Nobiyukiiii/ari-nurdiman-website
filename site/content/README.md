# Content guide (for the future admin panel)

Everything visitors read lives here as JSON. An admin panel only has to read/write these files and images in `public/assets/`, then run `node build.mjs` (or trigger it in CI / Cloudflare Pages: build command `node build.mjs`, output directory `dist`).

| File | Purpose |
|---|---|
| `site.json` | Brand, SEO, socials, contact email, hero copy, every homepage section's text, which optional sections are enabled |
| `ui.json` | Small interface texts (nav labels, buttons, labels). Change the language here |
| `releases.json` | Discography (one object per song; each gets its own page) |
| `videos.json` | Videos (empty = section and menu item hidden) |
| `gallery.json` | Photos (empty or `enabled:false` = hidden) |
| `news.json` | News posts (empty or `enabled:false` = hidden) |

Rules: an empty value hides its block. Never add a social account, credit, date, quote or photo that is not verified.

## Turning sections on

In `site.json` -> `sections`: set `"enabled": true` for `videos`, `gallery`, `news`, `finalCorners` **and** add items (below). Menu and footer links appear automatically.

## Item shapes

```jsonc
// videos.json
[{ "title": "Live session", "youtubeId": "VIDEO_ID", "thumb": "gallery/live-thumb.jpg" }]

// gallery.json  (files live in public/assets/gallery/)
[{ "file": "gallery/studio-01.jpg", "alt": "Describe the photo", "caption": "Short handwritten caption", "width": 800, "height": 800 }]

// news.json
[{ "title": "Headline", "date": "2026-09-30", "excerpt": "One or two sentences.", "url": "https://...", "image": "gallery/news-01.jpg", "imageAlt": "" }]

// releases.json (optional per-song fields; each section shows only if filled)
{ "spotifyTrackId": "22-char-id", "youtubeVideoId": "VIDEO_ID", "lyricsUrl": "https://...",
  "credits": [{ "role": "Producer", "name": "Name" }],
  "relatedLinks": [{ "label": "Interview", "url": "https://..." }] }

// site.json -> socials
"youtube": "https://www.youtube.com/@verified", "instagram": "https://www.instagram.com/verified/", "tiktok": "https://www.tiktok.com/@verified"

// site.json -> sections.finalCorners
{ "enabled": true, "name": "Final Corners", "role": "Verified role", "summary": "Verified text.", "url": "https://...", "image": { "file": "gallery/fc.jpg", "alt": "" } }
```

Image paths are relative to `public/assets/`. Missing images never break the page: covers fall back to typography, missing gallery images are skipped (the build prints a warning).

`{latest}` inside `sections.releases.note` is replaced with the newest release title.

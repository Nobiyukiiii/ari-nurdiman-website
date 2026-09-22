# Research log (development notes, not shown on the site)

Checked: **2026-09-20**. Rule: a fact only enters `data/artist.ts` / `data/releases.ts` if a row below says it was read from the page.
"Read" = the page was opened and its content matched Ari Nurdiman. "Not read" = could not be opened, so nothing was taken from it.

## Sources that were read

| SOURCE | URL | DATA TAKEN | STATUS |
|---|---|---|---|
| Spotify (artist) | https://open.spotify.com/artist/5tWhgpvyldtw8oY1JpcqKp | Artist ID, artist profile image (`i.scdn.co/image/ab6761610000e5eb28e1b60bbfa115d4df7f0c00`, 640×640), name | Read (page metadata only; no track list exposed) |
| Last.fm (artist) | https://www.last.fm/music/Ari+Nurdiman | Release list, 4 cover images, "Born in: Brebes Regency, Jawa Tengah", Bandung origin, genres | Read |
| Last.fm (artist bio) | https://www.last.fm/music/Ari+Nurdiman/+wiki | Bio text (paraphrased on site). User-contributed, CC BY-SA 3.0, version 1 edited by Last.fm user "FinalCorners" on 2026-09-13 | Read |
| Last.fm (release) | https://www.last.fm/music/Ari+Nurdiman/Berarti,+Namun+Tak+Sama (+ /+wiki) | Date 2026-06-30, 3:55, 1 track, cover, description (ID) | Read |
| Last.fm (release) | https://www.last.fm/music/Ari+Nurdiman/Satu+Janji,+Satu+Hidup | Date 2026-08-07, 4:24, 1 track, cover, description (ID) | Read |
| Last.fm (release) | https://www.last.fm/music/Ari+Nurdiman/Senyummu+Cukup | 4:04, 1 track, cover, description (ID). **No release date shown.** | Read |
| Last.fm (release) | https://www.last.fm/music/Ari+Nurdiman/Sesederhana+Ini (+ /+wiki) | Date 2026-09-18, 4:10, 1 track, cover, description (ID) | Read |

## Sources that could NOT be read

| SOURCE | URL | WHY | EFFECT |
|---|---|---|---|
| Genius | https://genius.com/artists/Ari-nurdiman | Fetch blocked | Linked as supplied by site owner; no data taken; no lyrics, no song URLs |
| MusicBrainz | https://musicbrainz.org/artist/a0931f1e-aca7-44a8-8b0f-7a2a0452c747 | Page requires JavaScript challenge | Linked as supplied; no data taken; no ISRC / credits / labels |
| Wikidata | https://www.wikidata.org/wiki/Q141414751 | Domain cache-only | Linked as supplied; no data taken |

## Searched, not verified (so NOT on the site)

| ITEM | RESULT |
|---|---|
| Spotify track IDs / track embeds | Not found. Song pages use the verified **artist** embed + "Listen on Spotify" |
| YouTube channel / videos | No official channel found. Search-result hits belonged to other people. Song pages use a YouTube **search** link only |
| Instagram | Not verified. One search hit ("ariscorner_") has no evidence it is Ari; not used |
| TikTok | Not found |
| Final Corners | No public page found tying Ari to the band. Last.fm bio/descriptions were edited by a user named "FinalCorners", which is a hint, not proof. Section stays hidden until `artist.finalCorners` is filled |
| Extra photos / gallery | Only one artist photo confirmed. Last.fm lists a second artist image (`2a96cbd8b46e442fc41c2b86b821562f`) that was not identified. Gallery stays hidden |
| Quotes, awards, labels, credits, songwriter/producer, ISRC, lyrics | Nothing found. Not shown |
| Song-level genre | Not published. Only artist-level genres (from Last.fm) are shown |

## Image register (local files)

The site references only local `assets/...` files. Original URLs live in `scripts/assets.manifest.json` and are used once by `npm run assets`.

| LOCAL FILE | ORIGINAL SOURCE | CREDIT | LICENSE |
|---|---|---|---|
| `public/assets/artist/ari-nurdiman.jpg` | Spotify artist profile image (`i.scdn.co/image/ab6761610000e5eb28e1b60bbfa115d4df7f0c00`, 640×640) | Not stated | unknown |
| `public/assets/releases/berarti-namun-tak-sama.jpg` | Last.fm (`4724152a25dff9959f289d9741cf7aff`, 500×500) | Not stated | unknown |
| `public/assets/releases/satu-janji-satu-hidup.jpg` | Last.fm (`4bcbc115b964d2505a248758e6d5abe4`, 500×500) | Not stated | unknown |
| `public/assets/releases/senyummu-cukup.jpg` | Last.fm (`d2c43435d9709fd4011c1d4ae7379075`, 500×500) | Not stated | unknown |
| `public/assets/releases/sesederhana-ini.jpg` | Last.fm (`3e86abf9a3f336147d1790e04e93f7a2`, 500×500) | Not stated | unknown |

License is unknown for all of them. Get written permission or replace with press assets before launch.
Status when this log was written: the build sandbox blocks `i.scdn.co` and `lastfm-img.freetls.fastly.net` (`host_not_allowed`), so the files are NOT yet in the repo. Run `npm run assets`, then `npm run check`.

## Attribution kept on purpose

Biography and song descriptions are adapted from Last.fm user-contributed text (CC BY-SA 3.0), so a credit is kept on `/credits/` (linked from the footer, not the main UI). If the artist or team wrote that text themselves (the Last.fm edits were made by a user named "FinalCorners"), the credit can be removed.

## Inferences to be aware of

- Year 2026 for "Senyummu Cukup": stated by the site owner. Last.fm shows no date for it, so no exact date is displayed.
- "Single" as release type: Last.fm lists each as a 1-track release; the word "single" is not stated by the source.
- The hero image is the Spotify artist profile image for the supplied artist ID. It was never visually inspected (image hosts are not reachable from the build sandbox).

## Design reference

The layout follows the mockup supplied by the site owner (torn-paper collage, script signature, cream and black bands). Nothing from the mockup's content was reused: its song names, dates, news items, quotes and photographs are illustrative and do not correspond to verified information about Ari Nurdiman. Only verified releases, photo and copy are used; Videos, Gallery, News and Final Corners stay hidden until real content is added in `content/`.

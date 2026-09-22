import { h, clear, toast } from "../ui.js";
import { field, input, textarea } from "../forms.js";

/**
 * Every small piece of interface copy (buttons, nav labels, empty states) as one
 * flat key -> text map (dot-path keys, e.g. "nav.music"). A blank field means
 * "use the website's built-in default text", shown as the placeholder.
 */
const GROUPS = [
  { title: "Menu navigasi", fields: [
    ["nav.home", "Beranda"], ["nav.music", "Musik"], ["nav.about", "Tentang"], ["nav.contact", "Kontak"],
    ["nav.videos", "Video"], ["nav.gallery", "Galeri"], ["nav.news", "Berita"], ["nav.finalCorners", "Final Corners"],
    ["menuOpen", "Label tombol buka menu (mobile)"], ["menuClose", "Label tombol tutup menu (mobile)"],
    ["skip", "Teks \u201Clewati ke konten\u201D (aksesibilitas)"],
  ]},
  { title: "Tombol & label umum", fields: [
    ["listenSpotify", "Tombol \u201CDengarkan di Spotify\u201D"], ["watchYoutube", "Tombol \u201CTonton di YouTube\u201D"],
    ["play", "Tombol putar"], ["view", "Label \u201CLihat\u201D (kursor kartu)"], ["close", "Tombol tutup"], ["next", "Tombol berikutnya"],
    ["readMore", "Tautan \u201CSelengkapnya\u201D"], ["opensNewTab", "Keterangan \u201Cterbuka di tab baru\u201D"],
    ["officialWebsite", "Label \u201COfficial Website\u201D"], ["scrollHint", "Petunjuk \u201CScroll\u201D di hero"],
    ["artistPhotoCursor", "Nama pada kursor saat arahkan mouse ke foto artis"],
  ]},
  { title: "Halaman Musik & rilisan", fields: [
    ["musicTitle", "Judul halaman Musik"], ["musicSub", "Subjudul halaman Musik"],
    ["types.single", "Label jenis: Single"], ["types.ep", "Label jenis: EP"], ["types.album", "Label jenis: Album"],
    ["tracklist", "Judul \u201CDaftar lagu\u201D"], ["duration", "Label \u201CDurasi\u201D"], ["released", "Label \u201CDirilis\u201D"],
  ]},
  { title: "Halaman lagu", fields: [
    ["backToMusic", "Tautan \u201CKembali ke Musik\u201D"], ["aboutSong", "Judul \u201CTentang lagu\u201D"],
    ["songCredits", "Judul \u201CKredit\u201D"], ["lyrics", "Judul \u201CLirik\u201D"], ["readLyrics", "Tombol \u201CBaca lirik\u201D"],
    ["streaming", "Judul \u201CStreaming\u201D"], ["related", "Judul \u201CTautan terkait\u201D"],
    ["prevSong", "Label \u201CLagu sebelumnya\u201D"], ["nextSong", "Label \u201CLagu berikutnya\u201D"],
    ["moreReleasesNav", "Keterangan aksesibilitas navigasi lagu sebelumnya/berikutnya"],
    ["spotifyPlayerTitle", "Judul pemutar Spotify (aksesibilitas)"],
  ]},
  { title: "Tentang & lainnya", fields: [
    ["aboutTitle", "Judul halaman Tentang"], ["from", "Label \u201CAsal\u201D"], ["sound", "Label \u201CSuara\u201D (genre)"],
    ["timeline", "Judul \u201CLinimasa\u201D"], ["credits", "Judul/tautan \u201CKredit\u201D di footer"],
  ]},
  { title: "Halaman tidak ditemukan (404)", fields: [
    ["notFoundTitle", "Judul"], ["notFoundText", "Teks", true], ["goHome", "Tombol \u201CKe beranda\u201D"],
  ]},
];

export function textsView(ctx) {
  const { api } = ctx;
  const root = h("section", { class: "page" });
  root.append(h("p", { class: "muted" }, "Memuat…"));

  (async () => {
    let rows = [], defaults = {};
    try {
      [rows, defaults] = await Promise.all([api.select("ui_text", "select=key,value"), fetch("defaults/ui.json").then((r) => r.json())]);
    } catch (e) { toast(e.message, "err"); }
    clear(root);
    build(rows, defaults);
  })();

  function build(rows, defaults) {
    const flatDefault = (path) => path.split(".").reduce((a, k) => (a && typeof a === "object" ? a[k] : undefined), defaults) ?? "";

    const current = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const controls = {};
    const form = h("form", { class: "form form--wide" },
      h("p", { class: "note field--full" }, "Kosongkan kolom mana pun untuk memakai teks bawaan website (ditampilkan sebagai placeholder abu-abu)."),
      GROUPS.map((g) => h("fieldset", {}, h("legend", {}, g.title),
        g.fields.map(([key, label, long]) => {
          const c = long ? textarea({ value: current[key] || "", rows: 2, placeholder: flatDefault(key) }) : input({ value: current[key] || "", placeholder: flatDefault(key) });
          controls[key] = c;
          return field(label, c, { full: !!long });
        }))),
      h("div", { class: "form__actions form__actions--sticky" }, h("button", { class: "btn btn--primary", type: "submit" }, "Simpan teks")));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]"); btn.disabled = true;
      try {
        const changed = Object.entries(controls).filter(([key, c]) => (c.value.trim() || null) !== (current[key] ?? null));
        for (const [key, c] of changed) { const value = c.value.trim() || null; await api.upsert("ui_text", { key, value }, "key"); current[key] = value; }
        toast(changed.length ? "Teks disimpan." : "Tidak ada perubahan.");
        ctx.refreshSync();
      } catch (err) { toast(err.message, "err"); }
      btn.disabled = false;
    });

    root.append(h("header", { class: "page__head" }, h("div", {}, h("h1", {}, "Teks Website"), h("p", { class: "muted" }, "Label tombol, menu, dan teks kecil lain di seluruh halaman."))), form);
  }
  return root;
}

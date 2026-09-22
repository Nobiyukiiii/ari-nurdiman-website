import { h, clear, toast, confirmDialog, slugify, emptyToNull, extractSpotifyTrackId, extractYoutubeId, isHttpUrl, parseDuration } from "../ui.js";
import { field, input, textarea, select, rowsEditor } from "../forms.js";
import { imageField, cleanupReplaced } from "../images.js";

const TYPES = [["single", "Single"], ["ep", "EP"], ["album", "Album"]];
const TYPE_LABEL = Object.fromEntries(TYPES);
const STATUS = [["published", "Tampil di website"], ["draft", "Draf (disembunyikan)"]];
const ORDER = "order=sort.asc,created_at.asc";

/* ------------------------------------------------------------------ list */
export function releasesList(ctx) {
  const { api } = ctx;
  const root = h("section", { class: "page" });
  const list = h("div", { class: "list" });
  root.append(
    h("header", { class: "page__head" },
      h("div", {}, h("h1", {}, "Musik"), h("p", { class: "muted" }, "Single, EP, dan album. Urutan di sini menentukan tombol lagu sebelumnya/berikutnya di website.")),
      h("div", { class: "page__actions" }, h("a", { class: "btn btn--primary", href: "#/releases/new" }, "+ Tambah rilisan"))),
    list);
  let rows = [];

  async function load() {
    try { rows = await api.select("releases", `select=*&${ORDER}`); } catch (e) { toast(e.message, "err"); return; }
    clear(list);
    if (!rows.length) { list.append(h("p", { class: "empty" }, "Belum ada rilisan.")); return; }
    rows.forEach((r, i) => list.append(h("article", { class: "row" },
      h("div", { class: "thumb" }, r.cover_path ? h("img", { src: api.publicUrl(r.cover_path), alt: "", loading: "lazy" }) : h("div", { class: "thumb__none" }, "♪")),
      h("div", { class: "row__main" },
        h("strong", {}, r.title),
        h("span", { class: "muted" }, `${TYPE_LABEL[r.release_type] || r.release_type} · ${r.release_date || r.year}`),
        h("span", { class: `pill pill--${r.status}` }, r.status === "published" ? "Tampil" : "Draf"),
        !r.cover_path ? h("span", { class: "pill pill--warn" }, "Belum ada cover") : null),
      h("div", { class: "row__actions" },
        h("button", { class: "icon-btn", type: "button", "aria-label": "Naikkan", disabled: i === 0, onclick: () => move(i, -1) }, "↑"),
        h("button", { class: "icon-btn", type: "button", "aria-label": "Turunkan", disabled: i === rows.length - 1, onclick: () => move(i, 1) }, "↓"),
        h("a", { class: "btn btn--sm", href: `#/releases/${r.id}` }, "Edit"),
        h("button", { class: "btn btn--sm btn--danger-ghost", type: "button", onclick: () => remove(r) }, "Hapus")))));
  }
  async function move(i, dir) {
    const j = i + dir; const next = [...rows]; [next[i], next[j]] = [next[j], next[i]];
    try {
      for (const [idx, r] of next.entries()) if (r.sort !== (idx + 1) * 10) await api.update("releases", `id=eq.${r.id}`, { sort: (idx + 1) * 10 });
      ctx.refreshSync(); load();
    } catch (e) { toast(e.message, "err"); }
  }
  async function remove(r) {
    if (!(await confirmDialog(`Hapus “${r.title}” beserta cover-nya? Tindakan ini tidak bisa dibatalkan.`, { okLabel: "Hapus", danger: true }))) return;
    try {
      await api.remove("releases", `id=eq.${r.id}`);
      if (r.cover_path) await api.removeFiles([r.cover_path]).catch(() => {});
      toast("Rilisan dihapus."); ctx.refreshSync(); load();
    } catch (e) { toast(e.message, "err"); }
  }
  load();
  return root;
}

/* ------------------------------------------------------------------ form */
export function releaseForm(ctx, id) {
  const { api } = ctx;
  const root = h("section", { class: "page" });
  root.append(h("p", { class: "muted" }, "Memuat…"));

  (async () => {
    let row = null;
    if (id !== "new") {
      try { [row] = await api.select("releases", `select=*&id=eq.${id}`); } catch (e) { toast(e.message, "err"); }
      if (!row) { clear(root); root.append(h("p", { class: "empty" }, "Rilisan tidak ditemukan."), h("a", { class: "btn", href: "#/releases" }, "Kembali")); return; }
    }
    clear(root);
    build(row);
  })();

  function build(r) {
    const isNew = !r;
    const f = {};
    f.title = input({ value: r?.title, required: true });
    f.slug = input({ value: r?.slug, placeholder: "otomatis dari judul" });
    f.type = select(TYPES, r?.release_type || "single");
    f.date = input({ type: "date", value: r?.release_date || "" });
    f.year = input({ type: "number", value: r?.year ?? new Date().getFullYear(), min: 1900, max: 2100, inputmode: "numeric" });
    f.duration = input({ value: r?.duration || "", placeholder: "m:ss, contoh 3:55" });
    f.description = textarea({ rows: 8, value: r?.description || "", placeholder: "Pisahkan paragraf dengan satu baris kosong." });
    f.spotify = input({ value: r?.spotify_track_id || "", placeholder: "Tempel tautan lagu Spotify" });
    f.youtube = input({ value: r?.youtube_video_id || "", placeholder: "Tempel tautan video YouTube" });
    f.lyrics = input({ type: "url", value: r?.lyrics_url || "", placeholder: "https://…" });
    f.status = select(STATUS, r?.status || "draft");
    f.coverAlt = input({ value: r?.cover_alt || "", placeholder: "Contoh: Cover artwork “Judul” oleh Ari Nurdiman" });
    f.cover = imageField(api, { folder: "releases", value: r?.cover_path || "", square: true, max: 1400, base: r?.slug || "cover", hint: "Dipotong persegi dari tengah dan diperkecil otomatis." });
    f.credits = rowsEditor({ columns: [{ key: "role", label: "Peran", placeholder: "Peran (mis. Produser)", width: "1fr" }, { key: "name", label: "Nama", placeholder: "Nama", width: "1.4fr" }], value: r?.credits || [], addLabel: "Tambah kredit" });
    f.links = rowsEditor({ columns: [{ key: "label", label: "Label", placeholder: "Label", width: "1fr" }, { key: "url", label: "URL", placeholder: "https://…", width: "1.6fr" }], value: r?.related_links || [], addLabel: "Tambah tautan" });
    f.tracks = rowsEditor({ columns: [{ key: "title", label: "Judul lagu", placeholder: "Judul lagu", width: "2fr" }, { key: "duration", label: "Durasi", placeholder: "m:ss", width: "0.6fr" }], value: r?.tracks || [], addLabel: "Tambah lagu" });

    // slug follows the title until the user edits it by hand (or the release is already saved)
    let slugTouched = !isNew;
    f.slug.addEventListener("input", () => { slugTouched = true; });
    f.title.addEventListener("input", () => { if (!slugTouched) f.slug.value = slugify(f.title.value); });
    f.date.addEventListener("change", () => { if (f.date.value) f.year.value = f.date.value.slice(0, 4); });
    const tracksField = field("Daftar lagu (untuk EP/Album)", f.tracks.el, { full: true, help: "Hanya lagu yang benar-benar ada di rilisan ini." });
    const syncType = () => { tracksField.hidden = f.type.value === "single"; };
    f.type.addEventListener("change", syncType);

    const errBox = h("p", { class: "form__error", role: "alert", hidden: true });
    const save = h("button", { class: "btn btn--primary", type: "submit" }, isNew ? "Simpan rilisan" : "Simpan perubahan");
    const form = h("form", { class: "form form--wide", novalidate: true },
      h("fieldset", {}, h("legend", {}, "Informasi utama"),
        field("Judul *", f.title), field("Jenis", f.type),
        field("Slug (alamat halaman)", f.slug, { help: r?.status === "published" ? "Mengubah slug pada rilisan yang sudah tampil akan mengubah alamat halamannya." : "Huruf kecil, angka, dan tanda hubung." }),
        field("Tanggal rilis", f.date, { help: "Kosongkan bila belum diketahui pasti." }), field("Tahun *", f.year), field("Durasi", f.duration)),
      h("fieldset", {}, h("legend", {}, "Cover"),
        h("div", { class: "field field--full" }, f.cover.el), field("Teks alternatif cover", f.coverAlt, { full: true })),
      h("fieldset", {}, h("legend", {}, "Tentang lagu"),
        field("Deskripsi", f.description, { full: true, help: "Tulis hanya informasi yang benar dan terverifikasi." })),
      h("fieldset", {}, h("legend", {}, "Streaming & tautan"),
        field("Spotify (tautan lagu)", f.spotify, { help: "Kosongkan bila belum ada. Website akan memakai profil artis." }),
        field("YouTube (tautan video resmi)", f.youtube), field("Tautan lirik", f.lyrics, { full: true })),
      h("fieldset", {}, h("legend", {}, "Kredit & lainnya"),
        tracksField,
        field("Kredit", f.credits.el, { full: true, help: "Isi hanya bila terverifikasi." }),
        field("Tautan terkait", f.links.el, { full: true })),
      h("fieldset", {}, h("legend", {}, "Publikasi"), field("Status", f.status)),
      errBox,
      h("div", { class: "form__actions form__actions--sticky" }, h("a", { class: "btn", href: "#/releases" }, "Batal"), save));
    syncType();

    form.addEventListener("submit", async (e) => {
      e.preventDefault(); errBox.hidden = true;
      const fail = (m) => { errBox.textContent = m; errBox.hidden = false; errBox.scrollIntoView({ block: "center" }); };
      const title = f.title.value.trim();
      const slug = (f.slug.value.trim() || slugify(title));
      if (!title) return fail("Judul wajib diisi.");
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return fail("Slug hanya boleh huruf kecil, angka, dan tanda hubung.");
      const year = Number(f.year.value);
      if (!year || year < 1900 || year > 2100) return fail("Tahun tidak valid.");
      const duration = f.duration.value.trim();
      if (duration && parseDuration(duration) === null) return fail("Durasi harus berformat m:ss, contoh 3:55.");
      const spotify = extractSpotifyTrackId(f.spotify.value); if (spotify === undefined) return fail("Tautan lagu Spotify tidak valid.");
      const youtube = extractYoutubeId(f.youtube.value); if (youtube === undefined) return fail("Tautan video YouTube tidak valid.");
      if (f.lyrics.value.trim() && !isHttpUrl(f.lyrics.value.trim())) return fail("Tautan lirik harus diawali https://");
      const links = f.links.value; if (links.some((l) => !l.label || !isHttpUrl(l.url))) return fail("Setiap tautan terkait butuh label dan URL yang diawali https://");
      const tracks = f.type.value === "single" ? [] : f.tracks.value; if (tracks.some((t) => !t.title || (t.duration && parseDuration(t.duration) === null))) return fail("Setiap lagu butuh judul; durasi berformat m:ss.");
      const credits = f.credits.value; if (credits.some((c) => !c.role || !c.name)) return fail("Setiap kredit butuh peran dan nama.");
      if (f.status.value === "published" && !f.cover.value) return fail("Unggah cover sebelum menampilkan rilisan di website (atau simpan sebagai draf).");

      const payload = {
        slug, title, release_type: f.type.value, year, release_date: emptyToNull(f.date.value),
        duration: emptyToNull(duration), duration_seconds: duration ? parseDuration(duration) : null,
        cover_path: emptyToNull(f.cover.value), cover_alt: emptyToNull(f.coverAlt.value),
        description: emptyToNull(f.description.value), spotify_track_id: spotify, youtube_video_id: youtube,
        lyrics_url: emptyToNull(f.lyrics.value), credits, related_links: links, tracks, status: f.status.value,
      };
      save.disabled = true;
      try {
        if (r) { await api.update("releases", `id=eq.${r.id}`, payload); await cleanupReplaced(api, r.cover_path, payload.cover_path); }
        else {
          const all = await api.select("releases", "select=sort&order=sort.desc&limit=1");
          await api.insert("releases", { ...payload, sort: (all[0]?.sort || 0) + 10 });
        }
        toast(isNew ? "Rilisan ditambahkan." : "Perubahan disimpan.");
        ctx.refreshSync();
        location.hash = "#/releases";
      } catch (err) { fail(err.message); save.disabled = false; }
    });

    root.append(h("header", { class: "page__head" }, h("div", {}, h("h1", {}, isNew ? "Tambah rilisan" : `Edit: ${r.title}`), h("a", { href: "#/releases", class: "back" }, "← Kembali ke daftar musik"))), form);
  }
  return root;
}

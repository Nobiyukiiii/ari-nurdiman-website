import { crudView } from "../crud.js";
import { emptyToNull, extractYoutubeId, isHttpUrl } from "../ui.js";

const order = "order=sort.asc,created_at.asc";

export const gallery = (ctx) => crudView(ctx, {
  table: "photos", title: "Galeri", order, sortable: true, layout: "grid",
  intro: "Foto perjalanan dan momen di balik layar. Aktifkan bagian Galeri di Pengaturan agar tampil di website.",
  addLabel: "+ Tambah satu foto", empty: "Belum ada foto. Klik “Unggah beberapa foto” untuk mulai.",
  bulk: { label: "Unggah beberapa foto", folder: "gallery", base: "galeri" },
  imageColumns: ["path"],
  describe: (r) => ({ thumb: r.path, title: r.caption || "(tanpa keterangan)", sub: r.alt ? "" : "Belum ada teks alternatif" }),
  fields: (r) => [
    { name: "path", label: "Foto", type: "image", folder: "gallery", base: "galeri", max: 1800, value: r?.path, help: "JPG/PNG/WebP. Otomatis diperkecil." },
    { name: "caption", label: "Keterangan singkat (tulisan tangan di polaroid)", value: r?.caption, placeholder: "Contoh: Latihan di studio" },
    { name: "alt", label: "Teks alternatif (deskripsi foto untuk aksesibilitas)", value: r?.alt, placeholder: "Deskripsikan isi foto", required: true },
  ],
  toRow: (v, r) => {
    if (!v.path) throw new Error("Foto wajib diunggah.");
    if (!v.alt.trim()) throw new Error("Teks alternatif wajib diisi.");
    return { path: v.path, caption: emptyToNull(v.caption), alt: v.alt.trim(), status: v.status, ...(v.path !== r?.path ? { width: null, height: null } : {}) };
  },
});

export const videos = (ctx) => crudView(ctx, {
  table: "videos", title: "Video", order, sortable: true,
  intro: "Hanya video resmi. Tempel tautan YouTube atau ID videonya. Aktifkan bagian Video di Pengaturan agar tampil.",
  addLabel: "+ Tambah video", empty: "Belum ada video.",
  imageColumns: ["thumb_path"],
  describe: (r) => ({ thumb: r.thumb_path, icon: "▶", title: r.title, sub: `YouTube: ${r.youtube_id}` }),
  fields: (r) => [
    { name: "title", label: "Judul", value: r?.title, required: true },
    { name: "youtube", label: "Tautan atau ID YouTube", value: r?.youtube_id, required: true, placeholder: "https://www.youtube.com/watch?v=…" },
    { name: "thumb_path", label: "Gambar sampul (opsional)", type: "image", folder: "gallery", base: "video", max: 1600, value: r?.thumb_path },
  ],
  toRow: (v) => {
    if (!v.title.trim()) throw new Error("Judul wajib diisi.");
    const id = extractYoutubeId(v.youtube);
    if (!id) throw new Error("Tautan/ID YouTube tidak valid.");
    return { title: v.title.trim(), youtube_id: id, thumb_path: emptyToNull(v.thumb_path), status: v.status };
  },
});

export const news = (ctx) => crudView(ctx, {
  table: "news", title: "Berita", order: "order=date.desc.nullslast,created_at.desc",
  intro: "Kabar rilis dan kegiatan. Aktifkan bagian Berita di Pengaturan agar tampil.",
  addLabel: "+ Tambah berita", empty: "Belum ada berita.",
  imageColumns: ["image_path"],
  describe: (r) => ({ thumb: r.image_path, icon: "✎", title: r.title, sub: r.date || "" }),
  fields: (r) => [
    { name: "title", label: "Judul", value: r?.title, required: true },
    { name: "date", label: "Tanggal", type: "date", value: r?.date },
    { name: "excerpt", label: "Ringkasan", type: "textarea", rows: 3, value: r?.excerpt },
    { name: "url", label: "Tautan selengkapnya (opsional)", type: "url", value: r?.url, placeholder: "https://…" },
    { name: "image_path", label: "Gambar (opsional)", type: "image", folder: "gallery", base: "berita", max: 1600, value: r?.image_path },
    { name: "image_alt", label: "Teks alternatif gambar", value: r?.image_alt },
  ],
  toRow: (v) => {
    if (!v.title.trim()) throw new Error("Judul wajib diisi.");
    if (v.url.trim() && !isHttpUrl(v.url.trim())) throw new Error("Tautan harus diawali https://");
    return { title: v.title.trim(), date: emptyToNull(v.date), excerpt: emptyToNull(v.excerpt), url: emptyToNull(v.url), image_path: emptyToNull(v.image_path), image_alt: emptyToNull(v.image_alt), status: v.status };
  },
});

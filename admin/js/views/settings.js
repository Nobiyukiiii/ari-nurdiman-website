import { h, clear, toast, confirmDialog, emptyToNull, getPath, setPath, isHttpUrl } from "../ui.js";
import { field, input, textarea, checkbox } from "../forms.js";
import { imageField, cleanupReplaced } from "../images.js";

const HOSTS = {
  spotify: ["open.spotify.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  instagram: ["instagram.com", "www.instagram.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
};

export function settingsView(ctx) {
  const { api } = ctx;
  const root = h("section", { class: "page" });
  root.append(h("p", { class: "muted" }, "Memuat…"));

  (async () => {
    let row = null;
    try { [row] = await api.select("site_settings", "select=*&id=eq.1"); } catch (e) { toast(e.message, "err"); }
    clear(root);
    build(row?.data || {});
  })();

  function build(original) {
    const bindings = []; // { path, get(): value }
    const get = (p) => getPath(original, p);
    const bind = (path, control, map = (v) => v) => { bindings.push({ path, get: () => map(control.value) }); return control; };
    const text = (path, label, o = {}) => field(label, bind(path, input({ value: get(path) ?? "", placeholder: o.placeholder, type: o.type }), o.map || ((v) => v.trim())), { help: o.help, full: o.full });
    const area = (path, label, o = {}) => field(label, bind(path, textarea({ value: o.show ? o.show(get(path)) : get(path) ?? "", rows: o.rows || 3 }), o.map || ((v) => v.trim())), { help: o.help, full: true });

    const photo = imageField(api, { folder: "artist", value: get("artist.photo.file") || "", max: 1800, base: "ari-nurdiman", hint: "Foto utama untuk hero dan halaman Tentang. Gunakan foto resmi." });
    const fcImage = imageField(api, { folder: "gallery", value: get("sections.finalCorners.image.file") || "", max: 1600, base: "final-corners" });
    const socials = ["spotify", "youtube", "instagram", "tiktok"];
    const toggles = {};
    const sectionBlock = (key, title, extra = []) => {
      toggles[key] = checkbox(`Tampilkan bagian “${title}” di website`, get(`sections.${key}.enabled`));
      bindings.push({ path: `sections.${key}.enabled`, get: () => toggles[key].value });
      const basic = key === "finalCorners"
        ? [text(`sections.${key}.eyebrow`, "Label kecil", { full: true })]
        : [text(`sections.${key}.eyebrow`, "Label kecil"), text(`sections.${key}.title`, "Judul"), area(`sections.${key}.text`, "Teks pengantar"), text(`sections.${key}.cta`, "Teks tautan")];
      return h("fieldset", {}, h("legend", {}, title), h("div", { class: "field field--full" }, toggles[key].el), ...basic, ...extra);
    };

    const errBox = h("p", { class: "form__error", role: "alert", hidden: true });
    const save = h("button", { class: "btn btn--primary", type: "submit" }, "Simpan pengaturan");
    const form = h("form", { class: "form form--wide", novalidate: true },
      h("fieldset", {}, h("legend", {}, "Website"),
        text("siteUrl", "Alamat website (URL)", { type: "url", placeholder: "https://arinurdiman.com", full: true, help: "Dipakai untuk mengecek apakah website sudah sinkron dengan admin, dan untuk SEO." }),
        text("seo.title", "Judul SEO", { full: true }), area("seo.description", "Deskripsi SEO", { rows: 2 })),
      h("fieldset", {}, h("legend", {}, "Foto artis"), h("div", { class: "field field--full" }, photo.el), text("artist.photo.alt", "Teks alternatif foto", { full: true })),
      h("fieldset", {}, h("legend", {}, "Halaman utama (hero)"),
        text("hero.eyebrow", "Label kecil"), text("hero.tagline", "Tagline"),
        text("hero.primaryCta", "Teks tombol Spotify"), text("hero.secondaryCta", "Teks tombol jelajahi musik")),
      h("fieldset", {}, h("legend", {}, "Tentang Ari"),
        text("sections.about.title", "Judul", { full: true }),
        area("sections.about.bio", "Biografi", { rows: 8, help: "Pisahkan paragraf dengan satu baris kosong. Tulis hanya fakta yang terverifikasi.", show: (v) => (Array.isArray(v) ? v.join("\n\n") : ""), map: (v) => v.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) }),
        text("artist.city", "Asal (kota)"), text("artist.birthplace", "Tempat lahir"),
        text("artist.genres", "Genre (pisahkan dengan koma)", { full: true, map: (v) => v.split(",").map((g) => g.trim()).filter(Boolean), placeholder: "Indie pop, Alternative pop" }),
        text("sections.about.cta", "Teks tautan"), text("sections.about.note", "Catatan tulisan tangan", { help: "Kosongkan untuk menyembunyikan." })),
      h("fieldset", {}, h("legend", {}, "Bagian Rilis Terbaru"),
        text("sections.releases.title", "Judul"), text("sections.releases.cta", "Teks tombol"),
        area("sections.releases.text", "Teks pengantar"),
        text("sections.releases.note", "Catatan tulisan tangan", { help: "{latest} diganti otomatis dengan judul rilisan terbaru. Kosongkan untuk menyembunyikan." })),
      h("fieldset", {}, h("legend", {}, "Bagian Dengarkan (pemutar Spotify)"), text("sections.listen.title", "Judul"), area("sections.listen.text", "Teks")),
      h("fieldset", {}, h("legend", {}, "Akun resmi"),
        h("p", { class: "note field--full" }, "Isi hanya akun yang sudah dipastikan milik Ari. Kosongkan bila belum ada; ikonnya otomatis tidak tampil."),
        ...socials.map((s) => text(`socials.${s}`, { spotify: "Spotify", youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" }[s], { type: "url", placeholder: "https://…", full: true, map: (v) => emptyToNull(v) }))),
      h("fieldset", {}, h("legend", {}, "Kontak"), text("contact.email", "Email booking/pers", { type: "email", full: true, map: (v) => emptyToNull(v), help: "Kosongkan bila belum ada alamat publik yang dikonfirmasi." })),
      sectionBlock("videos", "Video"), sectionBlock("gallery", "Galeri"), sectionBlock("news", "Berita"),
      sectionBlock("finalCorners", "Final Corners", [
        text("sections.finalCorners.name", "Nama band"), text("sections.finalCorners.role", "Peran Ari (hanya bila terverifikasi)"),
        area("sections.finalCorners.summary", "Ringkasan"), text("sections.finalCorners.url", "Tautan", { type: "url", full: true }),
        h("div", { class: "field field--full" }, h("span", { class: "field__label" }, "Gambar"), fcImage.el)]),
      errBox,
      h("div", { class: "form__actions form__actions--sticky" }, save));

    form.addEventListener("submit", async (e) => {
      e.preventDefault(); errBox.hidden = true;
      const fail = (m) => { errBox.textContent = m; errBox.hidden = false; errBox.scrollIntoView({ block: "center" }); };
      const data = structuredClone(original);
      for (const b of bindings) setPath(data, b.path, b.get());
      // photo and Final Corners image
      setPath(data, "artist.photo.file", photo.value);
      if (photo.meta.width) { setPath(data, "artist.photo.width", photo.meta.width); setPath(data, "artist.photo.height", photo.meta.height); }
      setPath(data, "sections.finalCorners.image", fcImage.value ? { file: fcImage.value, alt: data.sections?.finalCorners?.name || "" } : null);
      // validation
      if (data.siteUrl && !isHttpUrl(data.siteUrl)) return fail("Alamat website harus diawali https://");
      for (const s of socials) {
        const v = data.socials?.[s]; if (!v) continue;
        let host = ""; try { host = new URL(v).hostname; } catch { /* handled below */ }
        if (!isHttpUrl(v) || !HOSTS[s].includes(host)) return fail(`Tautan ${s} tidak valid. Gunakan alamat resmi dari ${HOSTS[s][0]}.`);
      }
      const fc = data.sections.finalCorners;
      if (fc.enabled && (!fc.name || !fc.summary)) return fail("Final Corners: nama dan ringkasan wajib diisi bila bagian ini ditampilkan.");
      if (fc.url && !isHttpUrl(fc.url)) return fail("Tautan Final Corners harus diawali https://");
      if (data.contact?.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.contact.email)) return fail("Format email tidak valid.");
      save.disabled = true;
      try {
        await api.upsert("site_settings", { id: 1, data }, "id");
        await cleanupReplaced(api, getPath(original, "artist.photo.file"), photo.value);
        await cleanupReplaced(api, getPath(original, "sections.finalCorners.image.file"), fcImage.value);
        Object.assign(original, data);
        toast("Pengaturan disimpan."); ctx.refreshSync(true);
      } catch (err) { fail(err.message); }
      save.disabled = false;
    });

    root.append(h("header", { class: "page__head" }, h("div", {}, h("h1", {}, "Pengaturan"), h("p", { class: "muted" }, "Teks, akun resmi, dan bagian opsional website."))), form, integrations(), maintenance());
  }

  /* ------------------------------------------------ deploy hook (admin only) */
  function integrations() {
    const box = h("section", { class: "card", id: "integrations" }, h("h2", {}, "Integrasi publish"),
      h("p", { class: "muted" }, "Tombol Publish memanggil URL deploy hook agar website dibangun ulang dari data terbaru (Cloudflare Pages, Netlify, atau Vercel). URL ini disimpan di database dan hanya bisa dibaca admin."));
    const hook = input({ type: "url", placeholder: "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/…" });
    const btn = h("button", { class: "btn btn--primary", type: "button" }, "Simpan deploy hook");
    api.select("admin_settings", "select=value&key=eq.deploy_hook").then((r) => { hook.value = r[0]?.value || ""; }).catch(() => {});
    btn.addEventListener("click", async () => {
      const v = hook.value.trim();
      if (v && !(v.startsWith("https://") || v.startsWith("http://localhost"))) return toast("Deploy hook harus diawali https://", "err");
      try { await api.upsert("admin_settings", { key: "deploy_hook", value: v || null }, "key"); toast("Deploy hook disimpan."); ctx.refreshSync(); }
      catch (e) { toast(e.message, "err"); }
    });
    box.append(field("Deploy hook URL", hook, { full: true }), h("div", { class: "form__actions" }, btn));
    return box;
  }

  /* ------------------------------------------------ unused media */
  function maintenance() {
    const out = h("div", {});
    const btn = h("button", { class: "btn", type: "button" }, "Cari media tidak terpakai");
    btn.addEventListener("click", async () => {
      btn.disabled = true; clear(out);
      try {
        const [files, settings, rel, ph, vd, nw] = await Promise.all([
          api.listAllFiles(), api.select("site_settings", "select=data&id=eq.1"),
          api.select("releases", "select=cover_path"), api.select("photos", "select=path"), api.select("videos", "select=thumb_path"), api.select("news", "select=image_path")]);
        const used = new Set([getPath(settings[0]?.data || {}, "artist.photo.file"), getPath(settings[0]?.data || {}, "sections.finalCorners.image.file"),
          ...rel.map((r) => r.cover_path), ...ph.map((r) => r.path), ...vd.map((r) => r.thumb_path), ...nw.map((r) => r.image_path)].filter(Boolean));
        const unused = files.filter((f) => !used.has(f));
        if (!unused.length) { out.append(h("p", { class: "muted" }, `Semua ${files.length} file media sedang dipakai.`)); return; }
        const del = h("button", { class: "btn btn--danger", type: "button" }, `Hapus ${unused.length} file`);
        del.addEventListener("click", async () => {
          if (!(await confirmDialog(`Hapus ${unused.length} file yang tidak dipakai dari penyimpanan?`, { okLabel: "Hapus", danger: true }))) return;
          try { await api.removeFiles(unused); toast("File dihapus."); clear(out); } catch (e) { toast(e.message, "err"); }
        });
        out.append(h("ul", { class: "plain" }, unused.map((f) => h("li", {}, f))), del);
      } catch (e) { toast(e.message, "err"); } finally { btn.disabled = false; }
    });
    return h("section", { class: "card" }, h("h2", {}, "Perawatan media"),
      h("p", { class: "muted" }, "Foto yang pernah diunggah tetapi tidak lagi dipakai oleh rilisan, galeri, atau pengaturan."), btn, out);
  }
  return root;
}

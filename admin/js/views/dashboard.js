import { h, toast, fmtDateTime } from "../ui.js";

export function dashboardView(ctx) {
  const { api } = ctx;
  const root = h("section", { class: "page" });
  const syncCard = h("section", { class: "card card--sync" });
  const stats = h("div", { class: "stats" });
  const checks = h("ul", { class: "checks" });
  const history = h("ul", { class: "plain" });

  root.append(
    h("header", { class: "page__head" }, h("div", {}, h("h1", {}, "Dashboard"), h("p", { class: "muted" }, "Ringkasan isi website dan status sinkron dengan admin."))),
    syncCard, stats,
    h("section", { class: "card" }, h("h2", {}, "Yang perlu dilengkapi"), checks),
    h("section", { class: "card" }, h("h2", {}, "Riwayat publish"), history));

  function paintSync() {
    const s = ctx.getSync();
    const MSG = {
      synced: ["ok", "Website sinkron", "Isi website sama persis dengan data di admin."],
      pending: ["warn", "Ada perubahan yang belum dipublikasikan", "Klik Publish agar website dibangun ulang dengan data terbaru."],
      unknown: ["muted", "Website belum bisa dicek", `Tidak bisa membaca version.json dari website${s.error ? ` (${s.error})` : ""}. Pastikan website sudah pernah dibangun dan URL di Pengaturan benar.`],
      nosite: ["muted", "URL website belum diisi", "Isi alamat website di Pengaturan untuk mengaktifkan pengecekan sinkron."],
      checking: ["muted", "Memeriksa…", ""],
      building: ["warn", "Menunggu website selesai dibangun…", "Biasanya 1–2 menit. Halaman ini memeriksa otomatis."],
    };
    const [tone, title, text] = MSG[s.state] || MSG.checking;
    syncCard.replaceChildren(
      h("div", { class: `dot dot--${tone}`, "aria-hidden": "true" }),
      h("div", { class: "card__main" }, h("h2", {}, title), h("p", { class: "muted" }, text),
        s.site ? h("p", { class: "small muted" }, `Website dibangun ${fmtDateTime(s.site.builtAt)}, sumber: ${s.site.source}, versi ${s.site.contentVersion}. Admin: versi ${s.db}.`) : null),
      h("div", { class: "card__actions" },
        h("button", { class: "btn", type: "button", onclick: () => ctx.refreshSync(true) }, "Cek ulang"),
        h("button", { class: "btn btn--primary", type: "button", onclick: () => ctx.publish() }, "Publish sekarang")));
  }
  ctx.onSync(paintSync);
  paintSync();

  (async () => {
    try {
      const [rel, ph, vd, nw, settings, hook, log] = await Promise.all([
        api.select("releases", "select=id,status,cover_path"), api.select("photos", "select=id,status"), api.select("videos", "select=id,status"), api.select("news", "select=id,status"),
        api.select("site_settings", "select=data&id=eq.1"), api.select("admin_settings", "select=value&key=eq.deploy_hook"),
        api.select("publish_log", "select=created_at,by_email&order=created_at.desc&limit=6")]);
      const count = (rows) => ({ pub: rows.filter((r) => r.status === "published").length, draft: rows.filter((r) => r.status !== "published").length });
      for (const [label, rows, href] of [["Rilisan", rel, "#/releases"], ["Foto galeri", ph, "#/gallery"], ["Video", vd, "#/videos"], ["Berita", nw, "#/news"]]) {
        const c = count(rows);
        stats.append(h("a", { class: "stat", href }, h("strong", {}, String(c.pub)), h("span", {}, label), h("small", { class: "muted" }, c.draft ? `${c.draft} draf` : "semua tampil")));
      }
      const data = settings[0]?.data || {};
      const item = (ok, text, href) => h("li", { class: ok ? "is-ok" : "is-todo" }, h("span", { "aria-hidden": "true" }, ok ? "✓" : "•"), href && !ok ? h("a", { href }, text) : text);
      checks.append(
        item(!!data.artist?.photo?.file, "Foto artis diunggah", "#/settings"),
        item(rel.filter((r) => r.status === "published").every((r) => r.cover_path) && rel.length > 0, "Semua rilisan yang tampil punya cover", "#/releases"),
        item(!!data.siteUrl, "Alamat website diisi (untuk cek sinkron & SEO)", "#/settings"),
        item(!!hook[0]?.value, "Deploy hook diisi (untuk tombol Publish)", "#/settings"),
        item(!!data.socials?.youtube, "YouTube resmi (opsional)", "#/settings"),
        item(!!data.socials?.instagram, "Instagram resmi (opsional)", "#/settings"),
        item(!!data.socials?.tiktok, "TikTok resmi (opsional)", "#/settings"),
        item(!!data.contact?.email, "Email kontak (opsional)", "#/settings"));
      history.append(...(log.length ? log.map((l) => h("li", {}, `${fmtDateTime(l.created_at)}${l.by_email ? ` oleh ${l.by_email}` : ""}`)) : [h("li", { class: "muted" }, "Belum ada publish.")]));
    } catch (e) { toast(e.message, "err"); }
  })();
  return root;
}

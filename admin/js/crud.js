import { h, clear, toast, confirmDialog, modal } from "./ui.js";
import { field, input, textarea, select } from "./forms.js";
import { imageField, cleanupReplaced, uploadImage } from "./images.js";

const STATUS = [["published", "Tampil di website"], ["draft", "Draf (disembunyikan)"]];

/**
 * Generic list + modal editor for simple collections (photos, videos, news).
 * cfg: { table, title, intro, addLabel, order, sortable, layout, imageColumns, describe(row), fields(row), toRow(values, row), bulk }
 */
export function crudView(ctx, cfg) {
  const { api } = ctx;
  const root = h("section", { class: "page" });
  const listBox = h("div", { class: cfg.layout === "grid" ? "tiles" : "list" });
  let rows = [];

  const head = h("header", { class: "page__head" },
    h("div", {}, h("h1", {}, cfg.title), cfg.intro ? h("p", { class: "muted" }, cfg.intro) : null),
    h("div", { class: "page__actions" },
      cfg.bulk ? bulkButton() : null,
      h("button", { class: "btn btn--primary", type: "button", onclick: () => edit(null) }, cfg.addLabel)));
  root.append(head, listBox);

  function bulkButton() {
    const file = h("input", { type: "file", accept: "image/*", multiple: true, class: "sr-only", tabindex: "-1" });
    file.addEventListener("change", async () => {
      const files = [...file.files]; if (!files.length) return;
      let ok = 0, sort = Math.max(0, ...rows.map((r) => r.sort || 0));
      for (const [i, f] of files.entries()) {
        toast(`Mengunggah ${i + 1} dari ${files.length}…`, "ok", 1500);
        try {
          const up = await uploadImage(api, cfg.bulk.folder, f, { base: cfg.bulk.base || "foto", max: 1800 });
          sort += 10;
          await api.insert(cfg.table, { path: up.path, width: up.width, height: up.height, sort, status: "published" });
          ok++;
        } catch (e) { toast(`${f.name}: ${e.message}`, "err"); }
      }
      file.value = "";
      if (ok) { toast(`${ok} foto ditambahkan.`); ctx.refreshSync(); }
      load();
    });
    return h("span", {}, file, h("button", { class: "btn", type: "button", onclick: () => file.click() }, cfg.bulk.label));
  }

  async function load() {
    try { rows = await api.select(cfg.table, `select=*&${cfg.order}`); } catch (e) { toast(e.message, "err"); return; }
    clear(listBox);
    if (!rows.length) { listBox.append(h("p", { class: "empty" }, cfg.empty || "Belum ada data.")); return; }
    rows.forEach((row, i) => listBox.append(item(row, i)));
  }

  function item(row, i) {
    const d = cfg.describe(row);
    const thumb = d.thumb ? h("img", { src: api.publicUrl(d.thumb), alt: "", loading: "lazy" }) : h("div", { class: "thumb__none" }, d.icon || "•");
    const status = h("span", { class: `pill pill--${row.status}` }, row.status === "published" ? "Tampil" : "Draf");
    const move = cfg.sortable ? [
      h("button", { class: "icon-btn", type: "button", "aria-label": "Naikkan", disabled: i === 0, onclick: () => move_(i, -1) }, "↑"),
      h("button", { class: "icon-btn", type: "button", "aria-label": "Turunkan", disabled: i === rows.length - 1, onclick: () => move_(i, 1) }, "↓"),
    ] : [];
    return h("article", { class: cfg.layout === "grid" ? "tile" : "row" },
      h("div", { class: "thumb" }, thumb),
      h("div", { class: "row__main" }, h("strong", {}, d.title || "(tanpa judul)"), d.sub ? h("span", { class: "muted" }, d.sub) : null, status),
      h("div", { class: "row__actions" }, move,
        h("button", { class: "btn btn--sm", type: "button", onclick: () => edit(row) }, "Edit"),
        h("button", { class: "btn btn--sm btn--danger-ghost", type: "button", onclick: () => remove(row) }, "Hapus")));
  }

  async function move_(i, dir) {
    const j = i + dir; if (j < 0 || j >= rows.length) return;
    const next = [...rows]; [next[i], next[j]] = [next[j], next[i]];
    try {
      for (const [idx, r] of next.entries()) if (r.sort !== (idx + 1) * 10) await api.update(cfg.table, `id=eq.${r.id}`, { sort: (idx + 1) * 10 });
      ctx.refreshSync(); load();
    } catch (e) { toast(e.message, "err"); }
  }

  async function remove(row) {
    if (!(await confirmDialog(`Hapus "${cfg.describe(row).title || "item ini"}"? Tindakan ini tidak bisa dibatalkan.`, { okLabel: "Hapus", danger: true }))) return;
    try {
      await api.remove(cfg.table, `id=eq.${row.id}`);
      await api.removeFiles((cfg.imageColumns || []).map((c) => row[c]).filter(Boolean)).catch(() => {});
      toast("Dihapus."); ctx.refreshSync(); load();
    } catch (e) { toast(e.message, "err"); }
  }

  function edit(row) {
    const specs = [...cfg.fields(row), { name: "status", label: "Status", type: "select", options: STATUS, value: row?.status || "published" }];
    const controls = {};
    const form = h("form", { class: "form", novalidate: true });
    for (const s of specs) {
      let c;
      if (s.type === "textarea") c = textarea({ value: s.value ?? "", rows: s.rows, placeholder: s.placeholder });
      else if (s.type === "select") c = select(s.options, s.value);
      else if (s.type === "image") { c = imageField(api, { folder: s.folder, value: s.value || "", square: s.square, max: s.max, base: s.base, hint: s.help }); controls[s.name] = c; form.append(h("div", { class: "field field--full" }, h("span", { class: "field__label" }, s.label), c.el)); continue; }
      else c = input({ type: s.type === "date" ? "date" : s.type === "url" ? "url" : "text", value: s.value ?? "", placeholder: s.placeholder });
      controls[s.name] = c;
      form.append(field(s.label + (s.required ? " *" : ""), c, { help: s.help, full: s.type === "textarea" }));
    }
    const errBox = h("p", { class: "form__error", role: "alert", hidden: true });
    const save = h("button", { class: "btn btn--primary", type: "submit" }, "Simpan");
    form.append(errBox, h("div", { class: "form__actions" }, h("button", { class: "btn", type: "button", onclick: () => m.close() }, "Batal"), save));
    const m = modal(row ? "Edit" : cfg.addLabel.replace(/^\+\s*/, ""), form);

    form.addEventListener("submit", async (e) => {
      e.preventDefault(); errBox.hidden = true;
      const values = Object.fromEntries(Object.entries(controls).map(([k, c]) => [k, c.value]));
      let payload;
      try { payload = cfg.toRow(values, row); } catch (err) { errBox.textContent = err.message; errBox.hidden = false; return; }
      save.disabled = true;
      try {
        if (row) {
          await api.update(cfg.table, `id=eq.${row.id}`, payload);
          for (const c of cfg.imageColumns || []) await cleanupReplaced(api, row[c], payload[c]);
        } else {
          const sort = Math.max(0, ...rows.map((r) => r.sort || 0)) + 10;
          await api.insert(cfg.table, { sort, ...payload });
        }
        toast("Tersimpan."); m.close(); ctx.refreshSync(); load();
      } catch (err) { errBox.textContent = err.message; errBox.hidden = false; save.disabled = false; }
    });
  }

  load();
  return root;
}

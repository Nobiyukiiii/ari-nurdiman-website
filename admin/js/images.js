import { h, slugify, toast } from "./ui.js";

const MAX_INPUT = 25 * 1024 * 1024;

/** Reads a File, optionally center-crops to a square, downsizes and re-encodes as JPEG. */
export async function prepareImage(file, { max = 1600, square = false, quality = 0.86 } = {}) {
  if (!file.type.startsWith("image/")) throw new Error("File harus berupa gambar (JPG, PNG, atau WebP).");
  if (file.size > MAX_INPUT) throw new Error("Ukuran file terlalu besar (maksimal 25 MB).");
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = s; sh = s; }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const width = Math.round(sw * scale), height = Math.round(sh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0d0c0b"; ctx.fillRect(0, 0, width, height); // PNG transparency becomes dark, never black-on-black surprises
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, width, height);
  bmp.close?.();
  const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", quality));
  if (!blob) throw new Error("Gagal memproses gambar.");
  return { blob, width, height };
}

export const uniquePath = (folder, base) => `${folder}/${slugify(base) || "foto"}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.jpg`;

/** Prepares + uploads in one go. Returns { path, width, height }. */
export async function uploadImage(api, folder, file, { base, ...opts } = {}) {
  const { blob, width, height } = await prepareImage(file, opts);
  const path = uniquePath(folder, base || file.name.replace(/\.[^.]+$/, ""));
  await api.upload(path, blob);
  return { path, width, height };
}

/**
 * Image picker with preview, drag & drop, replace and remove.
 * The file is uploaded immediately under a new unique path; the caller saves the
 * returned path in the database and calls cleanup() with the old one afterwards.
 */
export function imageField(api, { folder, value = "", square = false, max = 1600, base = "foto", onChange, hint }) {
  let path = value || "";
  let busy = false;
  const meta = { width: null, height: null };
  const img = h("img", { alt: "", class: "imgf__img" });
  const empty = h("div", { class: "imgf__empty" }, "Belum ada foto");
  const status = h("span", { class: "imgf__status", "aria-live": "polite" });
  const input = h("input", { type: "file", accept: "image/*", class: "sr-only", tabindex: "-1" });
  const pick = h("button", { type: "button", class: "btn btn--sm", onclick: () => input.click() }, "Pilih foto");
  const del = h("button", { type: "button", class: "btn btn--sm btn--ghost", onclick: () => { path = ""; meta.width = meta.height = null; render(); onChange?.(path, meta); } }, "Hapus");
  const box = h("div", { class: `imgf__box${square ? " imgf__box--sq" : ""}`, role: "button", tabindex: "0", "aria-label": "Ganti foto (klik atau seret file ke sini)" }, img, empty);
  const el = h("div", { class: "imgf" }, box, h("div", { class: "imgf__side" }, pick, del, status, hint ? h("small", { class: "help" }, hint) : null), input);

  function render() {
    if (path) { img.src = api.publicUrl(path); img.hidden = false; empty.hidden = true; pick.textContent = "Ganti foto"; del.hidden = false; }
    else { img.removeAttribute("src"); img.hidden = true; empty.hidden = false; pick.textContent = "Pilih foto"; del.hidden = true; }
  }
  async function handle(file) {
    if (!file || busy) return;
    busy = true; el.classList.add("is-busy"); status.textContent = "Mengunggah…";
    try {
      const up = await uploadImage(api, folder, file, { base, square, max });
      path = up.path; meta.width = up.width; meta.height = up.height;
      status.textContent = "Terunggah. Simpan untuk menerapkan.";
      render(); onChange?.(path, meta);
    } catch (e) { status.textContent = ""; toast(e.message || "Gagal mengunggah", "err"); }
    finally { busy = false; el.classList.remove("is-busy"); input.value = ""; }
  }
  input.addEventListener("change", () => handle(input.files[0]));
  box.addEventListener("click", () => input.click());
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  ["dragenter", "dragover"].forEach((t) => box.addEventListener(t, (e) => { e.preventDefault(); box.classList.add("is-drop"); }));
  ["dragleave", "drop"].forEach((t) => box.addEventListener(t, (e) => { e.preventDefault(); box.classList.remove("is-drop"); }));
  box.addEventListener("drop", (e) => handle(e.dataTransfer?.files?.[0]));
  render();
  return { el, get value() { return path; }, get meta() { return meta; } };
}

/** Deletes an old storage file once a new one has been saved. Never throws. */
export async function cleanupReplaced(api, oldPath, newPath) {
  if (oldPath && oldPath !== newPath) { try { await api.removeFiles([oldPath]); } catch { /* orphan is harmless; the media cleanup tool can remove it */ } }
}

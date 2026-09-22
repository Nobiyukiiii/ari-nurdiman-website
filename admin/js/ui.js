/** DOM helpers, toasts, confirm dialog, small utilities. */

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (["value", "checked", "disabled", "selected", "textContent", "innerHTML"].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  const add = (kid) => {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) kid.forEach(add);
    else el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  };
  kids.forEach(add);
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

/* ---------- toasts ---------- */
export function toast(message, type = "ok", ms = 4200) {
  let box = document.getElementById("toasts");
  if (!box) { box = h("div", { id: "toasts", role: "status", "aria-live": "polite" }); document.body.append(box); }
  const t = h("div", { class: `toast toast--${type}` }, message);
  box.append(t);
  setTimeout(() => { t.classList.add("is-out"); setTimeout(() => t.remove(), 300); }, ms);
}

/* ---------- dialogs ---------- */
export function confirmDialog(message, { okLabel = "Ya, lanjutkan", danger = false } = {}) {
  return new Promise((resolve) => {
    const dlg = h("dialog", { class: "dlg" },
      h("p", { class: "dlg__msg" }, message),
      h("div", { class: "dlg__actions" },
        h("button", { class: "btn", type: "button", onclick: () => dlg.close("no") }, "Batal"),
        h("button", { class: `btn ${danger ? "btn--danger" : "btn--primary"}`, type: "button", onclick: () => dlg.close("yes") }, okLabel)));
    dlg.addEventListener("close", () => { resolve(dlg.returnValue === "yes"); dlg.remove(); });
    document.body.append(dlg); dlg.showModal();
  });
}
/** Opens a modal with arbitrary content. Returns { close }. */
export function modal(title, content, { wide = false } = {}) {
  const dlg = h("dialog", { class: `dlg dlg--form${wide ? " dlg--wide" : ""}`, "aria-label": title },
    h("div", { class: "dlg__head" }, h("h2", {}, title), h("button", { class: "icon-btn", type: "button", "aria-label": "Tutup", onclick: () => dlg.close() }, "×")),
    h("div", { class: "dlg__body" }, content));
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
  return { close: () => dlg.close(), el: dlg };
}

/* ---------- utilities ---------- */
export const slugify = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const emptyToNull = (v) => { const t = typeof v === "string" ? v.trim() : v; return t === "" || t === undefined ? null : t; };

export function extractSpotifyTrackId(input) {
  const v = String(input || "").trim(); if (!v) return null;
  const m = v.match(/track[/:]([A-Za-z0-9]{22})/) || v.match(/^([A-Za-z0-9]{22})$/);
  return m ? m[1] : undefined; // undefined = present but invalid
}
export function extractYoutubeId(input) {
  const v = String(input || "").trim(); if (!v) return null;
  const m = v.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/) || v.match(/^([\w-]{11})$/);
  return m ? m[1] : undefined;
}
export function isHttpUrl(v) { try { const u = new URL(v); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; } }
export function parseDuration(v) {
  const m = String(v || "").trim().match(/^(\d{1,3}):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
export const fmtDateTime = (iso) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

/* dotted-path helpers for the settings JSON */
export const getPath = (o, p) => p.split(".").reduce((a, k) => (a === undefined || a === null ? undefined : a[k]), o);
export function setPath(o, p, v) {
  const keys = p.split("."); let cur = o;
  keys.slice(0, -1).forEach((k) => { if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {}; cur = cur[k]; });
  cur[keys[keys.length - 1]] = v;
}

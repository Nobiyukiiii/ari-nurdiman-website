import { Api } from "./api.js";
import { h, clear, toast } from "./ui.js";
import { getSyncState } from "./sync.js";
import { dashboardView } from "./views/dashboard.js";
import { releasesList, releaseForm } from "./views/releases.js";
import { gallery, videos, news } from "./views/collections.js";
import { settingsView } from "./views/settings.js";
import { textsView } from "./views/texts.js";

const cfg = window.ADMIN_CONFIG || {};
const app = document.getElementById("app");
const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/YOUR-/i.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY);

/* ------------------------------------------------------------------ setup */
function renderSetup() {
  app.replaceChildren(h("main", { class: "auth" }, h("div", { class: "auth__card" },
    h("h1", { class: "brand" }, "Ari Nurdiman"), h("p", { class: "muted" }, "Panel admin belum dikonfigurasi."),
    h("ol", { class: "steps" },
      h("li", {}, "Buat proyek di Supabase, lalu jalankan ", h("code", {}, "supabase/schema.sql"), " di SQL Editor."),
      h("li", {}, "Salin ", h("code", {}, "config.example.js"), " menjadi ", h("code", {}, "config.js"), " dan isi ", h("code", {}, "SUPABASE_URL"), " serta ", h("code", {}, "SUPABASE_ANON_KEY"), "."),
      h("li", {}, "Muat ulang halaman ini."))))); 
}
const api = new Api(configured ? cfg : { SUPABASE_URL: "http://localhost", SUPABASE_ANON_KEY: "" });
const listeners = new Set();
const state = { sync: { state: "checking" }, siteUrl: null, token: 0, polling: null };
const ctx = {
  api,
  getSync: () => state.sync,
  onSync: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  refreshSync,
  publish,
};
const setSync = (s) => { state.sync = s; paintBadge(); listeners.forEach((fn) => fn()); };

/* ------------------------------------------------------------------ sync */
async function loadSiteUrl(force) {
  if (state.siteUrl !== null && !force) return state.siteUrl;
  try { const r = await api.select("site_settings", "select=data&id=eq.1"); state.siteUrl = r[0]?.data?.siteUrl || ""; } catch { state.siteUrl = ""; }
  if (!state.siteUrl && typeof window !== "undefined" && window.location) {
    if (window.location.pathname.startsWith("/admin")) state.siteUrl = window.location.origin;
  }
  return state.siteUrl;
}
async function refreshSync(force = false) {
  const mine = ++state.token;
  if (state.sync.state !== "building") setSync({ ...state.sync, state: "checking" });
  try {
    const url = await loadSiteUrl(force);
    const result = await getSyncState(api, url);
    if (mine !== state.token) return;
    if (state.sync.state === "building" && result.state === "pending") { setSync({ ...result, state: "building" }); return; }
    setSync(result);
  } catch (e) { if (mine === state.token) setSync({ state: "unknown", error: e.message }); }
  updateSiteLink();
}
function pollUntilSynced() {
  clearInterval(state.polling);
  const started = Date.now();
  state.polling = setInterval(async () => {
    if (Date.now() - started > 6 * 60 * 1000) { clearInterval(state.polling); setSync({ ...state.sync, state: "pending" }); return; }
    try {
      const result = await getSyncState(api, await loadSiteUrl());
      if (result.state === "synced") { clearInterval(state.polling); setSync(result); toast("Website sudah diperbarui."); }
    } catch { /* keep polling */ }
  }, 15000);
}
async function publish() {
  const btn = document.getElementById("publish-btn");
  try {
    const rows = await api.select("admin_settings", "select=value&key=eq.deploy_hook");
    const hook = rows[0]?.value;
    if (!hook) { toast("Isi Deploy hook dulu di Pengaturan.", "err"); location.hash = "#/settings"; return; }
    if (btn) btn.disabled = true;
    await fetch(hook, { method: "POST", mode: "no-cors" }); // hosts do not send CORS headers; the request is still delivered
    await api.insert("publish_log", { by_email: api.email, note: "publish" }).catch(() => {});
    toast("Publish dikirim. Website akan diperbarui dalam 1–2 menit.");
    setSync({ ...state.sync, state: "building" });
    pollUntilSynced();
  } catch (e) { toast(`Gagal mengirim publish: ${e.message}`, "err"); }
  finally { if (btn) btn.disabled = false; }
}

/* ------------------------------------------------------------------ shell */
const NAV = [["dashboard", "Dashboard"], ["releases", "Musik"], ["gallery", "Galeri"], ["videos", "Video"], ["news", "Berita"], ["settings", "Pengaturan"], ["texts", "Teks Website"]];
let badge, siteLink, view;

function paintBadge() {
  if (!badge) return;
  const s = state.sync.state;
  const T = { synced: ["ok", "Website sinkron"], pending: ["warn", "Belum dipublikasikan"], building: ["warn", "Sedang dibangun…"], unknown: ["muted", "Status tidak diketahui"], nosite: ["muted", "URL website kosong"], checking: ["muted", "Memeriksa…"] }[s] || ["muted", ""];
  badge.className = `badge badge--${T[0]}`; badge.textContent = T[1];
}
function updateSiteLink() { if (siteLink) { siteLink.hidden = !state.siteUrl; if (state.siteUrl) siteLink.href = state.siteUrl; } }

function showShell() {
  badge = h("a", { class: "badge badge--muted", href: "#/dashboard", title: "Lihat detail sinkron" }, "Memeriksa…");
  siteLink = h("a", { class: "btn btn--sm", href: "#", target: "_blank", rel: "noopener", hidden: true }, "Lihat website ↗");
  view = h("main", { id: "view", tabindex: "-1" });
  const nav = h("nav", { class: "side__nav", "aria-label": "Menu admin" }, NAV.map(([k, l]) => h("a", { href: `#/${k}`, "data-nav": k }, l)));
  app.replaceChildren(h("div", { class: "shell" },
    h("aside", { class: "side" },
      h("div", { class: "brand-wrap" }, h("span", { class: "brand" }, "Ari Nurdiman"), h("span", { class: "brand-sub" }, "Admin")), nav,
      h("div", { class: "side__foot" }, h("span", { class: "muted small" }, api.email),
        h("button", { class: "btn btn--sm btn--ghost", type: "button", onclick: async () => { await api.signOut(); location.hash = ""; start(); } }, "Keluar"))),
    h("div", { class: "main" },
      h("header", { class: "top" }, badge, h("div", { class: "top__actions" }, siteLink,
        h("button", { class: "btn btn--primary btn--sm", id: "publish-btn", type: "button", onclick: publish }, "Publish"))),
      view)));
  paintBadge();
  route();
  refreshSync(true);
}

/* ------------------------------------------------------------------ router */
function route() {
  if (!view) return;
  const parts = (location.hash.replace(/^#\/?/, "") || "dashboard").split("/");
  const [section, arg] = parts;
  document.querySelectorAll("[data-nav]").forEach((a) => a.setAttribute("aria-current", a.dataset.nav === section ? "page" : "false"));
  let node, title;
  switch (section) {
    case "dashboard": node = dashboardView(ctx); title = "Dashboard"; break;
    case "releases": node = arg ? releaseForm(ctx, arg) : releasesList(ctx); title = "Musik"; break;
    case "gallery": node = gallery(ctx); title = "Galeri"; break;
    case "videos": node = videos(ctx); title = "Video"; break;
    case "news": node = news(ctx); title = "Berita"; break;
    case "settings": node = settingsView(ctx); title = "Pengaturan"; break;
    case "texts": node = textsView(ctx); title = "Teks Website"; break;
    default: location.hash = "#/dashboard"; return;
  }
  listeners.clear();
  clear(view).append(node);
  document.title = `${title} | Admin Ari Nurdiman`;
  window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}
window.addEventListener("hashchange", route);

/* ------------------------------------------------------------------ login */
function showLogin(message) {
  const email = h("input", { type: "email", required: true, autocomplete: "username", id: "email" });
  const pass = h("input", { type: "password", required: true, autocomplete: "current-password", id: "password" });
  const err = h("p", { class: "form__error", role: "alert", hidden: !message }, message || "");
  const btn = h("button", { class: "btn btn--primary btn--block", type: "submit" }, "Masuk");
  const form = h("form", { class: "form" },
    h("div", { class: "field field--full" }, h("label", { class: "field__label", for: "email" }, "Email"), email),
    h("div", { class: "field field--full" }, h("label", { class: "field__label", for: "password" }, "Kata sandi"), pass), err, btn);
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); err.hidden = true; btn.disabled = true;
    try {
      await api.signIn(email.value.trim(), pass.value);
      if (!(await api.isAdmin())) { await api.signOut(); throw new Error("Akun ini belum terdaftar sebagai admin. Tambahkan ke tabel public.admins (lihat README)."); }
      showShell();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; }
  });
  app.replaceChildren(h("main", { class: "auth" }, h("div", { class: "auth__card" }, h("h1", { class: "brand" }, "Ari Nurdiman"), h("p", { class: "muted" }, "Masuk ke panel admin"), form)));
  email.focus();
}

async function start() {
  document.title = "Admin Ari Nurdiman";
  if (api.signedIn) {
    try { if (await api.isAdmin()) return showShell(); await api.signOut(); return showLogin("Akun ini bukan admin."); }
    catch { await api.signOut(); return showLogin("Sesi berakhir. Silakan masuk lagi."); }
  }
  showLogin();
}
if (configured) start(); else renderSetup();

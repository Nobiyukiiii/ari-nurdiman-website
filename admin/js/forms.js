import { h } from "./ui.js";

let uid = 0;
/** Label + control (+ help text). The control is nested inside the label for accessible naming. */
export function field(label, control, { help, full = false } = {}) {
  const id = `f${++uid}`;
  const hint = help ? h("small", { class: "help", id: `${id}-h` }, help) : null;
  if (control.setAttribute && control.tagName) { control.id ||= id; if (hint) control.setAttribute("aria-describedby", `${id}-h`); }
  return h("div", { class: `field${full ? " field--full" : ""}` }, h("label", { class: "field__label", for: control.id || id }, label), control, hint);
}
export const input = (o = {}) => h("input", { type: o.type || "text", value: o.value ?? "", placeholder: o.placeholder, maxlength: o.maxlength, required: o.required, min: o.min, max: o.max, autocomplete: "off", inputmode: o.inputmode });
export const textarea = (o = {}) => h("textarea", { rows: o.rows || 4, placeholder: o.placeholder, maxlength: o.maxlength, value: o.value ?? "" });
export function select(options, value) {
  const el = h("select", {}, options.map(([v, l]) => h("option", { value: v }, l)));
  el.value = value; return el;
}
export function checkbox(label, checked) {
  const box = h("input", { type: "checkbox", checked: !!checked });
  return { el: h("label", { class: "check" }, box, h("span", {}, label)), get value() { return box.checked; } };
}

/** Repeatable rows of small inputs (credits, links, tracks). */
export function rowsEditor({ columns, value = [], addLabel = "Tambah baris", max = 60 }) {
  const list = h("div", { class: "rows" });
  const rows = [];
  const add = (data = {}) => {
    if (rows.length >= max) return;
    const inputs = columns.map((c) => Object.assign(input({ value: data[c.key] ?? "", placeholder: c.placeholder }), {}));
    inputs.forEach((i, idx) => i.setAttribute("aria-label", columns[idx].label));
    const row = h("div", { class: "rows__row", style: { gridTemplateColumns: columns.map((c) => c.width || "1fr").join(" ") + " auto" } },
      inputs,
      h("button", { type: "button", class: "icon-btn", "aria-label": "Hapus baris", onclick: () => { rows.splice(rows.findIndex((r) => r.row === row), 1); row.remove(); } }, "×"));
    rows.push({ row, inputs });
    list.append(row);
  };
  value.forEach(add);
  const el = h("div", { class: "rows-wrap" }, list, h("button", { type: "button", class: "btn btn--sm btn--ghost", onclick: () => add() }, `+ ${addLabel}`));
  return {
    el,
    get value() {
      return rows.map((r) => Object.fromEntries(columns.map((c, i) => [c.key, r.inputs[i].value.trim()]))).filter((o) => Object.values(o).some(Boolean));
    },
  };
}

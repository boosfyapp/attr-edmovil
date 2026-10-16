/* Utilidades de interfaz del panel. Sin innerHTML: todo se construye con nodos DOM. */

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "class") el.className = value;
    else if (key === "value") el.value = value;
    else if (key === "checked" || key === "disabled" || key === "selected") el[key] = Boolean(value);
    else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/* ---------- avisos ---------- */
let toastHost;
export function toast(message, kind = "ok", ms = 3800) {
  toastHost ||= document.body.appendChild(h("div", { class: "toasts", "aria-live": "polite" }));
  const node = h("div", { class: `toast toast-${kind}` }, message);
  toastHost.append(node);
  setTimeout(() => node.remove(), ms);
}

/* ---------- diálogos ---------- */
export function modal({ title, body, actions = [], wide = false }) {
  return new Promise((resolve) => {
    const close = (value) => {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      resolve(value);
    };
    const onKey = (event) => { if (event.key === "Escape") close(null); };
    const overlay = h("div", { class: "overlay", onclick: (e) => { if (e.target === overlay) close(null); } },
      h("div", { class: `dialog${wide ? " dialog-wide" : ""}`, role: "dialog", "aria-modal": "true", "aria-label": title },
        h("h2", {}, title),
        h("div", { class: "dialog-body" }, body),
        h("div", { class: "dialog-actions" },
          actions.map((a) => h("button", { class: `btn ${a.kind ? `btn-${a.kind}` : ""}`, type: "button", onclick: () => close(a.value) }, a.label)))));
    document.addEventListener("keydown", onKey);
    document.body.append(overlay);
    overlay.querySelector("button.btn-primary, button.btn-danger, button")?.focus();
  });
}

export async function confirmDialog(title, message, { confirm = "Confirmar", kind = "primary" } = {}) {
  const result = await modal({
    title,
    body: h("p", {}, message),
    actions: [{ label: "Cancelar", value: false }, { label: confirm, value: true, kind }],
  });
  return result === true;
}

/* ---------- campos ---------- */
export function field(label, input, { hint, error, className = "" } = {}) {
  return h("label", { class: `field ${className}${error ? " has-error" : ""}` },
    h("span", { class: "field-label" }, label),
    input,
    hint ? h("span", { class: "field-hint" }, hint) : null,
    error ? h("span", { class: "field-error" }, error) : null);
}

export function textInput({ value = "", onInput, max, placeholder = "", type = "text", inputmode } = {}) {
  const input = h("input", { type, value: value ?? "", maxlength: max, placeholder, inputmode, autocomplete: "off" });
  input.addEventListener("input", () => onInput?.(input.value));
  return input;
}

export function textArea({ value = "", onInput, max, rows = 3, placeholder = "" } = {}) {
  const area = h("textarea", { rows, maxlength: max, placeholder }, value ?? "");
  area.addEventListener("input", () => onInput?.(area.value));
  return area;
}

/** Número: devuelve number cuando hay valor válido y "" cuando está vacío (el servidor lo marca como error al publicar). */
export function numberInput({ value, onInput, min = 0, step = "any", placeholder = "" } = {}) {
  const input = h("input", { type: "number", inputmode: "decimal", min, step, value: value ?? "", placeholder });
  input.addEventListener("input", () => {
    const raw = input.value.trim();
    onInput?.(raw === "" ? "" : Number(raw));
  });
  return input;
}

export function toggle({ checked = false, onChange, label }) {
  const input = h("input", { type: "checkbox", checked });
  input.addEventListener("change", () => onChange?.(input.checked));
  return h("span", { class: "toggle" }, input, h("span", { class: "toggle-track", "aria-hidden": "true" }), label ? h("span", { class: "toggle-label" }, label) : null);
}

export function select({ value, options, onChange }) {
  const el = h("select", {}, options.map((o) => h("option", { value: o.value, selected: o.value === value }, o.label)));
  el.addEventListener("change", () => onChange?.(el.value));
  return el;
}

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

export function debounce(fn, ms) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

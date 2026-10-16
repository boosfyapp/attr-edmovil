import { contrast, isHex } from "../lib/contrast.js";
import { confirmDialog, h } from "../ui.js";

const COLORS = [
  { key: "azul", label: "Azul AT&T", hint: "Botones principales, encabezados y planes Premium" },
  { key: "morado", label: "Morado", hint: "Etiquetas y planes Simple" },
  { key: "rosa", label: "Rosa", hint: "Planes Lite y detalles" },
  { key: "naranja", label: "Naranja", hint: "Etiquetas destacadas y cotizador" },
  { key: "whatsapp", label: "Verde de WhatsApp", hint: "Botones de WhatsApp" },
];

export function render(el, { store }) {
  const theme = () => store.content.theme;
  const defaults = store.schema.defaults.theme;
  const rows = h("div", { class: "color-rows" });
  const preview = h("div", { class: "color-preview" });

  function drawPreview() {
    const t = theme();
    preview.style.setProperty("--p-azul", t.azul);
    preview.style.setProperty("--p-morado", t.morado);
    preview.style.setProperty("--p-rosa", t.rosa);
    preview.style.setProperty("--p-naranja", t.naranja);
    preview.style.setProperty("--p-wa", t.whatsapp);
  }
  preview.append(
    h("div", { class: "p-title" }, "Así se ven los colores"),
    h("div", { class: "p-row" }, h("span", { class: "p-btn p-azul" }, "Botón principal"), h("span", { class: "p-btn p-wa" }, "WhatsApp")),
    h("div", { class: "p-row" }, h("span", { class: "p-tag p-morado" }, "Simple"), h("span", { class: "p-tag p-rosa" }, "Lite"), h("span", { class: "p-tag p-naranja" }, "Cotizador"), h("span", { class: "p-tag p-azul" }, "Premium")));

  function drawRows() {
    rows.replaceChildren(...COLORS.map(({ key, label, hint }) => {
      const warn = h("span", { class: "field-hint" });
      const hex = h("input", { type: "text", value: theme()[key], maxlength: 7, class: "hex-input", "aria-label": `${label} en formato #rrggbb` });
      const picker = h("input", { type: "color", value: isHex(theme()[key]) ? theme()[key] : "#000000", "aria-label": `Elegir ${label}` });
      const check = () => {
        const v = theme()[key];
        if (!isHex(v)) { warn.textContent = "Usa el formato #rrggbb (ej. #009fdb)."; warn.className = "field-error"; return; }
        const ratio = contrast(v, "#ffffff");
        warn.className = ratio < 3 ? "field-hint warn" : "field-hint";
        warn.textContent = ratio < 3
          ? `⚠ El texto blanco sobre este color se leerá poco (contraste ${ratio.toFixed(1)}:1; lo recomendado es 3:1 o más).`
          : `Contraste con texto blanco: ${ratio.toFixed(1)}:1 ✓`;
      };
      const set = (value) => { store.change((c) => { c.theme[key] = value; }); drawPreview(); check(); };
      picker.addEventListener("input", () => { hex.value = picker.value; set(picker.value); });
      hex.addEventListener("input", () => {
        const value = hex.value.trim().startsWith("#") ? hex.value.trim() : `#${hex.value.trim()}`;
        set(value);
        if (isHex(value)) picker.value = value;
      });
      check();
      return h("div", { class: "color-row" }, h("div", { class: "swatch-wrap" }, picker),
        h("div", { class: "color-info" }, h("strong", {}, label), h("span", { class: "muted" }, hint), warn), hex);
    }));
    drawPreview();
  }

  const reset = h("button", {
    class: "btn", type: "button",
    onclick: async () => {
      if (!(await confirmDialog("Restaurar colores", "¿Volver a los colores de marca originales? Se aplica al borrador; después publicas si estás de acuerdo.", { confirm: "Restaurar" }))) return;
      store.change((c) => { c.theme = { ...defaults }; });
      drawRows();
    },
  }, "Restaurar colores de marca");

  drawRows();
  el.append(
    h("p", { class: "lead" }, "Cambia los colores de la landing. Los tonos más oscuros y claros que usa el diseño se calculan solos a partir de cada color."),
    h("div", { class: "grid-2" }, h("section", { class: "panel" }, rows, h("div", { class: "row-actions" }, reset)), h("section", { class: "panel" }, preview,
      h("p", { class: "muted" }, "Para ver el efecto en toda la página usa «Vista previa»."))));
}

import { listEditor } from "../lib/list-editor.js";
import { h } from "../ui.js";

function zonesEditor(zones, onChange) {
  const wrap = h("div", { class: "zones" });
  const input = h("input", { type: "text", placeholder: "Nueva zona o municipio", maxlength: 80 });
  const add = () => {
    const value = input.value.trim();
    if (!value) return;
    zones.push(value);
    input.value = "";
    onChange();
    draw();
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
  const chips = h("div", { class: "chips" });
  function draw() {
    chips.replaceChildren(...zones.map((z, i) => h("span", { class: "chip" }, z, h("button", {
      type: "button", class: "chip-x", "aria-label": `Quitar ${z}`,
      onclick: () => { zones.splice(i, 1); onChange(); draw(); },
    }, "✕"))));
    if (!zones.length) chips.append(h("span", { class: "muted" }, "Sin zonas: la lista no se mostrará."));
  }
  draw();
  wrap.append(chips, h("div", { class: "zones-add" }, input, h("button", { class: "btn btn-primary", type: "button", onclick: add }, "Agregar")));
  return wrap;
}

export function render(el, { store }) {
  const c = store.content;
  const change = () => store.change(() => {});
  const faqs = listEditor({
    items: c.faqs, onChange: change, addLabel: "Agregar pregunta",
    title: (f) => f.q || "Pregunta sin texto",
    newItem: () => ({ q: "", a: "" }),
    fields: [
      { key: "q", label: "Pregunta", max: 200, span: 2 },
      { key: "a", label: "Respuesta", type: "textarea", rows: 4, max: 1500, span: 2 },
    ],
  });

  el.append(
    h("section", { class: "panel" }, h("h2", {}, "Preguntas frecuentes"), faqs),
    h("section", { class: "panel" }, h("h2", {}, "Zonas de atención a domicilio"), h("p", { class: "muted" }, "Municipios y colonias que aparecen en «Consulta cobertura en Puebla»."), zonesEditor(c.coverageZones, change)));
}

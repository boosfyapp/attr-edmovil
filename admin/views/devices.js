import { listEditor } from "../lib/list-editor.js";
import { h } from "../ui.js";

const money = (n) => (typeof n === "number" ? `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—");

export function render(el, { store }) {
  const c = store.content;
  const brandsHint = () => [...new Set(c.devices.map((d) => d.brand).filter(Boolean))].sort().join(", ");

  const editor = listEditor({
    items: c.devices, filter: true, reorder: false, addLabel: "Agregar equipo",
    onChange: () => store.change(() => {}),
    title: (d) => d.model || "Equipo sin nombre",
    summary: (d) => `${d.brand || "?"} · Plan ${d.plan || "?"} · ${money(d.monthly)}/mes${d.term ? ` · ${d.term}` : ""}`,
    badge: (d) => (d.hidden ? h("span", { class: "badge badge-off" }, "Oculto") : ""),
    thumb: (d) => (d.image ? h("img", { class: "thumb thumb-sm", src: `/${d.image}`, alt: "", loading: "lazy" }) : h("span", { class: "thumb thumb-sm thumb-empty" })),
    newItem: () => ({ brand: "", model: "", plan: "", monthly: "", term: "", image: "", hidden: false }),
    fields: [
      { key: "brand", label: "Marca", max: 40, hint: `Marcas actuales: ${brandsHint()}` },
      { key: "model", label: "Modelo", max: 120 },
      { key: "plan", label: "Plan", max: 40, hint: "Ej. Azul 3, Oro, Black" },
      { key: "monthly", label: "Mensualidad ($)", type: "money" },
      { key: "term", label: "Plazo", max: 40, hint: "Ej. 36 MESES" },
      { key: "hidden", label: "Visibilidad", type: "toggle", toggleLabel: "Ocultar de la landing" },
      { key: "image", label: "Foto del equipo", type: "image", span: 2 },
    ],
  });

  el.append(
    h("p", { class: "lead" }, "Catálogo de equipos con mensualidad. Un equipo oculto sigue guardado aquí pero no aparece en la landing. Para publicar, cada equipo visible necesita mensualidad y foto."),
    editor);
}

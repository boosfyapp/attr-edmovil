import { listEditor } from "../lib/list-editor.js";
import { h } from "../ui.js";

export function render(el, { store }) {
  const c = store.content;
  const change = () => store.change(() => {});
  const photo = (p) => (p.image ? h("img", { class: "thumb thumb-sm thumb-round", src: `/${p.image}`, alt: "", loading: "lazy" }) : h("span", { class: "thumb thumb-sm thumb-round thumb-empty" }));

  const team = listEditor({
    items: c.team, onChange: change, addLabel: "Agregar persona",
    title: (p) => p.name || "Sin nombre", summary: (p) => p.role,
    badge: (p) => (p.principal ? h("span", { class: "badge badge-live" }, "Gerente / principal") : ""),
    thumb: photo,
    newItem: () => ({ role: "Ejecutivo", name: "", image: "", principal: false }),
    fields: [
      { key: "name", label: "Nombre", max: 80 }, { key: "role", label: "Puesto", max: 40, hint: "Ej. Gerente, Ejecutivo, Ejecutiva" },
      { key: "principal", label: "Destacar", type: "toggle", toggleLabel: "Persona principal (tarjeta destacada)" },
      { key: "image", label: "Foto", type: "image" },
    ],
  });

  const stores = listEditor({
    items: c.stores, onChange: change, addLabel: "Agregar tienda", min: 1,
    title: (s) => s.name || "Tienda sin nombre", summary: (s) => s.address,
    badge: (s) => (s.principal ? h("span", { class: "badge badge-live" }, "Sucursal principal") : ""),
    newItem: () => ({ name: "", address: "", hours: "", map: "", principal: false }),
    fields: [
      { key: "name", label: "Nombre de la tienda", max: 80 },
      { key: "principal", label: "Destacar", type: "toggle", toggleLabel: "Sucursal principal" },
      { key: "address", label: "Dirección", type: "textarea", rows: 2, max: 220, span: 2 },
      { key: "hours", label: "Horario", max: 120, hint: "Ej. Lun–Sáb 10:00–20:00 · Dom 11:00–20:00", span: 2 },
      { key: "map", label: "Enlace de Google Maps", type: "url", span: 2, hint: "Debe empezar con https://" },
    ],
  });

  el.append(
    h("section", { class: "panel" }, h("h2", {}, "Equipo comercial"), h("p", { class: "muted" }, "Fotos y nombres de la sección «Tu tienda». Las fotos se recortan al centro en círculo."), team),
    h("section", { class: "panel" }, h("h2", {}, "Puntos de venta"), stores));
}

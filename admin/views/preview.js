import { h } from "../ui.js";

const SIZES = [
  { id: "mobile", label: "📱 Celular", width: 390 },
  { id: "tablet", label: "Tableta", width: 768 },
  { id: "desktop", label: "🖥️ Computadora", width: null },
];

export async function render(el, { store, publish }) {
  await store.flush();
  let size = "mobile";
  const frame = h("iframe", { class: "preview-frame", src: "/preview/", title: "Vista previa de la landing" });
  const stage = h("div", { class: "preview-stage" }, frame);

  const buttons = SIZES.map((s) => h("button", { class: "btn btn-small", type: "button", "data-size": s.id, onclick: () => { size = s.id; apply(); } }, s.label));
  function apply() {
    const def = SIZES.find((s) => s.id === size);
    frame.style.width = def.width ? `${def.width}px` : "100%";
    buttons.forEach((b) => b.classList.toggle("is-active", b.dataset.size === size));
  }
  apply();

  el.append(
    h("div", { class: "preview-bar" },
      h("div", { class: "row-actions" }, buttons),
      h("div", { class: "row-actions" },
        h("button", { class: "btn btn-small", type: "button", onclick: async () => { await store.flush(); frame.src = "/preview/"; } }, "Actualizar"),
        h("a", { class: "btn btn-small", href: "/preview/", target: "_blank", rel: "noopener" }, "Abrir en pestaña nueva"),
        h("button", { class: "btn btn-primary btn-small", type: "button", onclick: () => publish() }, "Publicar"))),
    h("p", { class: "muted" }, "Esta es la landing real con tu borrador. Lo que ves aquí todavía no es público hasta que pulses Publicar."),
    stage);
}

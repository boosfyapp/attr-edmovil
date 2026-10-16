import { couponStatus } from "../lib/coupon-status.js";
import { listEditor } from "../lib/list-editor.js";
import { h } from "../ui.js";

export function render(el, { store }) {
  const c = store.content;
  const editor = listEditor({
    items: c.coupons, reorder: true, addLabel: "Crear cupón",
    onChange: () => store.change(() => {}),
    title: (x) => x.title || "Cupón sin título",
    summary: (x) => (x.amount ? `$${Number(x.amount).toLocaleString("es-MX")} MXN` : "Sin monto"),
    badge: (x) => { const s = couponStatus(x); return h("span", { class: `badge badge-${s.key}` }, s.label); },
    thumb: (x) => (x.image ? h("img", { class: "thumb thumb-sm", src: `/${x.image}`, alt: "", loading: "lazy" }) : h("span", { class: "thumb thumb-sm thumb-empty" })),
    newItem: () => ({ id: `cupon-${Date.now().toString(36)}`, title: "", description: "", amount: "", product: "", image: "", active: true, from: "", to: "" }),
    fields: [
      { key: "active", label: "Estado", type: "toggle", toggleLabel: "Activo (se muestra en la landing)" },
      { key: "title", label: "Título", max: 80, hint: "Ej. $200 para servicio + equipo" },
      { key: "description", label: "Condiciones", type: "textarea", span: 2, max: 200, rows: 2, hint: "Texto breve bajo el título." },
      { key: "amount", label: "Monto del descuento ($ MXN)", type: "money" },
      { key: "product", label: "Aplica a (para el mensaje de WhatsApp)", max: 80, hint: "Ej. Plan Premium con equipo" },
      { key: "from", label: "Vigente desde (opcional)", type: "date" },
      { key: "to", label: "Vigente hasta (opcional)", type: "date", hint: "Después de esta fecha el cupón se oculta solo, sin volver a publicar." },
      { key: "image", label: "Imagen del cupón", type: "image", span: 2 },
    ],
  });

  el.append(
    h("p", { class: "lead" }, "Cupones que se solicitan por WhatsApp. Si no hay ninguno activo y vigente, la sección de cupones se oculta sola en la landing."),
    editor);
}

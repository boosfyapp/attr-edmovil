import { listEditor } from "../lib/list-editor.js";
import { h, numberInput } from "../ui.js";

const money = (n) => (typeof n === "number" ? `$${n.toLocaleString("es-MX")}` : "—");

/** Editor de los plazos de un plan Simple (meses, meses pagados, regalo y total). */
function termsEditor(plan, onChange) {
  const wrap = h("div", { class: "terms-editor" });
  const draw = () => {
    wrap.replaceChildren(
      h("div", { class: "terms-head" }, h("span", {}, "Meses"), h("span", {}, "Pagas"), h("span", {}, "De regalo"), h("span", {}, "Total ($)"), h("span", {})),
      ...plan.terms.map((term, i) => h("div", { class: "terms-row" },
        numberInput({ value: term.months, onInput: (v) => { term.months = v; onChange(); }, min: 1, placeholder: "Meses" }),
        numberInput({ value: term.pay, onInput: (v) => { term.pay = v; onChange(); }, min: 1, placeholder: "Pagas" }),
        numberInput({ value: term.free, onInput: (v) => { term.free = v; onChange(); }, min: 0, placeholder: "De regalo" }),
        numberInput({ value: term.total, onInput: (v) => { term.total = v; onChange(); }, min: 1, placeholder: "Total $" }),
        h("button", { class: "icon-btn icon-danger", type: "button", title: "Quitar plazo", "aria-label": "Quitar plazo", onclick: () => { if (plan.terms.length > 1) { plan.terms.splice(i, 1); onChange(); draw(); } } }, "✕"))),
      h("div", { class: "row-actions" },
        h("button", { class: "btn btn-small", type: "button", onclick: () => { plan.terms.push({ months: 12, pay: 8, free: 4, total: Math.round(8 * (Number(plan.price) || 0)) }); onChange(); draw(); } }, "+ Plazo"),
        h("button", { class: "btn btn-small", type: "button", onclick: () => { for (const t of plan.terms) t.total = Math.round((Number(t.pay) || 0) * (Number(plan.price) || 0)); onChange(); draw(); } }, "Recalcular totales (pagas × precio)")));
  };
  draw();
  return wrap;
}

export function render(el, { store }) {
  const c = store.content;
  const change = () => store.change(() => {});

  const section = (title, hint, node) => h("section", { class: "panel" }, h("h2", {}, title), hint ? h("p", { class: "muted" }, hint) : null, node);

  const premium = listEditor({
    items: c.plans.premium, onChange: change, addLabel: "Agregar plan Premium", min: 1,
    title: (p) => p.name || "Plan sin nombre", summary: (p) => `${money(p.price)}/mes · ${p.gb || "?"} GB`,
    newItem: () => ({ name: "", price: "", gb: "", note: "", hasAsterisk: false }),
    fields: [
      { key: "name", label: "Nombre", max: 60 }, { key: "price", label: "Precio mensual ($)", type: "money" }, { key: "gb", label: "GB", type: "number" },
      { key: "note", label: "Nota (opcional)", hint: "Ej. «Incluye iPhone 17 256GB…»", span: 2, max: 160 },
      { key: "hasAsterisk", label: "Asterisco (*) junto al precio", type: "toggle", toggleLabel: "Mostrar *" },
    ],
  });
  const lite = listEditor({
    items: c.plans.lite, onChange: change, addLabel: "Agregar plan Lite", min: 1,
    title: (p) => p.name || "Plan sin nombre", summary: (p) => `${money(p.price)}/mes · ${p.gb || "?"} GB · portabilidad ${p.portability || "?"}`,
    newItem: () => ({ name: "", price: "", gb: "", socials: 3, portability: "10%" }),
    fields: [
      { key: "name", label: "Nombre", max: 60 }, { key: "price", label: "Precio mensual ($)", type: "money" }, { key: "gb", label: "GB", type: "number" },
      { key: "socials", label: "Redes sociales ilimitadas", type: "number" }, { key: "portability", label: "Descuento por portabilidad", hint: "Ej. 20%", max: 12 },
    ],
  });
  const simple = listEditor({
    items: c.plans.simple, onChange: change, addLabel: "Agregar plan Simple", min: 1,
    title: (p) => p.name || "Plan sin nombre", summary: (p) => `${money(p.price)}/mes · ${p.gbBase || "?"} → ${p.gbDouble || "?"} GB`,
    newItem: () => ({ name: "", price: "", gbBase: "", gbDouble: "", terms: [{ months: 12, pay: 8, free: 4, total: "" }] }),
    fields: [
      { key: "name", label: "Nombre", max: 60 }, { key: "price", label: "Precio mensual ($)", type: "money" },
      { key: "gbBase", label: "GB base", type: "number" }, { key: "gbDouble", label: "GB duplicados", type: "number" },
      { key: "terms", label: "Plazos de pago anticipado", type: "custom", span: 2, render: (item, onChange) => termsEditor(item, onChange) },
    ],
  });
  const budgets = listEditor({
    items: c.budgetRanges, onChange: change, addLabel: "Agregar rango", min: 1,
    title: (r) => r.label || "Rango sin nombre", summary: (r) => r.tag,
    newItem: () => ({ id: `rango-${Date.now().toString(36)}`, label: "", tag: "", min: "", max: "" }),
    fields: [
      { key: "label", label: "Texto del botón", hint: "Ej. $450 – $1,000", max: 40 }, { key: "tag", label: "Descripción", max: 60 },
      { key: "min", label: "Mínimo ($)", type: "money" }, { key: "max", label: "Máximo ($)", type: "money" },
    ],
  });

  el.append(
    h("p", { class: "lead" }, "Precios y GB de los planes que se muestran en la landing y que usa el cotizador para recomendar opciones."),
    section("Premium (con equipo)", null, premium),
    section("Lite (solo servicio)", null, lite),
    section("Simple (anual)", "El total de cada plazo normalmente es «meses que pagas × precio mensual». Si no coincide, el panel te avisa al publicar pero te deja continuar.", simple),
    section("Cotizador por presupuesto", "Rangos de presupuesto mensual del cotizador. Cada rango sugiere planes cuyo precio cae entre mínimo y máximo.", budgets));
}

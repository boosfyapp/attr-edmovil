import { api } from "../api.js";
import { couponStatus } from "../lib/coupon-status.js";
import { fmtDate, h } from "../ui.js";

export async function render(el, { store, go, publish }) {
  const agent = await api.agent().catch(() => null);
  const c = store.content;
  const live = c.coupons.filter((x) => couponStatus(x).key === "live").length;
  const planCount = c.plans.premium.length + c.plans.lite.length + c.plans.simple.length;
  const shown = c.devices.filter((d) => !d.hidden).length;

  const statusCard = h("section", { class: "panel" },
    h("h2", {}, "Estado de la landing"),
    store.meta.publishedVersion
      ? h("p", {}, h("strong", {}, `Versión ${store.meta.publishedVersion} publicada`), ` · ${fmtDate(store.meta.publishedAt)}`)
      : h("p", {}, h("strong", {}, "Todavía no has publicado nada."), " La landing pública se ve igual que antes de usar el panel."),
    store.meta.dirty
      ? h("p", { class: "callout callout-warn" }, "Tienes cambios sin publicar. Revísalos en la vista previa y, cuando estén bien, pulsa Publicar.")
      : h("p", { class: "callout callout-ok" }, store.meta.publishedVersion ? "Todo lo que ves en el panel ya está publicado." : "No hay cambios por publicar: el panel muestra el contenido original de la landing."),
    h("div", { class: "row-actions" },
      h("button", { class: "btn", type: "button", onclick: () => go("vista-previa") }, "Ver vista previa"),
      h("button", { class: "btn btn-primary", type: "button", onclick: () => publish() }, "Publicar cambios")));

  const stat = (value, label, route) => h("button", { class: "stat", type: "button", onclick: () => go(route) }, h("strong", {}, value), h("span", {}, label));
  const summary = h("section", { class: "panel" },
    h("h2", {}, "Resumen"),
    h("div", { class: "stats" },
      stat(planCount, "planes", "planes"),
      stat(shown, `equipos visibles${c.devices.length !== shown ? ` (${c.devices.length - shown} ocultos)` : ""}`, "equipos"),
      stat(live, `cupón(es) vigente(s) de ${c.coupons.length}`, "cupones"),
      stat(c.stores.length, "tiendas", "equipo"),
      stat(c.team.length, "personas del equipo", "equipo"),
      stat(c.faqs.length, "preguntas frecuentes", "faq")));

  const how = h("section", { class: "panel" },
    h("h2", {}, "Cómo se usa"),
    h("ol", { class: "steps" },
      h("li", {}, h("strong", {}, "Edita."), " Cambia lo que necesites en cada sección. Se guarda solo en un borrador: nada se ve en la página pública todavía."),
      h("li", {}, h("strong", {}, "Revisa."), " En «Vista previa» ves la landing real con tus cambios, en celular y en computadora."),
      h("li", {}, h("strong", {}, "Publica."), " Con «Publicar» los cambios se ven al instante. Cada publicación queda en el Historial y puedes volver a una anterior."),
    ));

  const agentCard = agent?.enabled && !agent.upToDate
    ? h("section", { class: "panel" },
      h("h2", {}, "Agente IA de WhatsApp"),
      h("p", { class: "callout callout-warn" }, "Tu agente tiene información anterior a la que muestra hoy tu landing."),
      h("div", { class: "row-actions" }, h("button", { class: "btn btn-primary", type: "button", onclick: () => go("agente") }, "Ir a Actualizar Agente IA")))
    : null;
  el.append(h("div", { class: "grid-2" }, statusCard, summary), agentCard, how);
}

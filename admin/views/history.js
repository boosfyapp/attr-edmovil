import { api } from "../api.js";
import { confirmDialog, fmtDate, h, modal, toast } from "../ui.js";

/* Diferencias legibles entre dos versiones (resumen, no exhaustivo). */
function summarize(prev, next) {
  const lines = [];
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const textKeys = new Set([...Object.keys(prev.texts), ...Object.keys(next.texts)]);
  for (const key of textKeys) if (prev.texts[key] !== next.texts[key]) lines.push(`Texto «${key}» cambió`);
  for (const key of Object.keys(next.settings)) if (prev.settings[key] !== next.settings[key]) lines.push(`Ajuste ${key}: ${prev.settings[key] || "(vacío)"} → ${next.settings[key] || "(vacío)"}`);
  for (const key of Object.keys(next.theme)) if (prev.theme[key] !== next.theme[key]) lines.push(`Color ${key}: ${prev.theme[key]} → ${next.theme[key]}`);
  const compareList = (label, a, b, name, props) => {
    const byName = new Map(a.map((x) => [name(x), x]));
    for (const item of b) {
      const old = byName.get(name(item));
      if (!old) { lines.push(`${label}: se agregó «${name(item)}»`); continue; }
      for (const p of props) if (!eq(old[p], item[p])) lines.push(`${label} «${name(item)}»: ${p} ${JSON.stringify(old[p])} → ${JSON.stringify(item[p])}`);
      byName.delete(name(item));
    }
    for (const gone of byName.keys()) lines.push(`${label}: se quitó «${gone}»`);
  };
  for (const cat of ["premium", "lite", "simple"]) compareList(`Plan ${cat}`, prev.plans[cat], next.plans[cat], (p) => p.name, ["price", "gb", "terms", "portability", "note"]);
  compareList("Equipo", prev.devices, next.devices, (d) => d.model, ["monthly", "plan", "term", "image", "hidden"]);
  compareList("Cupón", prev.coupons, next.coupons, (c) => c.title || c.id, ["amount", "active", "from", "to", "image", "description"]);
  compareList("Tienda", prev.stores, next.stores, (s) => s.name, ["address", "hours", "map"]);
  compareList("Persona", prev.team, next.team, (p) => p.name, ["role", "image", "principal"]);
  compareList("Pregunta", prev.faqs, next.faqs, (f) => f.q, ["a"]);
  if (!eq(prev.coverageZones, next.coverageZones)) lines.push("Zonas de cobertura cambiaron");
  if (!eq(prev.budgetRanges, next.budgetRanges)) lines.push("Rangos del cotizador cambiaron");
  return lines;
}

export async function render(el, { store, go }) {
  const versions = await api.versions();
  if (!versions.length) {
    el.append(h("p", { class: "lead" }, "Aquí aparecerá cada versión que publiques, para que puedas revisarla o volver a ella."), h("p", { class: "empty" }, "Todavía no has publicado nada."));
    return;
  }

  async function view(version) {
    const full = await api.version(version.id);
    const previous = versions.find((v) => v.id === version.id - 1);
    const lines = previous ? summarize((await api.version(previous.id)).content, full.content) : ["Primera versión publicada (contenido completo)."];
    await modal({
      title: `Versión ${version.id} · ${fmtDate(version.createdAt)}`,
      body: h("div", {}, version.note ? h("p", {}, h("strong", {}, "Nota: "), version.note) : null,
        h("p", { class: "muted" }, previous ? `Cambios respecto a la versión ${previous.id}:` : ""),
        lines.length ? h("ul", { class: "error-list" }, lines.slice(0, 60).map((l) => h("li", {}, l))) : h("p", {}, "Sin cambios visibles respecto a la versión anterior."),
        lines.length > 60 ? h("p", { class: "muted" }, `…y ${lines.length - 60} más.`) : null),
      actions: [{ label: "Cerrar", value: true, kind: "primary" }], wide: true,
    });
  }

  async function restore(version) {
    const ok = await confirmDialog(`Restaurar la versión ${version.id}`,
      "Esta versión se cargará como borrador (reemplaza tu borrador actual). La landing pública no cambia hasta que pulses Publicar.", { confirm: "Cargar como borrador" });
    if (!ok) return;
    try {
      await api.restore(version.id);
      await store.reload();
      toast(`Versión ${version.id} cargada como borrador.`);
      go("inicio");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  const rows = versions.map((v) => h("tr", { class: v.id === store.meta.publishedVersion ? "is-current" : "" },
    h("td", {}, `v${v.id}`, v.id === store.meta.publishedVersion ? h("span", { class: "badge badge-live" }, "En vivo") : null),
    h("td", {}, fmtDate(v.createdAt)),
    h("td", {}, v.note || h("span", { class: "muted" }, "—")),
    h("td", { class: "td-actions" },
      h("button", { class: "btn btn-small", type: "button", onclick: () => view(v) }, "Ver cambios"),
      h("button", { class: "btn btn-small", type: "button", onclick: () => restore(v) }, "Restaurar"))));

  el.append(
    h("p", { class: "lead" }, "Cada publicación queda guardada. «Restaurar» la carga como borrador para que la revises antes de volver a publicar."),
    h("div", { class: "table-wrap" }, h("table", { class: "table" },
      h("thead", {}, h("tr", {}, h("th", {}, "Versión"), h("th", {}, "Fecha"), h("th", {}, "Nota"), h("th", {}, ""))),
      h("tbody", {}, rows))));
}

import { api } from "../api.js";
import { confirmDialog, fmtDate, h, toast } from "../ui.js";

export async function render(el) {
  let status = await api.agent();
  const host = h("div", {});
  el.append(host);

  async function copyPrompt(button) {
    try {
      const { prompt } = await api.agentPrompt();
      await navigator.clipboard.writeText(prompt);
      toast("Texto del agente copiado ✓");
    } catch {
      toast("No se pudo copiar. Selecciona el texto y cópialo a mano.", "error");
    }
    button.blur();
  }

  async function update(button) {
    const ok = await confirmDialog(
      "Actualizar Agente IA",
      "Se reemplazarán las instrucciones del agente en Boosfy con la información que hoy muestra tu landing publicada (planes, equipos, cupones, tiendas, preguntas…). No cambia tu clave API ni a qué número de WhatsApp está asignado.",
      { confirm: "Actualizar ahora" });
    if (!ok) return;
    button.disabled = true;
    button.textContent = "Actualizando…";
    try {
      await api.agentSync();
      toast("Agente IA actualizado ✓");
    } catch (error) {
      toast(error.message, "error", 7000);
    }
    status = await api.agent();
    draw();
  }

  async function showPrompt(box, toggleBtn) {
    if (!box.hidden) { box.hidden = true; toggleBtn.textContent = "Ver el texto que recibirá el agente"; return; }
    box.textContent = "Cargando…";
    box.hidden = false;
    try {
      box.textContent = (await api.agentPrompt()).prompt;
      toggleBtn.textContent = "Ocultar el texto";
    } catch (error) {
      box.textContent = error.message;
    }
  }

  function draw() {
    host.replaceChildren();
    const s = status;
    const badge = !s.enabled
      ? h("span", { class: "badge badge-off" }, "Sin configurar")
      : s.upToDate
        ? h("span", { class: "badge badge-live" }, "Al día ✓")
        : h("span", { class: "badge badge-warn" }, s.lastSync ? "Desactualizado" : "Nunca actualizado");

    const updateBtn = h("button", { class: "btn btn-primary", type: "button", disabled: !s.enabled }, "Actualizar Agente IA");
    updateBtn.addEventListener("click", () => update(updateBtn));

    const promptBox = h("pre", { class: "prompt-box", hidden: true });
    const showBtn = h("button", { class: "btn", type: "button" }, "Ver el texto que recibirá el agente");
    showBtn.addEventListener("click", () => showPrompt(promptBox, showBtn));
    const copyBtn = h("button", { class: "btn", type: "button" }, "Copiar texto");
    copyBtn.addEventListener("click", () => copyPrompt(copyBtn));

    host.append(
      h("p", { class: "lead" }, "Tu agente de WhatsApp contesta con la información de esta landing. Cuando cambies precios, equipos, cupones o textos y los publiques, pulsa el botón para que el agente también lo sepa."),
      h("section", { class: "panel" },
        h("div", { class: "agent-head" }, h("h2", {}, "Estado del agente"), badge),
        !s.enabled ? h("p", { class: "callout callout-warn" }, "La conexión con el agente de Boosfy todavía no está configurada. Escribe a Frace Solutions para activarla.") : null,
        s.enabled && s.lastSync
          ? h("p", {}, "Última actualización: ", h("strong", {}, fmtDate(s.lastSync.at)),
            s.lastSync.landingVersion ? ` · con la versión ${s.lastSync.landingVersion} de la landing` : " · con el contenido original de la landing")
          : null,
        s.enabled && !s.lastSync ? h("p", {}, "Todavía no se ha actualizado desde el panel.") : null,
        s.enabled && !s.upToDate && s.lastSync
          ? h("p", { class: "callout callout-warn" }, "Hay cambios publicados (o cupones que vencieron) que el agente aún no conoce. Pulsa «Actualizar Agente IA».")
          : null,
        s.enabled && s.upToDate ? h("p", { class: "callout callout-ok" }, "El agente tiene la misma información que tu landing publicada.") : null,
        s.lastError ? h("p", { class: "callout callout-warn" }, `Último intento fallido (${fmtDate(s.lastError.at)}): ${s.lastError.message}`) : null,
        h("div", { class: "row-actions" }, updateBtn)),
      h("section", { class: "panel" },
        h("h2", {}, "Qué hace este botón"),
        h("ul", { class: "agent-list" },
          h("li", {}, "Toma lo que está ", h("strong", {}, "publicado"), " en tu landing (los borradores no cuentan) y arma las instrucciones del agente con todos los planes, equipos, tiendas, cupones vigentes, zonas, preguntas frecuentes y avisos."),
          h("li", {}, "Las escribe en el flujo del agente en Boosfy. ", h("strong", {}, "No toca"), " tu clave API, el modelo ni el número de WhatsApp asignado."),
          h("li", {}, "Si alguien editó a mano las instrucciones dentro de Boosfy, este botón las reemplaza por las de la landing."),
          h("li", {}, "Si tienes el flujo abierto en Boosfy mientras actualizas, vuelve a cargar esa pantalla antes de guardar para no pisar el cambio.")),
        h("div", { class: "row-actions" }, showBtn, copyBtn),
        promptBox));
  }

  draw();
}

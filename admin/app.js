import { api, ApiError, setUnauthorizedHandler } from "./api.js";
import { describePath } from "./lib/paths.js";
import { store } from "./state.js";
import { clear, field, h, modal, textInput, toast, toggle } from "./ui.js";

const ROUTES = [
  { id: "inicio", label: "Inicio", icon: "🏠", load: () => import("./views/home.js") },
  { id: "textos", label: "Textos", icon: "✏️", load: () => import("./views/texts.js") },
  { id: "planes", label: "Planes", icon: "📶", load: () => import("./views/plans.js") },
  { id: "equipos", label: "Equipos", icon: "📱", load: () => import("./views/devices.js") },
  { id: "cupones", label: "Cupones", icon: "🎟️", load: () => import("./views/coupons.js") },
  { id: "equipo", label: "Equipo y tiendas", icon: "👥", load: () => import("./views/people-stores.js") },
  { id: "faq", label: "Preguntas y zonas", icon: "❓", load: () => import("./views/faq-zones.js") },
  { id: "apariencia", label: "Apariencia", icon: "🎨", load: () => import("./views/appearance.js") },
  { id: "agente", label: "Agente IA", icon: "🤖", load: () => import("./views/agent.js") },
  { id: "ajustes", label: "Ajustes", icon: "⚙️", load: () => import("./views/settings.js") },
  { id: "historial", label: "Historial", icon: "🕘", load: () => import("./views/history.js") },
  { id: "vista-previa", label: "Vista previa", icon: "👁️", load: () => import("./views/preview.js") },
];

const root = document.getElementById("app");
let shell = null;
let cleanup = null;
let conflictShown = false;
let unsubscribe = null;

/* ---------- login ---------- */
function showLogin(message = "") {
  cleanup?.();
  cleanup = null;
  shell = null;
  const error = h("p", { class: "login-error", role: "alert" }, message);
  const input = textInput({ type: "password", placeholder: "Contraseña" });
  input.autocomplete = "current-password";
  const button = h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Entrar");
  const form = h("form", { class: "login-card" },
    h("img", { class: "login-logo", src: "/assets/logo-claro-transparente.png", alt: "AT&T Barrio Cascatta" }),
    h("h1", {}, "Panel de la landing"),
    h("p", { class: "muted" }, "Edita textos, precios, fotos, colores y cupones de tu página."),
    field("Contraseña", input),
    error, button);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    error.textContent = "";
    try {
      await api.login(input.value);
      await start();
    } catch (e) {
      error.textContent = e.status === 429 ? "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." : e.message;
      button.disabled = false;
      input.select();
    }
  });
  clear(root).append(h("div", { class: "login-wrap" }, form));
  input.focus();
}

function showDisabled() {
  clear(root).append(h("div", { class: "login-wrap" }, h("div", { class: "login-card" },
    h("h1", {}, "Panel sin configurar"),
    h("p", { class: "muted" }, "Falta definir la contraseña del panel en el servidor. Contacta a Frace Solutions."))));
}

/* ---------- estructura ---------- */
const STATUS_TEXT = {
  idle: "", saved: "Guardado ✓", pending: "Cambios sin guardar…", saving: "Guardando…", error: "No se pudo guardar", conflict: "Conflicto de edición",
};

function buildShell() {
  const navLinks = ROUTES.map((r) => h("a", { class: "nav-link", href: `#/${r.id}`, "data-route": r.id }, h("span", { "aria-hidden": "true" }, r.icon), r.label));
  const status = h("button", { class: "save-status", type: "button", title: "Reintentar guardado", onclick: () => { if (store.status === "error") { store.status = "pending"; store.flush(); } } });
  const unpublished = h("span", { class: "dirty-dot", hidden: true }, "● Cambios sin publicar");
  const title = h("h1", { class: "page-title" });
  const view = h("main", { class: "view", id: "view" });
  const publish = h("button", { class: "btn btn-primary", type: "button", onclick: publishFlow }, "Publicar");
  const el = h("div", { class: "shell" },
    h("aside", { class: "sidebar" },
      h("a", { class: "brand", href: "#/inicio" }, h("img", { src: "/assets/logo-claro-transparente.png", alt: "AT&T Barrio Cascatta" }), h("span", {}, "Panel")),
      h("nav", { class: "nav" }, navLinks),
      h("a", { class: "nav-link site-link", href: "/", target: "_blank", rel: "noopener" }, h("span", { "aria-hidden": "true" }, "🌐"), "Ver landing"),
      h("button", { class: "nav-link logout", type: "button", onclick: async () => { try { await api.logout(); } finally { location.hash = ""; showLogin(); } } }, h("span", { "aria-hidden": "true" }, "🚪"), "Salir")),
    h("div", { class: "main" },
      h("header", { class: "topbar" }, title, h("div", { class: "topbar-right" }, unpublished, status, h("a", { class: "btn", href: "#/vista-previa" }, "Vista previa"), publish)),
      view));
  shell = { el, status, unpublished, title, view, navLinks };
  return el;
}

function refreshChrome() {
  if (!shell) return;
  const { status, unpublished } = shell;
  status.textContent = store.status === "error" ? `${STATUS_TEXT.error}: ${store.errorMessage} (clic para reintentar)` : STATUS_TEXT[store.status] || "";
  status.className = `save-status is-${store.status}`;
  unpublished.hidden = !store.meta.dirty;
  if (store.status === "conflict" && !conflictShown) {
    conflictShown = true;
    modal({
      title: "El borrador cambió en otro lugar",
      body: h("p", {}, "Alguien guardó cambios desde otra pestaña o dispositivo. Para no pisarlos, tus últimos cambios no se guardaron. Recarga para ver la versión más reciente."),
      actions: [{ label: "Recargar el borrador", value: true, kind: "primary" }],
    }).then(async () => {
      conflictShown = false;
      await store.reload();
      route();
    });
  }
}

async function route() {
  if (!shell) return;
  for (let i = 0; i < 3 && document.querySelector(".overlay"); i++) document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  document.querySelectorAll(".overlay").forEach((node) => node.remove());
  const id = (location.hash.match(/^#\/([\w-]+)/) || [])[1] || "inicio";
  const def = ROUTES.find((r) => r.id === id) || ROUTES[0];
  cleanup?.();
  cleanup = null;
  for (const link of shell.navLinks) link.classList.toggle("is-active", link.dataset.route === def.id);
  shell.title.textContent = def.label;
  document.title = `${def.label} · Panel AT&T`;
  clear(shell.view).append(h("p", { class: "muted" }, "Cargando…"));
  try {
    const mod = await def.load();
    clear(shell.view);
    cleanup = (await mod.render(shell.view, { store, go: (r) => { location.hash = `#/${r}`; }, publish: publishFlow })) || null;
    shell.view.scrollTop = 0;
    window.scrollTo(0, 0);
  } catch (error) {
    console.error(error);
    clear(shell.view).append(h("p", { class: "login-error" }, `No se pudo abrir esta pantalla: ${error.message}`));
  }
}

/* ---------- publicar ---------- */
async function showPublishErrors(errors) {
  const items = errors.map((e) => {
    const d = describePath(store.content, e.path);
    return h("li", {},
      h("a", { href: d.route, onclick: () => document.querySelector(".overlay")?.remove() }, [d.section, d.item, d.field].filter(Boolean).join(" › ")),
      h("span", {}, ` — ${e.message}`));
  });
  await modal({
    title: "Corrige esto antes de publicar",
    body: h("div", {}, h("p", {}, "Tu borrador sigue guardado. La landing pública no cambió."), h("ul", { class: "error-list" }, items)),
    actions: [{ label: "Entendido", value: true, kind: "primary" }],
    wide: true,
  });
}

async function publishFlow() {
  await store.flush();
  if (store.status === "error" || store.status === "conflict") return toast("Primero resuelve el problema de guardado.", "error");
  const noteInput = textInput({ placeholder: "Ej. Subí precios de octubre", max: 200 });
  const agent = await api.agent().catch(() => null);
  let updateAgent = Boolean(agent?.enabled);
  const agentRow = agent?.enabled
    ? h("div", { class: "agent-option" }, toggle({ checked: true, onChange: (v) => { updateAgent = v; }, label: "Actualizar también el Agente IA de WhatsApp" }),
      h("span", { class: "field-hint" }, "Así el agente contesta con los mismos precios y datos que acabas de publicar."))
    : null;
  const choice = await modal({
    title: "Publicar cambios",
    body: h("div", {},
      h("p", {}, store.meta.dirty ? "Los cambios del borrador se verán de inmediato en la landing pública." : "No hay cambios nuevos respecto a lo publicado; se creará una versión igual."),
      field("Nota (opcional)", noteInput, { hint: "Ayuda a reconocer esta versión en el historial." }),
      agentRow),
    actions: [{ label: "Cancelar", value: false }, { label: "Publicar ahora", value: true, kind: "primary" }],
  });
  if (!choice) return;
  try {
    const result = await api.publish(noteInput.value.trim());
    await store.reload();
    refreshChrome();
    toast(`Publicado ✓ — versión ${result.version}`);
    if (result.warnings?.length) toast(`${result.warnings.length} aviso(s) revisables en Planes.`, "warn");
    if (updateAgent) {
      try {
        await api.agentSync();
        toast("Agente IA actualizado ✓");
      } catch (agentError) {
        toast(`La landing se publicó, pero el Agente IA no se actualizó: ${agentError.message}`, "error", 8000);
      }
    }
    route();
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) return showPublishErrors(error.data.errors || []);
    toast(error.message, "error");
  }
}

/* ---------- arranque ---------- */
async function start() {
  try {
    await store.load();
  } catch (error) {
    if (error.status === 401) return showLogin();
    clear(root).append(h("p", { class: "login-error" }, `No se pudo cargar el panel: ${error.message}`));
    return;
  }
  clear(root).append(buildShell());
  unsubscribe?.();
  unsubscribe = store.subscribe(refreshChrome);
  refreshChrome();
  if (!location.hash) location.hash = "#/inicio";
  route();
}

setUnauthorizedHandler(() => showLogin("Tu sesión terminó. Vuelve a entrar para continuar."));
window.addEventListener("hashchange", route);
window.addEventListener("beforeunload", (event) => {
  if (store.hasUnsaved()) { event.preventDefault(); event.returnValue = ""; }
});

(async function boot() {
  try {
    const session = await api.session();
    if (!session.enabled) return showDisabled();
    if (!session.authenticated) return showLogin();
    await start();
  } catch (error) {
    clear(root).append(h("p", { class: "login-error" }, error.message));
  }
})();

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createAuth, createLimiter } from "./lib/auth.js";
import { HttpError, parseCookies, send, sendJson, sendText } from "./lib/http.js";
import { EMPTY_THEME_CSS, renderContentJs, renderEmptyContentJs, renderThemeCss } from "./lib/render.js";
import { serveStatic, isSiteFile } from "./lib/static.js";
import { createStore } from "./lib/store.js";
import { renderIndex, renderPreview } from "./lib/template.js";
import { createApi, SESSION_COOKIE } from "./routes/api.js";

const ADMIN_CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'";

/** Crea el servidor HTTP (sin escuchar). */
export function createApp(config) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const auth = createAuth({ dataDir: config.dataDir, envPassword: config.adminPassword });
  const store = createStore({ dataDir: config.dataDir, siteDir: config.siteDir });
  const limiter = createLimiter();
  const api = createApi({ config, auth, store, limiter });
  const ctx = { config, auth, store, api };

  return http.createServer(async (req, res) => {
    try {
      await handle(req, res, ctx);
    } catch (error) {
      if (error instanceof HttpError) {
        if (!res.headersSent) sendJson(res, error.status, { error: error.message, ...error.extra });
        return;
      }
      console.error("[error]", req.method, req.url, error);
      if (!res.headersSent) sendText(res, 500, "Error interno");
      else res.end();
    }
  });
}

const indexHtml = (config) => fs.readFileSync(path.join(config.siteDir, "index.html"), "utf8");
const html = (res, body, extra = {}) => send(res, 200, body, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", ...extra });

async function handle(req, res, { config, auth, store, api }) {
  const url = new URL(req.url, "http://localhost");
  const { pathname } = url;
  const method = req.method === "HEAD" ? "HEAD" : req.method;

  if (pathname === "/healthz") return sendText(res, 200, "ok", { "Cache-Control": "no-store" });

  if (pathname.startsWith("/api/")) {
    if (await api(req, res, url)) return;
    return sendJson(res, 404, { error: "No encontrado" });
  }

  if (method !== "GET" && method !== "HEAD") return sendText(res, 405, "Método no permitido");

  /* ---- panel ---- */
  if (pathname === "/admin") return send(res, 301, "", { Location: "/admin/" });
  if (pathname.startsWith("/admin/")) {
    const rel = pathname === "/admin/" ? "index.html" : pathname.slice("/admin/".length);
    /* no-store: Cloudflare cachea .js/.css aunque el origen diga no-cache; el panel debe verse siempre al día. */
    if (serveStatic(res, config.adminDir, rel, { method, headers: { "Content-Security-Policy": ADMIN_CSP, "Cache-Control": "no-store" } })) return;
    return sendText(res, 404, "No encontrado");
  }

  /* ---- vista previa del borrador (solo con sesión) ---- */
  if (pathname === "/preview" || pathname.startsWith("/preview/")) {
    if (!auth.verifyToken(parseCookies(req.headers.cookie || "")[SESSION_COOKIE])) return send(res, 302, "", { Location: "/admin/" });
    if (pathname === "/preview") return send(res, 301, "", { Location: "/preview/" });
    const rel = pathname.slice("/preview/".length);
    if (rel === "" || rel === "index.html") return html(res, renderPreview(indexHtml(config)));
    const draft = store.getDraft().content;
    if (rel === "draft-content.js") return send(res, 200, renderContentJs(draft, { version: 0 }), { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
    if (rel === "draft-theme.css") return send(res, 200, renderThemeCss(draft.theme), { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "no-store" });
    if (rel.startsWith("uploads/") && serveStatic(res, path.join(config.dataDir, "uploads"), rel.slice("uploads/".length), { immutable: true, method })) return;
    if (serveStatic(res, config.siteDir, rel, { allow: isSiteFile, method })) return;
    return sendText(res, 404, "No encontrado");
  }

  /* ---- contenido publicado ---- */
  if (pathname === "/published/content.js" || pathname === "/published/theme.css") {
    const published = store.getPublished();
    const isJs = pathname.endsWith(".js");
    const body = isJs ? (published?.contentJs ?? renderEmptyContentJs()) : (published?.themeCss ?? EMPTY_THEME_CSS);
    return send(res, 200, body, {
      "Content-Type": isJs ? "application/javascript; charset=utf-8" : "text/css; charset=utf-8",
      "Cache-Control": "no-cache",
    });
  }
  if (pathname.startsWith("/uploads/")) {
    if (serveStatic(res, path.join(config.dataDir, "uploads"), pathname.slice("/uploads/".length), { immutable: true, method })) return;
    return sendText(res, 404, "No encontrado");
  }

  /* ---- landing ---- */
  if (pathname === "/" || pathname === "/index.html") {
    const published = store.getPublished();
    return html(res, renderIndex(indexHtml(config), published?.version ?? 0));
  }
  if (serveStatic(res, config.siteDir, pathname, { allow: isSiteFile, method })) return;

  return send(res, 404, "No encontrado", { "Content-Type": "text/plain; charset=utf-8" });
}

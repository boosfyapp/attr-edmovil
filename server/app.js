import http from "node:http";
import { send, sendText } from "./lib/http.js";
import { serveStatic, isSiteFile } from "./lib/static.js";

/** Crea el servidor HTTP (sin escuchar). */
export function createApp(config) {
  return http.createServer(async (req, res) => {
    try {
      await handle(req, res, config);
    } catch (error) {
      console.error("[error]", req.method, req.url, error);
      if (!res.headersSent) sendText(res, 500, "Error interno");
      else res.end();
    }
  });
}

async function handle(req, res, config) {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;
  const method = req.method === "HEAD" ? "HEAD" : req.method;

  if (pathname === "/healthz") return sendText(res, 200, "ok", { "Cache-Control": "no-store" });

  if (method !== "GET" && method !== "HEAD") return sendText(res, 405, "Método no permitido");

  const target = pathname === "/" ? "/index.html" : pathname;
  if (serveStatic(res, config.siteDir, target, { allow: isSiteFile, method })) return;

  return send(res, 404, "No encontrado", { "Content-Type": "text/plain; charset=utf-8" });
}

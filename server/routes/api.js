import fs from "node:fs";
import path from "node:path";
import { AgentSyncError, agentStatus, currentAgentPrompt, syncAgent } from "../lib/agent-sync.js";
import { HttpError, parseCookies, readBody, readJson, sendJson } from "../lib/http.js";
import { buildSeed } from "../lib/seed.js";
import { ConflictError, NotFoundError, ValidationError } from "../lib/store.js";
import { extractTexts } from "../lib/template.js";
import { SECTION_ORDER, TEXT_LABELS } from "../lib/text-labels.js";
import { MAX_UPLOAD_BYTES, saveImage } from "../lib/uploads.js";

export const SESSION_COOKIE = "att_session";

export function clientIp(req) {
  return String(req.headers["cf-connecting-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "unknown");
}

function sessionCookie(config, value, maxAge) {
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${config.insecureCookies ? "" : "; Secure"}`;
}

/** Textos editables con su valor por defecto (el del HTML). Se calcula una vez por arranque. */
function buildTextSchema(siteDir) {
  const html = fs.readFileSync(path.join(siteDir, "index.html"), "utf8");
  const found = new Map(extractTexts(html).map((t) => [t.key, t]));
  const order = (s) => {
    const i = SECTION_ORDER.indexOf(s);
    return i < 0 ? SECTION_ORDER.length : i;
  };
  return Object.entries(TEXT_LABELS)
    .map(([key, meta]) => ({ key, label: meta.label, section: meta.section, long: meta.long, attr: found.get(key)?.attr ?? null, default: found.get(key)?.value ?? "" }))
    .sort((a, b) => order(a.section) - order(b.section));
}

export function createApi({ config, auth, store, limiter }) {
  let textSchema = null;
  const isAuthed = (req) => auth.verifyToken(parseCookies(req.headers.cookie || "")[SESSION_COOKIE]);

  /** @returns {Promise<boolean>} true si la ruta era de la API */
  return async function handleApi(req, res, url) {
    const { pathname } = url;
    const method = req.method;
    const write = method !== "GET" && method !== "HEAD";

    if (write) {
      if (req.headers["x-requested-with"] !== "att-admin") throw new HttpError(403, "Solicitud no permitida");
      const origin = req.headers.origin;
      if (origin && req.headers.host) {
        let originHost = null;
        try { originHost = new URL(origin).host; } catch { /* origen malformado */ }
        if (originHost !== req.headers.host) throw new HttpError(403, "Origen no permitido");
      }
    }

    try {
      /* ---------- sin sesión ---------- */
      if (pathname === "/api/session" && method === "GET") {
        return sendJson(res, 200, { authenticated: Boolean(isAuthed(req)), enabled: auth.enabled() }), true;
      }
      if (pathname === "/api/login" && method === "POST") {
        if (!auth.enabled()) throw new HttpError(503, "El panel no está configurado todavía");
        const ip = clientIp(req);
        const gate = limiter.check(ip);
        if (!gate.allowed) {
          res.setHeader("Retry-After", String(gate.retryAfter));
          throw new HttpError(429, "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.", { retryAfter: gate.retryAfter });
        }
        const body = await readJson(req, 10_000);
        if (!auth.checkPassword(body.password)) {
          limiter.fail(ip);
          throw new HttpError(401, "Contraseña incorrecta");
        }
        limiter.reset(ip);
        return sendJson(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(config, auth.issueToken(), 43200) }), true;
      }
      if (pathname === "/api/logout" && method === "POST") {
        return sendJson(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(config, "", 0) }), true;
      }

      /* ---------- con sesión ---------- */
      if (!pathname.startsWith("/api/")) return false;
      if (!isAuthed(req)) throw new HttpError(401, "Inicia sesión para continuar");

      if (pathname === "/api/schema" && method === "GET") {
        textSchema ||= buildTextSchema(config.siteDir);
        return sendJson(res, 200, { texts: textSchema, sections: SECTION_ORDER, defaults: buildSeed(config.siteDir) }), true;
      }
      if (pathname === "/api/draft" && method === "GET") return sendJson(res, 200, store.getDraft()), true;
      if (pathname === "/api/draft" && method === "PUT") {
        const body = await readJson(req, 2 * 1024 * 1024);
        const saved = store.saveDraft(body.content, body.baseRevision);
        return sendJson(res, 200, { revision: saved.revision, updatedAt: saved.updatedAt, dirty: saved.dirty, publishedVersion: saved.publishedVersion }), true;
      }
      if (pathname === "/api/validate" && method === "POST") {
        const body = await readJson(req, 2 * 1024 * 1024);
        return sendJson(res, 200, store.validate(body.content)), true;
      }
      if (pathname === "/api/publish" && method === "POST") {
        const body = await readJson(req, 10_000);
        return sendJson(res, 200, store.publish(body.note)), true;
      }
      if (pathname === "/api/versions" && method === "GET") return sendJson(res, 200, store.listVersions()), true;

      const versionMatch = pathname.match(/^\/api\/versions\/(\d+)(\/restore)?$/);
      if (versionMatch) {
        const id = Number(versionMatch[1]);
        if (!versionMatch[2] && method === "GET") return sendJson(res, 200, store.getVersion(id)), true;
        if (versionMatch[2] && method === "POST") return sendJson(res, 200, store.restore(id)), true;
      }

      if (pathname === "/api/uploads" && method === "POST") {
        const buffer = await readBody(req, MAX_UPLOAD_BYTES);
        return sendJson(res, 200, saveImage(config.dataDir, buffer)), true;
      }
      if (pathname === "/api/agent" && method === "GET") return sendJson(res, 200, agentStatus({ config, store })), true;
      if (pathname === "/api/agent/prompt" && method === "GET") {
        const current = currentAgentPrompt({ store, siteDir: config.siteDir });
        return sendJson(res, 200, { prompt: current.prompt, landingVersion: current.landingVersion }), true;
      }
      if (pathname === "/api/agent/sync" && method === "POST") {
        try {
          return sendJson(res, 200, await syncAgent({ config, store })), true;
        } catch (error) {
          if (error instanceof AgentSyncError) throw new HttpError(error.status, error.message, { code: error.code });
          throw error;
        }
      }
      if (pathname === "/api/password" && method === "POST") {
        const body = await readJson(req, 10_000);
        try {
          auth.changePassword(body.current, body.next);
        } catch (error) {
          throw new HttpError(error.message.includes("actual") ? 401 : 400, error.message);
        }
        // la sesión actual quedó invalidada por el cambio: emitir una nueva
        return sendJson(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(config, auth.issueToken(), 43200) }), true;
      }
      throw new HttpError(404, "No encontrado");
    } catch (error) {
      if (error instanceof ConflictError) return sendJson(res, 409, { error: error.message, revision: error.revision }), true;
      if (error instanceof ValidationError) return sendJson(res, error.errors?.[0]?.path === "" ? 400 : 422, { error: error.message, errors: error.errors, warnings: error.warnings }), true;
      if (error instanceof NotFoundError) return sendJson(res, 404, { error: error.message }), true;
      if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message, ...error.extra }), true;
      throw error;
    }
  };
}

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { startApp } from "./helpers.js";

const PASSWORD = "clave-de-prueba-123";
const TOKEN = "token-de-prueba-0123456789abcdef0123456789";
const H = { "X-Requested-With": "att-admin" };

/** Exportador falso: registra las peticiones y responde según `behavior`. */
async function fakeExporter() {
  const state = { requests: [], behavior: { status: 200, body: { ok: true, updated: "boosfy" }, delay: 0 } };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      state.requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: JSON.parse(Buffer.concat(chunks).toString() || "{}") });
      setTimeout(() => {
        res.writeHead(state.behavior.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(state.behavior.body));
      }, state.behavior.delay);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  state.url = `http://127.0.0.1:${server.address().port}`;
  state.close = () => new Promise((resolve) => server.close(resolve));
  return state;
}

function client(base) {
  let cookie = "";
  const call = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" ? H : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  return { get: (u) => call("GET", u), post: (u, b) => call("POST", u, b ?? {}), put: (u, b) => call("PUT", u, b) };
}

describe("Actualizar Agente IA", () => {
  let exporter, app, c;
  before(async () => {
    exporter = await fakeExporter();
    app = await startApp({ agent: { url: exporter.url, token: TOKEN, flowId: 762, production: false } });
    c = client(app.base);
    await c.post("/api/login", { password: PASSWORD });
  });
  after(async () => { await app.close(); await exporter.close(); });

  it("requiere sesión y el encabezado anti-CSRF", async () => {
    const anon = client(app.base);
    assert.equal((await anon.get("/api/agent")).status, 401);
    assert.equal((await anon.post("/api/agent/sync")).status, 401);
    const res = await fetch(`${app.base}/api/agent/sync`, { method: "POST" });
    assert.equal(res.status, 403);
  });

  it("al inicio está habilitado, nunca sincronizado y no al día", async () => {
    const s = (await c.get("/api/agent")).data;
    assert.equal(s.enabled, true);
    assert.equal(s.flowId, 762);
    assert.equal(s.lastSync, null);
    assert.equal(s.upToDate, false);
    assert.ok(s.promptChars > 8000);
    assert.equal(JSON.stringify(s).includes(TOKEN), false, "el estado no debe filtrar la llave");
  });

  it("sincroniza: envía el prompt actual con la llave limitada y el id del flujo", async () => {
    exporter.requests.length = 0;
    const res = await c.post("/api/agent/sync");
    assert.equal(res.status, 200);
    assert.equal(res.data.ok, true);
    assert.equal(exporter.requests.length, 1);
    const r = exporter.requests[0];
    assert.equal(r.method, "POST");
    assert.equal(r.url, "/write-prompt");
    assert.equal(r.auth, `Bearer ${TOKEN}`);
    assert.equal(r.body.boosfyFlowId, 762);
    assert.match(r.body.promptContent, /Azul 2: \$485\/mes/);
    const { prompt } = (await c.get("/api/agent/prompt")).data;
    assert.equal(r.body.promptContent, prompt);
    const s = (await c.get("/api/agent")).data;
    assert.equal(s.upToDate, true);
    assert.equal(s.lastSync.landingVersion, null);
    assert.equal(s.lastError, null);
    assert.equal(fs.readFileSync(path.join(app.config.dataDir, "agent.json"), "utf8").includes(TOKEN), false);
  });

  it("un borrador sin publicar NO cambia lo que sabe el agente; al publicar queda desactualizado", async () => {
    const draft = (await c.get("/api/draft")).data;
    draft.content.plans.premium[0].price = 523;
    await c.put("/api/draft", { baseRevision: draft.revision, content: draft.content });
    assert.equal((await c.get("/api/agent")).data.upToDate, true, "el borrador aún no es público");
    assert.match((await c.get("/api/agent/prompt")).data.prompt, /Azul 2: \$485\/mes/);

    assert.equal((await c.post("/api/publish", { note: "precio" })).status, 200);
    const stale = (await c.get("/api/agent")).data;
    assert.equal(stale.upToDate, false);
    assert.equal(stale.landingVersion, 1);

    exporter.requests.length = 0;
    assert.equal((await c.post("/api/agent/sync")).status, 200);
    assert.match(exporter.requests[0].body.promptContent, /Azul 2: \$523\/mes/);
    assert.equal(exporter.requests[0].body.versionNumber, 1);
    const fresh = (await c.get("/api/agent")).data;
    assert.equal(fresh.upToDate, true);
    assert.equal(fresh.lastSync.landingVersion, 1);
  });

  it("traduce los errores de Boosfy y conserva la última sincronización buena", async () => {
    const before = (await c.get("/api/agent")).data.lastSync;
    const cases = [
      [403, { error: "FLOW_NOT_ALLOWED" }, "FLOW_NOT_ALLOWED"],
      [401, { error: "UNAUTHORIZED" }, "UNAUTHORIZED"],
      [404, { error: "FLOW_NOT_FOUND" }, "FLOW_NOT_FOUND"],
      [422, { error: "AI_ASSISTANT_NODE_NOT_FOUND" }, "NO_AI_NODE"],
      [500, { error: "INTERNAL_ERROR" }, "BOOSFY_ERROR"],
    ];
    for (const [status, body, code] of cases) {
      exporter.behavior = { status, body, delay: 0 };
      const res = await c.post("/api/agent/sync");
      assert.equal(res.status, 502, String(status));
      assert.equal(res.data.code, code, String(status));
      assert.ok(res.data.error.length > 10);
    }
    const s = (await c.get("/api/agent")).data;
    assert.equal(s.lastError.code, "BOOSFY_ERROR");
    assert.deepEqual(s.lastSync, before, "la última sincronización exitosa no se pierde");
    exporter.behavior = { status: 200, body: { ok: true }, delay: 0 };
    assert.equal((await c.post("/api/agent/sync")).status, 200);
    assert.equal((await c.get("/api/agent")).data.lastError, null);
  });

  it("evita dos actualizaciones al mismo tiempo", async () => {
    exporter.behavior = { status: 200, body: { ok: true }, delay: 400 };
    const [a, b] = await Promise.all([c.post("/api/agent/sync"), c.post("/api/agent/sync")]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    exporter.behavior = { status: 200, body: { ok: true }, delay: 0 };
  });
});

describe("Agente IA sin configurar o sin conexión", () => {
  it("sin variables de entorno el botón queda deshabilitado (503) y el panel sigue normal", async () => {
    const app = await startApp({ agent: { url: "", token: "", flowId: 0, production: false } });
    try {
      const c = client(app.base);
      await c.post("/api/login", { password: PASSWORD });
      const s = (await c.get("/api/agent")).data;
      assert.equal(s.enabled, false);
      assert.equal(s.flowId, null);
      const res = await c.post("/api/agent/sync");
      assert.equal(res.status, 503);
      assert.equal(res.data.code, "DISABLED");
      assert.equal((await c.get("/api/draft")).status, 200);
    } finally { await app.close(); }
  });

  it("si Boosfy no responde devuelve un error claro", async () => {
    const app = await startApp({ agent: { url: "http://127.0.0.1:1", token: TOKEN, flowId: 762, production: false } });
    try {
      const c = client(app.base);
      await c.post("/api/login", { password: PASSWORD });
      const res = await c.post("/api/agent/sync");
      assert.equal(res.status, 502);
      assert.equal(res.data.code, "NETWORK");
    } finally { await app.close(); }
  });

  it("en producción exige HTTPS", async () => {
    const app = await startApp({ agent: { url: "http://boosfy.example", token: TOKEN, flowId: 762, production: true } });
    try {
      const c = client(app.base);
      await c.post("/api/login", { password: PASSWORD });
      assert.equal((await c.post("/api/agent/sync")).data.code, "INSECURE_URL");
    } finally { await app.close(); }
  });
});

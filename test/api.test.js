import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { startApp, tmpDir } from "./helpers.js";

const PASSWORD = "clave-de-prueba-123";
const H = { "X-Requested-With": "att-admin" };

function client(base) {
  let cookie = "";
  const call = async (method, url, { body, headers = {}, raw } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body && !raw ? { "Content-Type": "application/json" } : {}), ...headers },
      body: raw ?? (body ? JSON.stringify(body) : undefined),
      redirect: "manual",
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : await res.text();
    return { status: res.status, data, headers: res.headers };
  };
  return {
    call,
    get: (url, o) => call("GET", url, o),
    post: (url, body, o) => call("POST", url, { body, headers: H, ...o }),
    put: (url, body, o) => call("PUT", url, { body, headers: H, ...o }),
    login: (password = PASSWORD) => call("POST", "/api/login", { body: { password }, headers: H }),
  };
}

describe("API del panel", () => {
  let app;
  before(async () => { app = await startApp(); });
  after(async () => { await app.close(); });

  describe("autenticación", () => {
    it("sin sesión las rutas protegidas devuelven 401", async () => {
      const c = client(app.base);
      for (const url of ["/api/draft", "/api/schema", "/api/versions"]) {
        assert.equal((await c.get(url)).status, 401, url);
      }
      assert.equal((await c.post("/api/publish", {})).status, 401);
    });

    it("las escrituras sin X-Requested-With o con otro origen se rechazan (403)", async () => {
      const c = client(app.base);
      assert.equal((await c.call("POST", "/api/login", { body: { password: PASSWORD } })).status, 403);
      assert.equal((await c.call("POST", "/api/login", { body: { password: PASSWORD }, headers: { ...H, Origin: "https://evil.example" } })).status, 403);
    });

    it("login correcto da sesión; incorrecto da 401", async () => {
      const c = client(app.base);
      assert.equal((await c.login("incorrecta")).status, 401);
      const ok = await c.login();
      assert.equal(ok.status, 200);
      assert.match(ok.headers.get("set-cookie"), /HttpOnly/);
      assert.match(ok.headers.get("set-cookie"), /SameSite=Strict/);
      assert.deepEqual((await c.get("/api/session")).data, { authenticated: true, enabled: true });
      assert.equal((await c.get("/api/draft")).status, 200);
    });

    it("limita los intentos de login (429 al sexto fallo)", async () => {
      const other = await startApp();
      try {
        const c = client(other.base);
        for (let i = 0; i < 5; i++) assert.equal((await c.login("mala")).status, 401);
        const blocked = await c.login(PASSWORD);
        assert.equal(blocked.status, 429);
        assert.ok(Number(blocked.headers.get("retry-after")) > 0);
      } finally {
        await other.close();
      }
    });

    it("sin contraseña configurada el login responde 503", async () => {
      const other = await startApp({ adminPassword: "" });
      try {
        assert.equal((await client(other.base).login("x")).status, 503);
        assert.equal((await fetch(`${other.base}/`)).status, 200);
      } finally {
        await other.close();
      }
    });

    it("logout borra la sesión", async () => {
      const c = client(app.base);
      await c.login();
      await c.post("/api/logout", {});
      assert.equal((await c.get("/api/draft")).status, 401);
    });
  });

  describe("borrador, publicar y restaurar", () => {
    it("ciclo completo: guardar → publicar → ver en la landing → restaurar", async () => {
      const other = await startApp();
      try {
        const c = client(other.base);
        await c.login();

        // antes de publicar la landing no tiene contenido publicado
        assert.equal((await c.get("/published/content.js")).data.trim(), "window.SITE_CONTENT=null;");
        assert.match((await c.get("/")).data, /published\/content\.js\?v=0/);

        const draft = (await c.get("/api/draft")).data;
        assert.equal(draft.revision, 1);
        draft.content.plans.premium[0].price = 499;
        draft.content.texts["hero.titulo"] = "Título nuevo";
        draft.content.theme.azul = "#112233";
        const saved = await c.put("/api/draft", { baseRevision: 1, content: draft.content });
        assert.equal(saved.status, 200);
        assert.equal(saved.data.revision, 2);

        // lo guardado aún no es público
        assert.equal((await c.get("/published/content.js")).data.trim(), "window.SITE_CONTENT=null;");

        const pub = await c.post("/api/publish", { note: "cambio de prueba" });
        assert.equal(pub.status, 200);
        assert.equal(pub.data.version, 1);

        const js = (await c.get("/published/content.js")).data;
        assert.match(js, /"price":499/);
        assert.match(js, /Título nuevo/);
        assert.match((await c.get("/published/theme.css")).data, /--att-blue:#112233/);
        assert.match((await c.get("/")).data, /published\/content\.js\?v=1/);
        assert.match((await c.get("/")).data, /published\/theme\.css\?v=1/);
        // la landing pública no requiere sesión
        assert.equal((await fetch(`${other.base}/published/content.js`)).status, 200);

        const versions = (await c.get("/api/versions")).data;
        assert.equal(versions.length, 1);
        assert.equal(versions[0].note, "cambio de prueba");

        // segundo cambio y restaurar la versión 1
        const d2 = (await c.get("/api/draft")).data;
        assert.equal(d2.dirty, false);
        d2.content.plans.premium[0].price = 1;
        await c.put("/api/draft", { baseRevision: d2.revision, content: d2.content });
        const restored = await c.post("/api/versions/1/restore", {});
        assert.equal(restored.status, 200);
        assert.equal(restored.data.content.plans.premium[0].price, 499);
        assert.equal((await c.post("/api/versions/99/restore", {})).status, 404);
      } finally {
        await other.close();
      }
    });

    it("409 con una revisión vieja; 422 con errores al publicar", async () => {
      const other = await startApp();
      try {
        const c = client(other.base);
        await c.login();
        const d = (await c.get("/api/draft")).data;
        await c.put("/api/draft", { baseRevision: 1, content: d.content });
        const conflict = await c.put("/api/draft", { baseRevision: 1, content: d.content });
        assert.equal(conflict.status, 409);
        assert.equal(conflict.data.revision, 2);

        d.content.plans.premium[0].price = 0;
        await c.put("/api/draft", { baseRevision: 2, content: d.content });
        const bad = await c.post("/api/publish", {});
        assert.equal(bad.status, 422);
        assert.equal(bad.data.errors[0].path, "plans.premium[0].price");
        assert.equal((await c.get("/published/content.js")).data.trim(), "window.SITE_CONTENT=null;");

        const v = await c.post("/api/validate", {});
        assert.equal(v.data.errors.length, 1);
        assert.equal((await c.put("/api/draft", { baseRevision: 3, content: [] })).status, 400);
      } finally {
        await other.close();
      }
    });

    it("/api/schema trae los textos con su valor por defecto", async () => {
      const c = client(app.base);
      await c.login();
      const { texts, defaults, sections } = (await c.get("/api/schema")).data;
      assert.ok(texts.length >= 150);
      const hero = texts.find((t) => t.key === "hero.titulo");
      assert.equal(hero.default, "Tu plan. Tu equipo. La atención que se adapta a ti.");
      assert.equal(texts.find((t) => t.key === "wa.sucursal").attr, "data-wa-text");
      assert.ok(sections.length > 10);
      assert.equal(defaults.coupons.length, 2);
    });
  });

  describe("vista previa", () => {
    it("exige sesión y muestra el borrador sin tocar lo publicado", async () => {
      const c = client(app.base);
      assert.equal((await c.get("/preview/")).status, 302);
      await c.login();
      const draft = (await c.get("/api/draft")).data;
      draft.content.texts["hero.sub"] = "Subtítulo solo en borrador";
      await c.put("/api/draft", { baseRevision: draft.revision, content: draft.content });
      const page = await c.get("/preview/");
      assert.equal(page.status, 200);
      assert.match(page.data, /draft-content\.js/);
      assert.match(page.data, /VISTA PREVIA/);
      assert.match((await c.get("/preview/draft-content.js")).data, /Subtítulo solo en borrador/);
      assert.match((await c.get("/preview/draft-theme.css")).data, /--att-blue:/);
      assert.equal((await c.get("/preview/styles.css")).status, 200);
      assert.equal((await c.get("/preview/assets/cupon-premium-200.png")).status, 200);
      assert.doesNotMatch((await c.get("/published/content.js")).data, /Subtítulo solo en borrador/);
      assert.equal((await fetch(`${app.base}/preview/draft-content.js`, { redirect: "manual" })).status, 302);
    });
  });

  describe("subida de imágenes", () => {
    const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([4, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(20)]);
    const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
    const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
    const upload = (c, buffer, type = "image/webp") => c.call("POST", "/api/uploads", { raw: buffer, headers: { ...H, "Content-Type": type } });

    it("acepta WebP/PNG/JPG por firma, usa el hash como nombre y las sirve inmutables", async () => {
      const c = client(app.base);
      await c.login();
      const a = await upload(c, WEBP);
      assert.equal(a.status, 200);
      assert.match(a.data.path, /^uploads\/[0-9a-f]{32}\.webp$/);
      assert.equal((await upload(c, WEBP)).data.path, a.data.path, "mismo contenido, mismo nombre");
      assert.match((await upload(c, PNG, "image/png")).data.path, /\.png$/);
      assert.match((await upload(c, JPG, "image/jpeg")).data.path, /\.jpg$/);
      const served = await fetch(`${app.base}/${a.data.path}`);
      assert.equal(served.status, 200);
      assert.equal(served.headers.get("content-type"), "image/webp");
      assert.match(served.headers.get("cache-control"), /immutable/);
    });

    it("rechaza SVG, HTML y texto aunque se declaren como imagen; vacío y grande", async () => {
      const c = client(app.base);
      await c.login();
      for (const body of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "<html></html>", "GIF89a....", "hola"]) {
        assert.equal((await upload(c, Buffer.from(body), "image/png")).status, 400, body);
      }
      assert.equal((await upload(c, Buffer.alloc(0))).status, 400);
      const big = Buffer.concat([WEBP, Buffer.alloc(5 * 1024 * 1024)]);
      assert.equal((await upload(c, big)).status, 413);
    });

    it("requiere sesión", async () => {
      assert.equal((await upload(client(app.base), WEBP)).status, 401);
    });

    it("no sirve /uploads con traversal", async () => {
      const res = await fetch(`${app.base}/uploads/..%2f..%2fpackage.json`);
      assert.equal(res.status, 404);
    });
  });

  describe("contraseña", () => {
    it("cambiar exige la actual y mantiene la sesión del usuario", async () => {
      const other = await startApp();
      try {
        const c = client(other.base);
        await c.login();
        assert.equal((await c.post("/api/password", { current: "mala", next: "nueva-clave-segura-1" })).status, 401);
        assert.equal((await c.post("/api/password", { current: PASSWORD, next: "corta" })).status, 400);
        assert.equal((await c.post("/api/password", { current: PASSWORD, next: "nueva-clave-segura-1" })).status, 200);
        assert.equal((await c.get("/api/draft")).status, 200, "la sesión que cambió la clave sigue activa");
        const c2 = client(other.base);
        assert.equal((await c2.login(PASSWORD)).status, 401);
        assert.equal((await c2.login("nueva-clave-segura-1")).status, 200);
      } finally {
        await other.close();
      }
    });
  });

  describe("panel estático", () => {
    it("/admin redirige a /admin/ y nunca expone /data", async () => {
      const dataDir = tmpDir();
      fs.writeFileSync(path.join(dataDir, "secret"), "no-publicar");
      const other = await startApp({ dataDir });
      try {
        const redirect = await fetch(`${other.base}/admin`, { redirect: "manual" });
        assert.equal(redirect.status, 301);
        for (const p of ["/secret", "/draft.json", "/data/secret", "/auth.json"]) {
          assert.equal((await fetch(other.base + p)).status, 404, p);
        }
      } finally {
        await other.close();
      }
    });
  });
});

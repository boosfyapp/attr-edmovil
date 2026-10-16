import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { REPO_ROOT, rawGet, startApp } from "./helpers.js";

describe("servidor estático", () => {
  let app;
  before(async () => { app = await startApp(); });
  after(async () => { await app.close(); });

  it("responde /healthz", async () => {
    const res = await fetch(`${app.base}/healthz`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "ok");
  });

  it("sirve archivos de la landing con su tipo", async () => {
    const css = await fetch(`${app.base}/styles.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type"), /text\/css/);
    const png = await fetch(`${app.base}/assets/cupon-premium-200.png`);
    assert.equal(png.status, 200);
    assert.equal(png.headers.get("content-type"), "image/png");
  });

  it("sirve / sin caché", async () => {
    const res = await fetch(`${app.base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.equal(res.headers.get("cache-control"), "no-cache");
  });

  it("bloquea traversal y archivos fuera de la lista", async () => {
    for (const p of ["/../package.json", "/%2e%2e/package.json", "/assets/../package.json", "/server/app.js", "/package.json", "/docs/superpowers/plans/2026-10-16-admin-panel.md", "/.git/config", "/assets//..%2f..%2fpackage.json", "/assets/%00"]) {
      const res = await rawGet(app.port, p);
      assert.equal(res.status, 404, p);
    }
  });

  it("todos los archivos de assets/ son servibles por el nombre real", async () => {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
    const files = walk(path.join(REPO_ROOT, "assets"));
    assert.ok(files.length > 30);
    for (const file of files) {
      const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
      const res = await fetch(`${app.base}/${rel}`);
      assert.equal(res.status, 200, rel);
      await res.arrayBuffer();
    }
  });

  it("rechaza métodos que escriben fuera de la API", async () => {
    const res = await fetch(`${app.base}/styles.css`, { method: "POST" });
    assert.equal(res.status, 405);
  });
});

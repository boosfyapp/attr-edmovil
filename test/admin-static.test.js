import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { REPO_ROOT, startApp } from "./helpers.js";

describe("panel estático (/admin)", () => {
  let app;
  before(async () => { app = await startApp(); });
  after(async () => { await app.close(); });

  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

  it("sirve index.html con CSP y todos los módulos referenciados existen", async () => {
    const res = await fetch(`${app.base}/admin/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-security-policy"), /script-src 'self'/);
    const html = await res.text();
    assert.match(html, /noindex/);
    for (const file of walk(path.join(REPO_ROOT, "admin"))) {
      const rel = path.relative(path.join(REPO_ROOT, "admin"), file).split(path.sep).join("/");
      const r = await fetch(`${app.base}/admin/${rel}`);
      assert.equal(r.status, 200, rel);
      await r.arrayBuffer();
    }
  });

  it("los imports relativos de cada módulo apuntan a archivos que existen", () => {
    const base = path.join(REPO_ROOT, "admin");
    for (const file of walk(base).filter((f) => f.endsWith(".js"))) {
      const source = fs.readFileSync(file, "utf8");
      for (const m of source.matchAll(/(?:from|import\()\s*["'](\.[^"']+)["']/g)) {
        const target = path.resolve(path.dirname(file), m[1].split("?")[0]);
        assert.ok(fs.existsSync(target), `${path.relative(REPO_ROOT, file)} → ${m[1]}`);
      }
    }
  });

  it("ningún módulo del panel usa innerHTML ni eval", () => {
    for (const file of walk(path.join(REPO_ROOT, "admin")).filter((f) => f.endsWith(".js"))) {
      const source = fs.readFileSync(file, "utf8");
      assert.doesNotMatch(source, /\.innerHTML\s*=|insertAdjacentHTML|\beval\(|new Function\(/, path.relative(REPO_ROOT, file));
    }
  });
});

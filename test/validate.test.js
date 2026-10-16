import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildSeed } from "../server/lib/seed.js";
import { LIMITS, validateContent } from "../server/lib/validate.js";
import { extractTexts } from "../server/lib/template.js";
import { TEXT_LABELS } from "../server/lib/text-labels.js";
import { REPO_ROOT, tmpDir } from "./helpers.js";

const dirs = { siteDir: REPO_ROOT, dataDir: tmpDir() };
const fresh = () => structuredClone(buildSeed(REPO_ROOT));
const run = (doc) => validateContent(doc, dirs);
const paths = (r) => r.errors.map((e) => e.path);

describe("validateContent", () => {
  it("la semilla es válida y sin avisos", () => {
    const r = run(fresh());
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
  });

  it("los textos por defecto del HTML caben en sus límites", () => {
    const html = fs.readFileSync(path.join(REPO_ROOT, "index.html"), "utf8");
    for (const t of extractTexts(html)) {
      const max = TEXT_LABELS[t.key].long ? LIMITS.textLong : LIMITS.textShort;
      assert.ok(t.value.length <= max, `${t.key} (${t.value.length} > ${max})`);
    }
  });

  for (const bad of [0, -1, "abc", "", null, NaN]) {
    it(`rechaza precio de plan ${JSON.stringify(bad)}`, () => {
      const doc = fresh();
      doc.plans.premium[2].price = bad;
      assert.ok(paths(run(doc)).includes("plans.premium[2].price"));
    });
  }

  it("rechaza mensualidad vacía en equipos", () => {
    const doc = fresh();
    doc.devices[4].monthly = "";
    assert.ok(paths(run(doc)).includes("devices[4].monthly"));
  });

  it("valida el WhatsApp principal", () => {
    for (const bad of ["", "2223303739", "52 222 330 3739", "+522223303739", "5222233037399"]) {
      const doc = fresh();
      doc.settings.whatsapp = bad;
      assert.ok(paths(run(doc)).includes("settings.whatsapp"), bad);
    }
  });

  it("valida colores", () => {
    for (const bad of ["red", "#fff", "#12345g", "009fdb", ""]) {
      const doc = fresh();
      doc.theme.azul = bad;
      assert.ok(paths(run(doc)).includes("theme.azul"), bad);
    }
  });

  it("valida textos: desconocidos, vacíos y demasiado largos", () => {
    const doc = fresh();
    doc.texts = { "hero.titulo": "  ", "no.existe": "x", "hero.sub": "x".repeat(LIMITS.textLong + 1), "nav.planes": "x".repeat(LIMITS.textShort + 1) };
    const p = paths(run(doc));
    assert.ok(p.includes("texts.hero.titulo"));
    assert.ok(p.includes("texts.no.existe"));
    assert.ok(p.includes("texts.hero.sub"));
    assert.ok(p.includes("texts.nav.planes"));
  });

  it("valida cupones", () => {
    const doc = fresh();
    doc.coupons[0].title = "";
    doc.coupons[0].amount = 0;
    doc.coupons[1].from = "2026-12-31";
    doc.coupons[1].to = "2026-01-01";
    const p = paths(run(doc));
    assert.ok(p.includes("coupons[0].title"));
    assert.ok(p.includes("coupons[0].amount"));
    assert.ok(p.includes("coupons[1].to"));
  });

  it("un cupón inactivo no exige campos completos; fechas inexistentes sí fallan", () => {
    const doc = fresh();
    doc.coupons[0] = { id: "borrador", title: "", description: "", amount: 0, product: "", image: "", active: false, from: "", to: "" };
    assert.deepEqual(paths(run(doc)), []);
    doc.coupons[0].from = "2026-02-30";
    assert.ok(paths(run(doc)).includes("coupons[0].from"));
  });

  it("rechaza ids de cupón repetidos", () => {
    const doc = fresh();
    doc.coupons[1].id = doc.coupons[0].id;
    assert.ok(paths(run(doc)).includes("coupons[1].id"));
  });

  it("valida rutas de imagen y existencia", () => {
    const doc = fresh();
    doc.team[0].image = "../secreto.png";
    doc.team[1].image = "http://evil.example/x.png";
    doc.team[2].image = "assets/no-existe.png";
    doc.team[3].image = "uploads/inexistente.webp";
    const p = paths(run(doc));
    for (const i of [0, 1, 2, 3]) assert.ok(p.includes(`team[${i}].image`), String(i));
  });

  it("acepta una imagen subida que existe", () => {
    fs.mkdirSync(path.join(dirs.dataDir, "uploads"), { recursive: true });
    fs.writeFileSync(path.join(dirs.dataDir, "uploads", "ok.webp"), "x");
    const doc = fresh();
    doc.team[0].image = "uploads/ok.webp";
    assert.deepEqual(paths(run(doc)), []);
  });

  it("el total de un plan Simple que no cuadra es solo un aviso", () => {
    const doc = fresh();
    doc.plans.simple[0].terms[0].total = 1;
    const r = run(doc);
    assert.deepEqual(r.errors, []);
    assert.equal(r.warnings.length, 1);
  });

  it("rechaza tiendas con mapa que no es https", () => {
    const doc = fresh();
    doc.stores[0].map = "javascript:alert(1)";
    assert.ok(paths(run(doc)).includes("stores[0].map"));
  });

  it("rechaza rangos del cotizador incoherentes", () => {
    const doc = fresh();
    doc.budgetRanges[0].max = doc.budgetRanges[0].min;
    assert.ok(paths(run(doc)).includes("budgetRanges[0].max"));
  });

  it("rechaza un documento que no es objeto", () => {
    assert.equal(run(null).errors.length, 1);
    assert.equal(run([]).errors.length, 1);
  });
});

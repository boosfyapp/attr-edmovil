import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, it } from "node:test";
import { renderContentJs, renderThemeCss } from "../server/lib/render.js";
import { ConflictError, createStore, NotFoundError, ValidationError } from "../server/lib/store.js";
import { REPO_ROOT, tmpDir } from "./helpers.js";

const newStore = () => {
  const dataDir = tmpDir();
  return { dataDir, store: createStore({ dataDir, siteDir: REPO_ROOT }) };
};

describe("store: borrador", () => {
  it("crea el borrador desde la semilla (revisión 1, sin publicar, con cambios)", () => {
    const { store } = newStore();
    const d = store.getDraft();
    assert.equal(d.revision, 1);
    assert.equal(d.publishedVersion, null);
    assert.equal(d.dirty, true);
    assert.equal(d.content.plans.premium.length, 8);
  });

  it("guarda con revisión y rechaza una revisión vieja", () => {
    const { store } = newStore();
    const d = store.getDraft();
    d.content.plans.premium[0].price = 499;
    const saved = store.saveDraft(d.content, 1);
    assert.equal(saved.revision, 2);
    assert.equal(store.getDraft().content.plans.premium[0].price, 499);
    assert.throws(() => store.saveDraft(d.content, 1), (e) => e instanceof ConflictError && e.revision === 2);
  });

  it("descarta claves desconocidas", () => {
    const { store } = newStore();
    const d = store.getDraft();
    const saved = store.saveDraft({ ...d.content, hack: { x: 1 } }, 1);
    assert.equal("hack" in saved.content, false);
  });

  it("rechaza contenido que no es objeto", () => {
    const { store } = newStore();
    assert.throws(() => store.saveDraft([], 1), ValidationError);
  });
});

describe("store: publicar", () => {
  it("publica: escribe versión, content.js, theme.css y meta; deja de estar sucio", () => {
    const { store, dataDir } = newStore();
    const r = store.publish("primera");
    assert.equal(r.version, 1);
    for (const file of ["versions/1.json", "published/content.js", "published/theme.css", "published/meta.json"]) {
      assert.ok(fs.existsSync(path.join(dataDir, file)), file);
    }
    const d = store.getDraft();
    assert.equal(d.publishedVersion, 1);
    assert.equal(d.dirty, false);
    assert.equal(store.listVersions()[0].note, "primera");
    assert.equal(fs.readdirSync(path.join(dataDir, "published")).some((n) => n.includes(".tmp-")), false);
  });

  it("un cambio en el borrador vuelve a marcarlo sucio, sin tocar lo publicado", () => {
    const { store, dataDir } = newStore();
    store.publish();
    const before = fs.readFileSync(path.join(dataDir, "published", "content.js"), "utf8");
    const d = store.getDraft();
    d.content.plans.premium[0].price = 777;
    store.saveDraft(d.content, d.revision);
    assert.equal(store.getDraft().dirty, true);
    assert.equal(fs.readFileSync(path.join(dataDir, "published", "content.js"), "utf8"), before);
  });

  it("publicar sin cambios crea otra versión", () => {
    const { store } = newStore();
    store.publish();
    assert.equal(store.publish().version, 2);
  });

  it("no publica si hay errores y no escribe nada", () => {
    const { store, dataDir } = newStore();
    const d = store.getDraft();
    d.content.plans.premium[0].price = 0;
    store.saveDraft(d.content, d.revision);
    assert.throws(() => store.publish(), (e) => e instanceof ValidationError && e.errors[0].path === "plans.premium[0].price");
    assert.equal(fs.existsSync(path.join(dataDir, "published")), false);
    assert.equal(store.listVersions().length, 0);
    assert.equal(store.getPublished(), null);
  });

  it("restaura una versión como borrador sin tocar lo publicado", () => {
    const { store } = newStore();
    store.publish("v1");
    const d = store.getDraft();
    d.content.plans.premium[0].price = 999;
    const saved = store.saveDraft(d.content, d.revision);
    store.publish("v2");
    const restored = store.restore(1);
    assert.equal(restored.revision, saved.revision + 1);
    assert.equal(restored.content.plans.premium[0].price, 485);
    assert.equal(restored.publishedVersion, 2);
    assert.equal(restored.dirty, true);
    assert.throws(() => store.restore(99), NotFoundError);
  });
});

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

describe("render", () => {
  const { store } = newStore();
  const doc = store.getDraft().content;

  it("content.js es JS válido y trae lo necesario", () => {
    doc.devices[0].hidden = true;
    doc.coupons[1].active = false;
    const sandbox = { window: {} };
    vm.runInNewContext(renderContentJs(doc, { version: 3 }), sandbox);
    const c = sandbox.window.SITE_CONTENT;
    assert.equal(c.version, 3);
    assert.equal(c.devices.length, 33, "oculta los equipos con hidden");
    assert.equal(c.coupons.length, 1, "solo cupones activos");
    assert.equal(c.settings.whatsapp, "522223303739");
    assert.equal("theme" in c, false);
  });

  it("escapa </script> y separadores de línea Unicode", () => {
    const evil = structuredClone(doc);
    evil.texts = { "hero.titulo": "</script><script>alert(1)</script>" + LS + "" + PS + "" };
    const js = renderContentJs(evil);
    assert.equal(js.includes("</script>"), false);
    assert.equal(js.includes("" + LS + ""), false);
    const sandbox = { window: {} };
    vm.runInNewContext(js, sandbox);
    assert.equal(sandbox.window.SITE_CONTENT.texts["hero.titulo"], "</script><script>alert(1)</script>" + LS + "" + PS + "");
  });

  it("theme.css conserva los tonos originales con los colores de marca", () => {
    const css = renderThemeCss({ azul: "#009fdb", morado: "#bf0cea", rosa: "#e72e70", naranja: "#ff8226", whatsapp: "#25d366" });
    assert.match(css, /--att-blue:#009fdb;/);
    assert.match(css, /--att-blue-dark:#0080b3;/);
    assert.match(css, /--att-blue-light:#5fcdf2;/);
    assert.match(css, /--wa-green-dark:#1da851;/);
    assert.match(css, /--att-blue-rgb:0, 159, 219;/);
  });

  it("theme.css deriva tonos de un color nuevo", () => {
    const css = renderThemeCss({ azul: "#112233", morado: "#bf0cea", rosa: "#e72e70", naranja: "#ff8226", whatsapp: "#25d366" });
    assert.match(css, /--att-blue:#112233;/);
    assert.match(css, /--att-blue-dark:#0e1b29;/);
    assert.match(css, /--att-blue-rgb:17, 34, 51;/);
  });
});

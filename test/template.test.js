import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { extractTexts, renderIndex, renderPreview } from "../server/lib/template.js";
import { TEXT_LABELS } from "../server/lib/text-labels.js";
import { REPO_ROOT } from "./helpers.js";

describe("extractTexts", () => {
  it("lee texto, negritas y entidades", () => {
    const out = extractTexts('<p data-cms="a">Hola &amp; <b>mundo</b> fin</p><h1 data-cms="b">  Dos\n  líneas </h1>');
    assert.deepEqual(out, [
      { key: "a", attr: null, value: "Hola & **mundo** fin" },
      { key: "b", attr: null, value: "Dos líneas" },
    ]);
  });

  it("lee atributos con data-cms-attr", () => {
    const out = extractTexts('<a data-wa-text="Hola, AT&T" data-cms="wa.x" data-cms-attr="data-wa-text" href="#">x</a><meta data-cms="m" data-cms-attr="content" content="Desc &amp; más">');
    assert.deepEqual(out, [
      { key: "wa.x", attr: "data-wa-text", value: "Hola, AT&T" },
      { key: "m", attr: "content", value: "Desc & más" },
    ]);
  });

  it("acepta claves repetidas con el mismo valor y rechaza valores distintos", () => {
    assert.equal(extractTexts('<i data-cms="k">x</i><i data-cms="k">x</i>').length, 1);
    assert.throws(() => extractTexts('<i data-cms="k">x</i><i data-cms="k">y</i>'), /valores distintos/);
  });

  it("rechaza elementos hijos distintos de b/strong", () => {
    assert.throws(() => extractTexts('<p data-cms="k">a <svg></svg></p>'), /solo se permiten/);
  });
});

describe("index.html de la landing", () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, "index.html"), "utf8");
  const found = extractTexts(html);

  it("tiene al menos 150 textos editables, todos no vacíos", () => {
    assert.ok(found.length >= 150, `solo ${found.length}`);
    for (const t of found) assert.ok(t.value.length > 0, t.key);
  });

  it("toda clave tiene etiqueta y toda etiqueta existe en el HTML", () => {
    const keys = new Set(found.map((t) => t.key));
    const labelled = new Set(Object.keys(TEXT_LABELS));
    assert.deepEqual([...keys].filter((k) => !labelled.has(k)), [], "claves sin etiqueta");
    assert.deepEqual([...labelled].filter((k) => !keys.has(k)), [], "etiquetas sin clave");
  });

  it("cada etiqueta trae label y sección", () => {
    for (const [key, meta] of Object.entries(TEXT_LABELS)) {
      assert.ok(meta.label && meta.section, key);
    }
  });
});

describe("renderIndex / renderPreview", () => {
  const html = '<link href="published/theme.css?v=0"><script src="published/content.js?v=0"></script></body>';
  it("fija la versión", () => {
    const out = renderIndex(html, 7);
    assert.match(out, /published\/theme\.css\?v=7/);
    assert.match(out, /published\/content\.js\?v=7/);
  });
  it("la vista previa usa el borrador y agrega la barra", () => {
    const out = renderPreview(html);
    assert.match(out, /draft-theme\.css/);
    assert.match(out, /draft-content\.js/);
    assert.match(out, /VISTA PREVIA/);
  });
});

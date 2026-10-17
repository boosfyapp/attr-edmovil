import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildAgentPrompt, effectiveTexts, EXCLUDED_TEXT_KEYS, INCLUDED_TEXT_KEYS } from "../server/lib/agent-prompt.js";
import { buildSeed } from "../server/lib/seed.js";
import { TEXT_LABELS } from "../server/lib/text-labels.js";
import { REPO_ROOT } from "./helpers.js";

const content = () => structuredClone(buildSeed(REPO_ROOT));
const build = (c = content(), today = "2026-10-16") => buildAgentPrompt({ content: c, texts: effectiveTexts(REPO_ROOT, c), today });
const plain = (s) => s.replace(/\*\*/g, "");
const money = (n) => `$${Number(n).toLocaleString("es-MX")}`;
const money2 = (n) => `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

describe("prompt del agente de WhatsApp", () => {
  const c = content();
  const prompt = build(c);

  it("incluye todos los planes con su precio y GB", () => {
    for (const p of c.plans.premium) assert.ok(prompt.includes(`${p.name}: ${money(p.price)}/mes · ${p.gb} GB`), p.name);
    for (const p of c.plans.lite) assert.ok(prompt.includes(`${p.name}: ${money(p.price)}/mes · ${p.gb} GB`), p.name);
    for (const p of c.plans.simple) {
      assert.ok(prompt.includes(`${p.name}: ${money(p.price)}/mes`), p.name);
      for (const t of p.terms) assert.ok(prompt.includes(`${t.months} meses: pagas ${t.pay}, ${t.free} de regalo, total ${money(t.total)}`), `${p.name} ${t.months}`);
    }
  });

  it("incluye los 34 equipos con plan, plazo y mensualidad", () => {
    assert.equal(c.devices.length, 34);
    for (const d of c.devices) {
      assert.ok(prompt.includes(d.model), d.model);
      assert.ok(prompt.includes(`${d.model} — Plan ${d.plan}`) && prompt.includes(money2(d.monthly)), `${d.model} ${d.monthly}`);
    }
  });

  it("incluye las 9 tiendas con dirección, horario y mapa", () => {
    for (const s of c.stores) {
      for (const field of [s.name, s.address, s.hours, s.map]) assert.ok(prompt.includes(field), `${s.name}: ${field}`);
    }
  });

  it("incluye cupones, zonas, equipo y las 11 preguntas frecuentes completas", () => {
    for (const x of c.coupons) for (const field of [x.title, x.description]) assert.ok(prompt.includes(field), field);
    for (const z of c.coverageZones) assert.ok(prompt.includes(z), z);
    for (const m of c.team) assert.ok(prompt.includes(m.name), m.name);
    assert.equal(c.faqs.length, 11);
    for (const f of c.faqs) { assert.ok(prompt.includes(f.q), f.q); assert.ok(prompt.includes(f.a), f.a); }
    for (const r of c.budgetRanges) assert.ok(prompt.includes(r.label), r.label);
  });

  it("cada texto de la landing está en el prompt o está excluido a propósito", () => {
    const keys = Object.keys(TEXT_LABELS);
    const unclassified = keys.filter((k) => !INCLUDED_TEXT_KEYS.includes(k) && !EXCLUDED_TEXT_KEYS.some((re) => re.test(k)));
    assert.deepEqual(unclassified, [], "textos nuevos sin clasificar: agrégalos al prompt o a EXCLUDED_TEXT_KEYS");
    const overlap = INCLUDED_TEXT_KEYS.filter((k) => EXCLUDED_TEXT_KEYS.some((re) => re.test(k)));
    assert.deepEqual(overlap, []);
    for (const k of INCLUDED_TEXT_KEYS) assert.ok(k in TEXT_LABELS, `clave inexistente: ${k}`);
    const texts = effectiveTexts(REPO_ROOT, c);
    for (const k of INCLUDED_TEXT_KEYS) assert.ok(prompt.includes(plain(texts[k])), `falta el texto de ${k}: ${texts[k]}`);
  });

  it("refleja los cambios hechos en el panel", () => {
    const edited = content();
    edited.plans.premium[0].price = 523;
    edited.texts["hero.sub"] = "Subtítulo editado desde el panel";
    edited.devices[0].hidden = true;
    const out = build(edited);
    assert.ok(out.includes("Azul 2: $523/mes"));
    assert.ok(out.includes("Subtítulo editado desde el panel"));
    assert.equal(out.includes(edited.devices[0].model), false, "un equipo oculto no se ofrece");
  });

  it("solo ofrece cupones activos y vigentes a la fecha", () => {
    const edited = content();
    edited.coupons[0].to = "2026-10-01";
    edited.coupons[1].active = false;
    const out = build(edited, "2026-10-16");
    assert.equal(out.includes(edited.coupons[0].title), false);
    assert.equal(out.includes(edited.coupons[1].title), false);
    assert.match(out, /no hay cupones vigentes/i);
  });

  it("trae las reglas de seguridad y el traspaso a un humano", () => {
    assert.match(prompt, /NIP/);
    assert.match(prompt, /nunca pidas ni aceptes/i);
    assert.match(prompt, /«agente»/);
    assert.match(prompt, /no inventes/i);
    assert.equal(/sk-[A-Za-z0-9]{20,}/.test(prompt), false);
  });

  it("tiene un tamaño razonable y no deja marcadores sin resolver", () => {
    assert.ok(prompt.length > 8000 && prompt.length < 45000, String(prompt.length));
    assert.equal(/undefined|NaN|\[object|\{\{|\}\}/.test(prompt), false);
  });

  it("el CLI usa el mismo generador", () => {
    const cli = fs.readFileSync(path.join(REPO_ROOT, "server", "cli", "agent-prompt.js"), "utf8");
    assert.match(cli, /buildAgentPrompt/);
  });
});

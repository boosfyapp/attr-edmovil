import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSeed } from "../server/lib/seed.js";
import { REPO_ROOT } from "./helpers.js";

describe("buildSeed", () => {
  const seed = buildSeed(REPO_ROOT);

  it("reproduce el contenido actual de la landing", () => {
    assert.equal(seed.plans.premium.length, 8);
    assert.equal(seed.plans.lite.length, 6);
    assert.equal(seed.plans.simple.length, 4);
    assert.equal(seed.devices.length, 34);
    assert.equal(seed.team.length, 6);
    assert.equal(seed.stores.length, 9);
    assert.equal(seed.faqs.length, 11);
    assert.equal(seed.coverageZones.length, 17);
    assert.equal(seed.budgetRanges.length, 3);
    assert.deepEqual(seed.texts, {});
  });

  it("trae ajustes y colores de marca", () => {
    assert.equal(seed.settings.whatsapp, "522223303739");
    assert.equal(seed.settings.ga4, "G-BTCKL6ENXP");
    assert.equal(seed.theme.azul, "#009fdb");
    assert.equal(seed.theme.whatsapp, "#25d366");
  });

  it("trae los dos cupones actuales, activos y sin vigencia", () => {
    assert.deepEqual(seed.coupons.map((c) => [c.id, c.amount, c.active, c.from, c.to]), [
      ["premium", 200, true, "", ""],
      ["servicio", 150, true, "", ""],
    ]);
  });

  it("los equipos tienen precio e imagen", () => {
    for (const d of seed.devices) {
      assert.ok(d.monthly > 0 && d.image && d.model, d.model);
    }
  });

  it("es serializable (JSON puro)", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(seed)), seed);
  });
});

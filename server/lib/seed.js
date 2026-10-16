import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const EXPORTS = [
  "WHATSAPP_PRINCIPAL", "TEAM", "STORES", "PLANS_PREMIUM", "PLANS_LITE", "PLANS_SIMPLE", "BUDGET_RANGES",
  "FAQS", "COUPONS", "COVERAGE_ZONES", "SETTINGS_DEFAULT", "THEME_DEFAULT", "DEVICE_CATALOG",
];

/** Evalúa data.js y catalog-data.js (scripts de navegador) en un contexto aislado. */
export function loadRepoData(siteDir) {
  const source = ["data.js", "catalog-data.js"]
    .map((file) => fs.readFileSync(path.join(siteDir, file), "utf8"))
    .join("\n");
  const raw = vm.runInNewContext(`${source}\n({${EXPORTS.join(",")}})`, Object.create(null), { timeout: 2000 });
  return JSON.parse(JSON.stringify(raw));
}

/** Documento de contenido inicial: equivale a lo que hoy muestra la landing. */
export function buildSeed(siteDir) {
  const d = loadRepoData(siteDir);
  return {
    texts: {},
    settings: { ...d.SETTINGS_DEFAULT, whatsapp: d.WHATSAPP_PRINCIPAL },
    theme: { ...d.THEME_DEFAULT },
    plans: {
      premium: d.PLANS_PREMIUM.map((p) => ({ name: p.name, price: p.price, gb: p.gb, note: p.note || "", hasAsterisk: Boolean(p.hasAsterisk) })),
      lite: d.PLANS_LITE.map((p) => ({ name: p.name, price: p.price, gb: p.gb, socials: p.socials, portability: p.portability })),
      simple: d.PLANS_SIMPLE.map((p) => ({
        name: p.name, price: p.price, gbBase: p.gbBase, gbDouble: p.gbDouble,
        terms: p.terms.map((t) => ({ months: t.months, pay: t.pay, free: t.free, total: t.total })),
      })),
    },
    budgetRanges: d.BUDGET_RANGES.map((r) => ({ id: r.id, label: r.label, tag: r.tag, min: r.min, max: r.max })),
    devices: d.DEVICE_CATALOG
      .filter((item) => !item.quoteOnly && Number.isFinite(item.monthly))
      .map((item) => ({ brand: item.brand, model: item.model, plan: item.plan, monthly: item.monthly, term: item.term || "", image: item.image, hidden: false })),
    team: d.TEAM.map((m) => ({ role: m.role, name: m.name, image: m.image, principal: Boolean(m.principal) })),
    stores: d.STORES.map((s) => ({ name: s.name, address: s.address, hours: s.hours, map: s.map, principal: Boolean(s.principal) })),
    coupons: d.COUPONS.map((c) => ({ ...c })),
    faqs: d.FAQS.map((f) => ({ q: f.q, a: f.a })),
    coverageZones: [...d.COVERAGE_ZONES],
  };
}

import fs from "node:fs";
import path from "node:path";
import { HEX } from "./color.js";
import { TEXT_LABELS } from "./text-labels.js";

export const LIMITS = { textShort: 200, textLong: 700, faqAnswer: 1500, items: 200 };
const IMAGE_PATH = /^(assets|uploads)\/[A-Za-z0-9_./-]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const BRAND_COLORS = ["azul", "morado", "rosa", "naranja", "whatsapp"];

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const present = (v) => isStr(v) && v.trim().length > 0;

function realDate(value) {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Valida un documento de contenido. Los errores bloquean la publicación; los avisos no.
 * `dirs.siteDir` / `dirs.dataDir` permiten comprobar que las imágenes existen.
 */
export function validateContent(doc, dirs = {}) {
  const errors = [];
  const warnings = [];
  const err = (p, message) => errors.push({ path: p, message });
  const warn = (p, message) => warnings.push({ path: p, message });

  if (!isObj(doc)) return { errors: [{ path: "", message: "El contenido no es un objeto" }], warnings };

  const list = (value, p, { max = LIMITS.items, min = 0 } = {}) => {
    if (!Array.isArray(value)) {
      err(p, "Debe ser una lista");
      return [];
    }
    if (value.length > max) err(p, `Máximo ${max} elementos`);
    if (value.length < min) err(p, `Se necesita al menos ${min} elemento(s)`);
    return value.slice(0, max);
  };
  const text = (value, p, label, max = LIMITS.textShort) => {
    if (!present(value)) return err(p, `${label}: no puede estar vacío`);
    if (value.length > max) err(p, `${label}: máximo ${max} caracteres`);
  };
  const money = (value, p, label) => {
    if (!isNum(value) || value <= 0) err(p, `${label}: debe ser un número mayor que 0`);
    else if (value > 1_000_000) err(p, `${label}: valor demasiado grande`);
  };
  const image = (value, p, label) => {
    if (!isStr(value) || !IMAGE_PATH.test(value) || value.includes("..")) return err(p, `${label}: imagen no válida`);
    const base = value.startsWith("uploads/") ? dirs.dataDir : dirs.siteDir;
    if (base && !fs.existsSync(path.join(base, value))) err(p, `${label}: la imagen no existe (${value})`);
  };

  /* ---- textos (solo cambios respecto al HTML) ---- */
  if (!isObj(doc.texts)) err("texts", "Debe ser un objeto");
  else {
    for (const [key, value] of Object.entries(doc.texts)) {
      const meta = TEXT_LABELS[key];
      if (!meta) { err(`texts.${key}`, "Texto desconocido"); continue; }
      text(value, `texts.${key}`, meta.label, meta.long ? LIMITS.textLong : LIMITS.textShort);
    }
  }

  /* ---- ajustes ---- */
  if (!isObj(doc.settings)) err("settings", "Debe ser un objeto");
  else {
    if (!isStr(doc.settings.whatsapp) || !/^52\d{10}$/.test(doc.settings.whatsapp)) {
      err("settings.whatsapp", "WhatsApp principal: usa 52 + 10 dígitos, sin espacios ni signos (ej. 522223303739)");
    }
    if (doc.settings.ga4 && !/^G-[A-Z0-9]{4,20}$/.test(doc.settings.ga4)) err("settings.ga4", "ID de Google Analytics: formato G-XXXXXXXXXX");
    if (doc.settings.metaPixel && !/^\d{10,20}$/.test(doc.settings.metaPixel)) err("settings.metaPixel", "ID de Pixel de Meta: solo números (10 a 20 dígitos)");
  }

  /* ---- colores ---- */
  if (!isObj(doc.theme)) err("theme", "Debe ser un objeto");
  else {
    for (const name of BRAND_COLORS) {
      const value = doc.theme[name];
      if (!isStr(value) || !HEX.test(value)) err(`theme.${name}`, `Color ${name}: usa el formato #rrggbb`);
    }
  }

  /* ---- planes ---- */
  const plans = isObj(doc.plans) ? doc.plans : (err("plans", "Debe ser un objeto"), {});
  list(plans.premium, "plans.premium", { min: 1 }).forEach((p, i) => {
    const b = `plans.premium[${i}]`;
    text(p?.name, `${b}.name`, "Nombre del plan", 60);
    money(p?.price, `${b}.price`, "Precio");
    money(p?.gb, `${b}.gb`, "GB");
    if (p?.note && String(p.note).length > 160) err(`${b}.note`, "Nota: máximo 160 caracteres");
  });
  list(plans.lite, "plans.lite", { min: 1 }).forEach((p, i) => {
    const b = `plans.lite[${i}]`;
    text(p?.name, `${b}.name`, "Nombre del plan", 60);
    money(p?.price, `${b}.price`, "Precio");
    money(p?.gb, `${b}.gb`, "GB");
    if (!isNum(p?.socials) || p.socials < 0) err(`${b}.socials`, "Redes sociales: número 0 o mayor");
    text(p?.portability, `${b}.portability`, "Descuento por portabilidad", 12);
  });
  list(plans.simple, "plans.simple", { min: 1 }).forEach((p, i) => {
    const b = `plans.simple[${i}]`;
    text(p?.name, `${b}.name`, "Nombre del plan", 60);
    money(p?.price, `${b}.price`, "Precio");
    money(p?.gbBase, `${b}.gbBase`, "GB base");
    money(p?.gbDouble, `${b}.gbDouble`, "GB duplicados");
    list(p?.terms, `${b}.terms`, { min: 1, max: 12 }).forEach((t, j) => {
      const tb = `${b}.terms[${j}]`;
      money(t?.months, `${tb}.months`, "Meses");
      money(t?.pay, `${tb}.pay`, "Meses que pagas");
      if (!isNum(t?.free) || t.free < 0) err(`${tb}.free`, "Meses de regalo: número 0 o mayor");
      money(t?.total, `${tb}.total`, "Total");
      if (isNum(t?.total) && isNum(t?.pay) && isNum(p?.price) && Math.abs(t.total - t.pay * p.price) > 0.5) {
        warn(`${tb}.total`, `${p.name}, ${t.months} meses: el total ($${t.total}) no coincide con ${t.pay} × $${p.price}`);
      }
    });
  });

  /* ---- rangos del cotizador ---- */
  list(doc.budgetRanges, "budgetRanges", { min: 1, max: 8 }).forEach((r, i) => {
    const b = `budgetRanges[${i}]`;
    if (!isStr(r?.id) || !SLUG.test(r.id)) err(`${b}.id`, "Identificador no válido");
    text(r?.label, `${b}.label`, "Etiqueta", 40);
    text(r?.tag, `${b}.tag`, "Descripción", 60);
    if (!isNum(r?.min) || !isNum(r?.max) || r.min < 0 || r.max <= r.min) err(`${b}.max`, "El máximo debe ser mayor que el mínimo");
  });

  /* ---- equipos ---- */
  list(doc.devices, "devices").forEach((d, i) => {
    const b = `devices[${i}]`;
    text(d?.brand, `${b}.brand`, "Marca", 40);
    text(d?.model, `${b}.model`, "Modelo", 120);
    text(d?.plan, `${b}.plan`, "Plan", 40);
    money(d?.monthly, `${b}.monthly`, "Mensualidad");
    if (d?.term && String(d.term).length > 40) err(`${b}.term`, "Plazo: máximo 40 caracteres");
    image(d?.image, `${b}.image`, "Foto");
  });

  /* ---- equipo comercial ---- */
  list(doc.team, "team", { max: 30 }).forEach((m, i) => {
    const b = `team[${i}]`;
    text(m?.role, `${b}.role`, "Puesto", 40);
    text(m?.name, `${b}.name`, "Nombre", 80);
    image(m?.image, `${b}.image`, "Foto");
  });

  /* ---- tiendas ---- */
  list(doc.stores, "stores", { max: 40 }).forEach((s, i) => {
    const b = `stores[${i}]`;
    text(s?.name, `${b}.name`, "Nombre", 80);
    text(s?.address, `${b}.address`, "Dirección", 220);
    text(s?.hours, `${b}.hours`, "Horario", 120);
    if (!isStr(s?.map) || !/^https:\/\/[^\s"'<>]+$/.test(s.map) || s.map.length > 1200) err(`${b}.map`, "Mapa: usa un enlace https:// válido");
  });

  /* ---- cupones ---- */
  const couponIds = new Set();
  list(doc.coupons, "coupons", { max: 30 }).forEach((c, i) => {
    const b = `coupons[${i}]`;
    if (!isStr(c?.id) || !SLUG.test(c.id)) err(`${b}.id`, "Identificador no válido");
    else if (couponIds.has(c.id)) err(`${b}.id`, "Identificador repetido");
    else couponIds.add(c.id);
    for (const key of ["from", "to"]) {
      const v = c?.[key];
      if (v && !realDate(v)) err(`${b}.${key}`, "Fecha no válida (AAAA-MM-DD)");
    }
    if (c?.from && c?.to && realDate(c.from) && realDate(c.to) && c.from > c.to) err(`${b}.to`, "La fecha final es anterior a la inicial");
    if (c?.active) {
      text(c.title, `${b}.title`, "Título del cupón", 80);
      text(c.description, `${b}.description`, "Descripción del cupón", 200);
      text(c.product, `${b}.product`, "Aplica a", 80);
      money(c.amount, `${b}.amount`, "Monto del cupón");
      image(c.image, `${b}.image`, "Imagen del cupón");
    }
  });

  /* ---- FAQ ---- */
  list(doc.faqs, "faqs", { max: 40 }).forEach((f, i) => {
    text(f?.q, `faqs[${i}].q`, "Pregunta", 200);
    text(f?.a, `faqs[${i}].a`, "Respuesta", LIMITS.faqAnswer);
  });

  /* ---- zonas ---- */
  list(doc.coverageZones, "coverageZones", { max: 80 }).forEach((z, i) => text(z, `coverageZones[${i}]`, "Zona", 80));

  return { errors, warnings };
}

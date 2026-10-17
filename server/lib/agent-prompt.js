/**
 * Prompt del agente de WhatsApp (Boosfy) generado a partir del contenido real de la landing.
 * Así el agente responde exactamente lo que dice la página y se puede regenerar cuando
 * se editan precios, equipos, cupones o textos en el panel.
 */
import fs from "node:fs";
import path from "node:path";
import { extractTexts } from "./template.js";

/** Textos de la landing que SÍ se vuelcan al prompt (hechos, condiciones, pasos, avisos). */
export const INCLUDED_TEXT_KEYS = [
  "hero.eyebrow", "hero.titulo", "hero.sub", "hero.promo", "hero.recomendable",
  "hero.sucursal.sub", "hero.domicilio.sub", "hero.callcenter.sub",
  "hero.badge1", "hero.badge2", "hero.badge3",
  "opciones.lite.titulo", "opciones.lite.desc", "opciones.premium.titulo", "opciones.premium.desc",
  "opciones.simple.titulo", "opciones.simple.desc", "opciones.recomendacion",
  "ayudar.sucursal.desc", "ayudar.domicilio.desc", "ayudar.callcenter.desc", "ayudar.recomendable",
  "planes.sub", "planes.nota", "empresarial.texto",
  "dom.titulo", "dom.lead", "dom.paso1", "dom.paso2", "dom.paso3", "dom.paso4", "dom.paso5",
  "cob.titulo", "cob.sub", "cob.nota.antes", "cob.nota.link", "cob.nota.despues",
  "cc.titulo", "cc.serv1", "cc.serv2", "cc.serv3", "cc.serv4", "cc.serv5",
  "cc.req.titulo", "cc.req1", "cc.req2", "cc.req3", "cc.paso1", "cc.paso2", "cc.paso3",
  "ubic.titulo", "cup.titulo", "cup.sub", "cup.legal", "tienda.titulo", "tienda.sub",
  "port.titulo", "port.sub", "port.stat1.valor", "port.stat1.label", "port.stat2.valor", "port.stat2.label",
  "port.stat3.valor", "port.stat3.label", "port.proceso.titulo", "port.paso1", "port.paso2", "port.paso3", "port.paso4", "port.nota",
  "cat.nota", "cot.sub",
  "foot.desc", "foot.horario1", "foot.horario2", "foot.direccion", "foot.legal",
];

/** Textos que NO van al prompt porque son interfaz (menús, botones, etiquetas, SEO, mensajes de WhatsApp…). */
export const EXCLUDED_TEXT_KEYS = [
  /^seo\./, /^nav\./, /^header\./, /^wa\./, /^toast\./, /^final\./,
  /^foot\.(nav\.|contacto\.|whatsapp$)/, /^planes\.(tab\.|titulo$)/, /^cat\.(tag|titulo|sub|marca|todas)$/, /^faq\./,
  /^hero\.scroll$/, /^hero\.(sucursal|domicilio|callcenter)\.titulo$/, /\.(tag|cta|boton)$/,
  /^opciones\.(titulo|sub)$/, /^ayudar\.(titulo|sub|sucursal\.titulo|domicilio\.titulo|callcenter\.titulo)$/,
  /^ubic\.sub$/, /^cot\.titulo$/,
];

/** Textos vigentes: el valor original del HTML, salvo lo que se haya editado en el panel. */
export function effectiveTexts(siteDir, content) {
  const html = fs.readFileSync(path.join(siteDir, "index.html"), "utf8");
  const out = {};
  for (const { key, value } of extractTexts(html)) out[key] = value;
  return { ...out, ...(content.texts || {}) };
}

const plain = (s) => String(s).replace(/\*\*/g, "");
const money = (n) => `$${Number(n).toLocaleString("es-MX")}`;
const money2 = (n) => `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const todayMx = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

function sectionPlans(c) {
  const lines = [];
  lines.push("### Planes PREMIUM (servicio + equipo)");
  lines.push("Incluyen la posibilidad de contratar con equipo. Portabilidad: 20% de descuento durante 6 meses a partir del 3er mes.");
  for (const p of c.plans.premium) {
    lines.push(`- ${p.name}: ${money(p.price)}/mes · ${p.gb} GB${p.note ? ` · ${p.note}` : ""}`);
  }
  lines.push("");
  lines.push("### Planes LITE (solo servicio, sin equipo)");
  for (const p of c.plans.lite) {
    lines.push(`- ${p.name}: ${money(p.price)}/mes · ${p.gb} GB · ${p.socials} redes sociales ilimitadas a elegir · ${p.portability} de descuento por portabilidad (6 meses, desde el 3er mes)`);
  }
  lines.push("");
  lines.push("### Planes SIMPLE (anuales, pago por adelantado; duplican los GB)");
  for (const p of c.plans.simple) {
    lines.push(`- ${p.name}: ${money(p.price)}/mes · ${p.gbBase} GB base, doble de GB: hasta ${p.gbDouble} GB`);
    for (const t of p.terms) lines.push(`    · ${t.months} meses: pagas ${t.pay}, ${t.free} de regalo, total ${money(t.total)}`);
  }
  return lines.join("\n");
}

function sectionDevices(c) {
  const visible = c.devices.filter((d) => !d.hidden);
  const brands = [...new Set(visible.map((d) => d.brand))].sort((a, b) => a.localeCompare(b, "es"));
  const lines = [];
  for (const brand of brands) {
    lines.push(`**${brand}**`);
    for (const d of visible.filter((x) => x.brand === brand)) {
      lines.push(`- ${d.model} — Plan ${d.plan} — ${money2(d.monthly)}/mes${d.term ? ` — ${d.term}` : ""}`);
    }
  }
  return lines.join("\n");
}

function sectionStores(c) {
  return c.stores.map((s, i) => [
    `${i + 1}. ${s.name}${s.principal ? " (sucursal principal)" : ""}`,
    `   Dirección: ${s.address}`,
    `   Horario: ${s.hours}`,
    `   Cómo llegar: ${s.map}`,
  ].join("\n")).join("\n");
}

function sectionCoupons(c, today, t) {
  const live = c.coupons.filter((x) => x.active !== false && (!x.from || x.from <= today) && (!x.to || x.to >= today));
  const lines = [];
  lines.push(`${plain(t("cup.titulo"))}`);
  lines.push(plain(t("cup.sub")));
  if (!live.length) {
    lines.push("Por ahora no hay cupones vigentes. Si la persona pregunta por un cupón, dile con honestidad que por el momento no hay ninguno activo y ofrécele que un asesor le confirme si hay alguna promoción.");
  } else {
    for (const x of live) {
      lines.push(`- ${x.title}: ${x.description} (monto: ${money(x.amount)} MXN; aplica a: ${x.product}${x.to ? `; vigente hasta ${x.to}` : ""})`);
    }
    lines.push("");
    lines.push(`Aviso: ${plain(t("cup.legal"))}`);
  }
  return lines.join("\n");
}

/**
 * @param {{content: object, texts: Record<string,string>, today?: string}} input
 */
export function buildAgentPrompt({ content: c, texts, today = todayMx() }) {
  const t = (key) => {
    if (!(key in texts)) throw new Error(`Texto inexistente en la landing: ${key}`);
    return texts[key];
  };
  const p = (key) => plain(t(key));
  const budgets = c.budgetRanges.map((r) => `${r.label} (${r.tag})`).join(" · ");

  return `# ROL
Eres el asistente virtual de WhatsApp de AT&T Barrio Cascatta · RedMóvil, en Puebla, México. ${p("foot.desc")} En la landing te presentan como: «${p("hero.eyebrow")}».
Atiendes a las personas que llegan desde la landing (att.fracesolutions.com) o escriben directamente por WhatsApp. Tu trabajo es resolver sus dudas sobre planes, equipos, portabilidad, cupones, puntos de venta, atención a domicilio y Call Center, y dejar a la persona lista para que un asesor humano del equipo cierre la contratación.
Lema de la marca: «${p("hero.titulo")}» ${p("hero.sub")}
Ventajas que puedes mencionar: ${p("hero.badge1")} · ${p("hero.badge2")} · ${p("hero.badge3")}.

# REGLAS INQUEBRANTABLES
1. Usa SOLO la información de este documento. No inventes precios, promociones, coberturas, fechas, requisitos ni nombres. Si algo no está aquí (cobertura exacta de una dirección, estatus de un trámite o de un crédito, precios de planes empresariales, equipos que no aparecen en el catálogo), dilo con honestidad y ofrece que un asesor lo confirme.
2. Los precios, GB, mensualidades, promociones y cupones son de referencia. La landing lo dice así: «${p("planes.sub")}» El precio final, la aprobación de crédito y la disponibilidad los confirma un asesor. Menciónalo cuando des cifras, sin repetirlo en cada mensaje.
3. NUNCA pidas ni aceptes por este chat: el NIP de portabilidad, contraseñas, códigos de verificación, datos de tarjeta o bancarios, ni fotos o datos de la INE. Si la persona los envía, pídele amablemente que no los comparta y explícale que solo se entregan al asesor autorizado durante el trámite.
4. No prometas aprobación de crédito, descuentos ni fechas que no estén aquí. No hables mal de otras compañías ni compares con ellas.
5. No trates temas ajenos al servicio. Si te preguntan algo fuera de tu alcance, redirige con amabilidad a lo que sí puedes ayudar.
6. Si la persona pide hablar con una persona, está molesta o tiene un caso que no puedes resolver: dile que un asesor del equipo la atenderá y que si quiere pasar con una persona ahora mismo puede escribir exactamente la palabra «agente».

# ESTILO
- Español de México, cálido, claro y profesional. Mensajes cortos (2 a 5 líneas), como en WhatsApp. Puedes usar algún emoji ocasional, sin exagerar.
- Haz UNA pregunta a la vez. Usa el nombre de la persona cuando lo sepas.
- Para listas largas (planes, equipos) muestra solo 3 opciones que encajen con lo que pidió y ofrece ver más.
- Si te saludan sin más, preséntate brevemente y pregunta cómo prefieren que los ayudes.

# FLUJO DE LA CONVERSACIÓN
1. Saluda y pregunta cómo prefiere ser atendida la persona (ver MODALIDADES).
2. Averigua qué necesita (ver QUÉ PUEDE CONTRATAR) y su presupuesto mensual aproximado (ver COTIZADOR).
3. Recomienda 2 o 3 opciones concretas con precio y GB, y resuelve dudas con la información de este documento.
4. Cuando muestre interés, reúne estos datos, uno por uno: nombre, modalidad (sucursal, domicilio o Call Center), producto de interés (plan, equipo, portabilidad, renovación, empresarial), presupuesto, y según la modalidad: punto de venta preferido (sucursal) o colonia/municipio (domicilio).
5. Resume lo acordado en un mensaje y avisa que un asesor dará seguimiento. La landing anuncia «${p("hero.badge3")}»; no garantices un tiempo exacto.

# MODALIDADES DE ATENCIÓN
- En sucursal: ${p("ayudar.sucursal.desc")} Lema en la landing: «${p("hero.sucursal.sub")}».
- A domicilio (${p("hero.recomendable")}): ${p("ayudar.domicilio.desc")} Lema en la landing: «${p("hero.domicilio.sub")}».
- Call Center / a distancia: ${p("ayudar.callcenter.desc")} Lema en la landing: «${p("hero.callcenter.sub")}».
La atención a domicilio es nuestro diferenciador: si la persona no puede o no quiere ir a la tienda, ofrécela.

# QUÉ PUEDE CONTRATAR
- ${p("opciones.lite.titulo")}: ${p("opciones.lite.desc")}
- ${p("opciones.premium.titulo")}: ${p("opciones.premium.desc")}
- ${p("opciones.simple.titulo")}: ${p("opciones.simple.desc")}
- Portabilidad, renovaciones y seguimiento de trámites.
- Planes empresariales: ${p("empresarial.texto")} No tenemos precios publicados: recoge los datos y deja que un asesor cotice.
${p("opciones.recomendacion")}

# PLANES Y PRECIOS (referencia; los confirma un asesor)
${sectionPlans(c)}

Nota importante: ${p("planes.nota")}

# COTIZADOR POR PRESUPUESTO
${p("cot.sub")}
Rangos de presupuesto mensual: ${budgets}.
Cómo recomendar: toma los planes (Premium, Lite y Simple) cuyo precio mensual cae dentro del rango de la persona y propón hasta 3, repartidos de menor a mayor precio. Si no hay coincidencia exacta, díselo y ofrece que un asesor la asesore personalmente.
${c.budgetRanges.map((r) => `- ${r.label}: planes de ${money(r.min)} a ${money(r.max)} al mes`).join("\n")}

# CATÁLOGO DE EQUIPOS CON MENSUALIDAD
Mensualidad por equipo según el plan indicado. Nota de la landing (uso interno: al cliente no le menciones «Excel» ni «hoja»; dile que son mensualidades de referencia que un asesor confirma): ${p("cat.nota")}
${sectionDevices(c)}
Si piden un equipo que no está en esta lista, dile que un asesor puede revisar su disponibilidad.

# PORTABILIDAD
${p("port.titulo")}
${p("port.sub")}
Datos clave: ${p("port.stat1.valor")} ${p("port.stat1.label")}; ${p("port.stat2.valor")} ${p("port.stat2.label")}; ${p("port.stat3.valor")} ${p("port.stat3.label")}.
${p("port.proceso.titulo")}
1. ${p("port.paso1")}
2. ${p("port.paso2")}
3. ${p("port.paso3")}
4. ${p("port.paso4")}
${p("port.nota")}
${p("hero.promo")}

# ATENCIÓN A DOMICILIO
${p("dom.titulo")}
${p("dom.lead")}
Cómo funciona:
1. ${p("dom.paso1")}
2. ${p("dom.paso2")}
3. ${p("dom.paso3")}
4. ${p("dom.paso4")}
5. ${p("dom.paso5")}

## ${p("cob.titulo")}
${p("cob.sub")}
Zonas donde recibimos solicitudes: ${c.coverageZones.join(", ")}.
${p("cob.nota.antes")} ${p("cob.nota.link")}${p("cob.nota.despues")}

# CALL CENTER / ATENCIÓN A DISTANCIA
${p("cc.titulo")}
Servicios a distancia: ${p("cc.serv1")}; ${p("cc.serv2")}; ${p("cc.serv3")}; ${p("cc.serv4")}; ${p("cc.serv5")}.
${p("cc.req.titulo")}:
- ${p("cc.req1")}
- ${p("cc.req2")}
- ${p("cc.req3")}
Cómo funciona:
1. ${p("cc.paso1")}
2. ${p("cc.paso2")}
3. ${p("cc.paso3")}

# PUNTOS DE VENTA — ${p("ubic.titulo")}
${sectionStores(c)}
Horario general que muestra la landing: ${p("foot.horario1")} · ${p("foot.horario2")} (sucursal principal: ${p("foot.direccion")}). Cada punto de venta tiene su horario arriba; si no sabes cuál le queda más cerca, pregunta su colonia o zona.

# CUPONES
${sectionCoupons(c, today, t)}
Cómo gestionar un cupón: pregunta a qué punto de venta piensa acudir (para que Barrio Cascatta dé seguimiento a su visita), confirma qué cupón aplica a lo que va a contratar, toma su nombre y avisa que un asesor se lo confirmará. No digas que ya está aplicado.

# TU TIENDA Y EL EQUIPO
${p("tienda.titulo")}. ${p("tienda.sub")}
Equipo comercial: ${c.team.map((m) => `${m.name} (${m.role})`).join(", ")}.
No compartas teléfonos personales del equipo (no están publicados): el seguimiento lo asigna el equipo a través del CRM.

# PREGUNTAS FRECUENTES (respuestas oficiales)
Nota: algunas respuestas dicen «esta página» o «desde esta página»; tú ya estás conversando por WhatsApp con la persona, así que adapta la redacción sin cambiar el contenido.
${c.faqs.map((f) => `P: ${f.q}\nR: ${f.a}`).join("\n\n")}

# AVISOS LEGALES
${p("foot.legal")}

# FIN DE LA CONVERSACIÓN
Cuando ya tengas los datos y el interés de la persona, despídete con amabilidad, recuérdale que un asesor dará seguimiento y que puede escribir «agente» si prefiere atención de una persona en ese momento. Si solo preguntó algo puntual, resuélvelo y ofrece ayudarle con algo más.
`;
}

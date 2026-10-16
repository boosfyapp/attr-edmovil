/**
 * Etiqueta y sección de cada texto editable (clave `data-cms` de index.html).
 * Una prueba exige que este mapa y el HTML tengan exactamente las mismas claves.
 * `long: true` → campo de varias líneas (máx. 600 caracteres); si no, una línea (máx. 160).
 */

export const SECTION_ORDER = [
  "Buscadores y redes (SEO)",
  "Menú",
  "Portada",
  "¿Qué quieres contratar?",
  "¿Cómo prefieres que te ayudemos?",
  "Planes",
  "Atención a domicilio",
  "Cobertura",
  "Call Center",
  "Ubicaciones",
  "Cupones",
  "Equipo comercial",
  "Portabilidad",
  "Catálogo de equipos",
  "Cotizador",
  "Preguntas frecuentes",
  "Cierre y pie de página",
  "Mensajes de WhatsApp",
];

const labels = {};
function section(name, rows) {
  for (const [key, label, long] of rows) labels[key] = { label, section: name, long: Boolean(long) };
}

section("Buscadores y redes (SEO)", [
  ["seo.title", "Título de la pestaña del navegador"],
  ["seo.description", "Descripción para Google", true],
  ["seo.ogTitle", "Título al compartir en redes"],
  ["seo.ogDescription", "Descripción al compartir en redes", true],
]);

section("Menú", [
  ["nav.ayudar", "Enlace: ¿Cómo ayudarte?"],
  ["nav.planes", "Enlace: Planes"],
  ["nav.equipos", "Enlace: Equipos"],
  ["nav.domicilio", "Enlace: Domicilio"],
  ["nav.ubicaciones", "Enlace: Ubicaciones"],
  ["nav.preguntas", "Enlace: Preguntas"],
  ["header.whatsapp", "Botón de WhatsApp del encabezado"],
]);

section("Portada", [
  ["hero.eyebrow", "Etiqueta sobre el título"],
  ["hero.titulo", "Título principal", true],
  ["hero.sub", "Subtítulo", true],
  ["hero.promo", "Promoción destacada (portabilidad)"],
  ["hero.sucursal.titulo", "Botón 1: título (sucursal)"],
  ["hero.sucursal.sub", "Botón 1: descripción"],
  ["hero.recomendable", "Etiqueta «Más recomendable» del botón 2"],
  ["hero.domicilio.titulo", "Botón 2: título (domicilio)"],
  ["hero.domicilio.sub", "Botón 2: descripción"],
  ["hero.callcenter.titulo", "Botón 3: título (Call Center)"],
  ["hero.callcenter.sub", "Botón 3: descripción"],
  ["hero.badge1", "Insignia 1"],
  ["hero.badge2", "Insignia 2"],
  ["hero.badge3", "Insignia 3"],
  ["hero.scroll", "Texto «Descubre más»"],
]);

section("¿Qué quieres contratar?", [
  ["opciones.tag", "Etiqueta de la sección"],
  ["opciones.titulo", "Título"],
  ["opciones.sub", "Subtítulo", true],
  ["opciones.lite.titulo", "Opción 1: título"],
  ["opciones.lite.desc", "Opción 1: descripción"],
  ["opciones.lite.cta", "Opción 1: enlace"],
  ["opciones.premium.titulo", "Opción 2: título"],
  ["opciones.premium.desc", "Opción 2: descripción"],
  ["opciones.premium.cta", "Opción 2: enlace"],
  ["opciones.simple.titulo", "Opción 3: título"],
  ["opciones.simple.desc", "Opción 3: descripción"],
  ["opciones.simple.cta", "Opción 3: enlace"],
  ["opciones.recomendacion", "Nota de planes recomendados (usa **negritas**)", true],
]);

section("¿Cómo prefieres que te ayudemos?", [
  ["ayudar.tag", "Etiqueta de la sección"],
  ["ayudar.titulo", "Título"],
  ["ayudar.sub", "Subtítulo", true],
  ["ayudar.sucursal.titulo", "Tarjeta sucursal: título"],
  ["ayudar.sucursal.desc", "Tarjeta sucursal: descripción", true],
  ["ayudar.sucursal.cta", "Tarjeta sucursal: acción"],
  ["ayudar.recomendable", "Etiqueta «Más recomendable»"],
  ["ayudar.domicilio.titulo", "Tarjeta domicilio: título"],
  ["ayudar.domicilio.desc", "Tarjeta domicilio: descripción", true],
  ["ayudar.domicilio.cta", "Tarjeta domicilio: acción"],
  ["ayudar.callcenter.titulo", "Tarjeta Call Center: título"],
  ["ayudar.callcenter.desc", "Tarjeta Call Center: descripción", true],
  ["ayudar.callcenter.cta", "Tarjeta Call Center: acción"],
]);

section("Planes", [
  ["planes.tag", "Etiqueta de la sección"],
  ["planes.titulo", "Título"],
  ["planes.sub", "Subtítulo", true],
  ["planes.tab.premium", "Pestaña Premium"],
  ["planes.tab.lite", "Pestaña Lite"],
  ["planes.tab.simple", "Pestaña Simple"],
  ["empresarial.texto", "Aviso de planes empresariales (usa **negritas**)", true],
  ["empresarial.boton", "Botón de planes empresariales"],
  ["planes.nota", "Nota al pie de los planes", true],
]);

section("Atención a domicilio", [
  ["dom.tag", "Etiqueta de la sección"],
  ["dom.titulo", "Título", true],
  ["dom.lead", "Texto principal", true],
  ["dom.boton", "Botón"],
  ["dom.paso1", "Paso 1 (usa **negritas**)", true],
  ["dom.paso2", "Paso 2 (usa **negritas**)", true],
  ["dom.paso3", "Paso 3 (usa **negritas**)", true],
  ["dom.paso4", "Paso 4 (usa **negritas**)", true],
  ["dom.paso5", "Paso 5 (usa **negritas**)", true],
]);

section("Cobertura", [
  ["cob.tag", "Etiqueta de la sección"],
  ["cob.titulo", "Título"],
  ["cob.sub", "Subtítulo", true],
  ["cob.nota.antes", "Nota: texto antes del enlace"],
  ["cob.nota.link", "Nota: texto del enlace"],
  ["cob.nota.despues", "Nota: texto después del enlace", true],
]);

section("Call Center", [
  ["cc.tag", "Etiqueta de la sección"],
  ["cc.titulo", "Título", true],
  ["cc.serv1", "Servicio 1"],
  ["cc.serv2", "Servicio 2"],
  ["cc.serv3", "Servicio 3"],
  ["cc.serv4", "Servicio 4"],
  ["cc.serv5", "Servicio 5"],
  ["cc.req.titulo", "Título de los requisitos"],
  ["cc.req1", "Requisito 1"],
  ["cc.req2", "Requisito 2"],
  ["cc.req3", "Requisito 3"],
  ["cc.boton", "Botón"],
  ["cc.paso1", "Paso 1 (usa **negritas**)", true],
  ["cc.paso2", "Paso 2 (usa **negritas**)", true],
  ["cc.paso3", "Paso 3 (usa **negritas**)", true],
]);

section("Ubicaciones", [
  ["ubic.tag", "Etiqueta de la sección"],
  ["ubic.titulo", "Título"],
  ["ubic.sub", "Subtítulo", true],
]);

section("Cupones", [
  ["cup.tag", "Etiqueta de la sección"],
  ["cup.titulo", "Título"],
  ["cup.sub", "Subtítulo", true],
  ["cup.legal", "Aviso legal de los cupones", true],
]);

section("Equipo comercial", [
  ["tienda.tag", "Etiqueta de la sección"],
  ["tienda.titulo", "Título", true],
  ["tienda.sub", "Subtítulo", true],
]);

section("Portabilidad", [
  ["port.titulo", "Título", true],
  ["port.sub", "Subtítulo", true],
  ["port.boton", "Botón"],
  ["port.stat1.valor", "Dato 1: cifra"],
  ["port.stat1.label", "Dato 1: descripción"],
  ["port.stat2.valor", "Dato 2: cifra"],
  ["port.stat2.label", "Dato 2: descripción"],
  ["port.stat3.valor", "Dato 3: cifra"],
  ["port.stat3.label", "Dato 3: descripción"],
  ["port.proceso.titulo", "Título del proceso"],
  ["port.paso1", "Paso 1", true],
  ["port.paso2", "Paso 2 (usa **negritas**)", true],
  ["port.paso3", "Paso 3", true],
  ["port.paso4", "Paso 4 (usa **negritas**)", true],
  ["port.nota", "Nota sobre el NIP", true],
]);

section("Catálogo de equipos", [
  ["cat.tag", "Etiqueta de la sección"],
  ["cat.titulo", "Título"],
  ["cat.sub", "Subtítulo", true],
  ["cat.marca", "Texto del filtro «Marca»"],
  ["cat.todas", "Opción «Todas las marcas»"],
  ["cat.nota", "Nota al pie del catálogo", true],
]);

section("Cotizador", [
  ["cot.tag", "Etiqueta de la sección"],
  ["cot.titulo", "Título"],
  ["cot.sub", "Subtítulo", true],
]);

section("Preguntas frecuentes", [
  ["faq.tag", "Etiqueta de la sección"],
  ["faq.titulo", "Título"],
]);

section("Cierre y pie de página", [
  ["final.titulo", "Cierre: título"],
  ["final.sub", "Cierre: subtítulo", true],
  ["final.sucursal", "Cierre: botón sucursal"],
  ["final.domicilio", "Cierre: botón domicilio"],
  ["final.callcenter", "Cierre: botón Call Center"],
  ["final.whatsapp", "Cierre: botón WhatsApp"],
  ["foot.desc", "Pie: descripción", true],
  ["foot.nav.titulo", "Pie: título de navegación"],
  ["foot.nav.planes", "Pie: enlace Planes"],
  ["foot.nav.domicilio", "Pie: enlace Atención a domicilio"],
  ["foot.nav.ubicaciones", "Pie: enlace Ubicaciones"],
  ["foot.nav.faq", "Pie: enlace Preguntas frecuentes"],
  ["foot.contacto.titulo", "Pie: título de contacto"],
  ["foot.whatsapp", "Pie: enlace WhatsApp"],
  ["foot.horario1", "Pie: horario 1"],
  ["foot.horario2", "Pie: horario 2"],
  ["foot.direccion", "Pie: dirección"],
  ["foot.legal", "Pie: aviso legal", true],
  ["toast.texto", "Aviso al abrir WhatsApp desde el cotizador"],
]);

section("Mensajes de WhatsApp", [
  ["wa.general", "Mensaje general (encabezado y botón flotante)", true],
  ["wa.sucursal", "Mensaje: atención en sucursal", true],
  ["wa.domicilio", "Mensaje: atención a domicilio", true],
  ["wa.callcenter", "Mensaje: Call Center", true],
  ["wa.empresarial", "Mensaje: planes empresariales", true],
  ["wa.cobertura", "Mensaje: validar cobertura", true],
  ["wa.portabilidad", "Mensaje: portabilidad", true],
  ["wa.final", "Mensaje: botón final de WhatsApp", true],
  ["wa.footer", "Mensaje: enlace del pie de página", true],
]);

export const TEXT_LABELS = Object.freeze(labels);

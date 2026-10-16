/* ============================================================
   AT&T Barrio Cascatta — Datos administrables
   Editar aquí precios, planes, puntos de venta y equipo comercial.
   No requiere tocar el HTML ni el CSS.
   ============================================================ */

/* Número principal de WhatsApp (Gerente Sergio Lozano).
   Formato: 52 + 10 dígitos, sin espacios ni signos. */
const WHATSAPP_PRINCIPAL = "522223303739";

/* ---------- Equipo comercial ---------- */
const TEAM = [
  { role: "Gerente", name: "Sergio Lozano", image: "assets/sergio-lozano.png", principal: true },
  { role: "Ejecutivo", name: "Isaac Álvarez", image: "assets/isaac-alvarez.png" },
  { role: "Ejecutiva", name: "Ingrid Mora", image: "assets/ingrid-mora.png" },
  { role: "Ejecutivo", name: "Carlos Hidalgo", image: "assets/carlos-hidalgo.png" },
  { role: "Ejecutivo", name: "Miguel López", image: "assets/miguel-lopez.png" },
  { role: "Ejecutiva", name: "Yeinni Ventura", image: "assets/yeinni-ventura.png" },
];

/* ---------- Puntos de venta (9) ---------- */
const STORES = [
  {
    name: "AT&T Barrio Cascatta",
    principal: true,
    address: "Blvd. de Las Cascadas 1301, Local 05, Lomas de Angelópolis, 72865, Pue.",
    hours: "Lun–Sáb 10:00–20:00 · Dom 11:00–20:00",
    map: "https://maps.app.goo.gl/zbt9F9ECwAmotoL89?g_st=ac",
  },
  {
    name: "Explanada Puebla",
    address: "Priv. Alejandra 512, Loc. RF-18, Santiago Momoxpan, Álvaro Obregón, 72775, Pue.",
    hours: "Lun–Dom 11:00–21:00",
    map: "https://maps.app.goo.gl/crWFXckxJX78GBAN7?g_st=ac",
  },
  {
    name: "Plaza Crystal",
    address: "Blvd. Capitán Carlos Camacho Espíritu 115, Centro Comercial Plaza Cristal, 72440, Pue.",
    hours: "Lun–Dom 11:00–21:00",
    map: "https://maps.app.goo.gl/uaVuReeb1mqen5BE8?g_st=ac",
  },
  {
    name: "Paseo Destino",
    address: "Av. Las Torres 1923, Reserva Territorial Atlixcáyotl, 72450, Pue.",
    hours: "Lun–Sáb 10:00–20:00 · Dom 11:00–20:00",
    map: "https://maps.app.goo.gl/HyzXE7Rg8JFSxwUG9?g_st=ac",
  },
  {
    name: "Kentro / Sonata",
    address: "Atlixcáyotl 3432, San Martinito, 72825, Pue.",
    hours: "Lun–Sáb 10:00–20:00 · Dom 11:00–20:00",
    map: "https://maps.app.goo.gl/qJPP98XDRqbR1tHn8?g_st=ac",
  },
  {
    name: "Galerías Serdán",
    address: "Blvd. Hermanos Serdán 270, Colonia Rancho Posadas, 72060, Pue.",
    hours: "Lun–Dom 11:00–21:00",
    map: "https://maps.app.goo.gl/gGo29xF3gaMw8rkm6?g_st=ac",
  },
  {
    name: "Vía San Ángel (planta alta)",
    address: "Atlixcáyotl 1504, Planta Alta, Reserva Territorial Atlixcáyotl, 72810, Pue.",
    hours: "Lun–Sáb 10:00–20:00 · Dom 11:00–20:00",
    map: "https://maps.app.goo.gl/KpBMiebgbKQXgXn5A?g_st=ac",
  },
  {
    name: "CD Judicial",
    address: "Av. la Luna 3901, Tlaxcalancingo, 72830 San Bernardino Tlaxcalancingo, Pue.",
    hours: "Lun–Sáb 10:00–20:00 · Dom 11:00–20:00",
    map: "https://www.google.com/maps/search/?api=1&query=AT%26T%20Paseo%20Puebla%2C%20Av.%20la%20Luna%203901%2C%20Tlaxcalancingo%2C%20Puebla",
  },
  {
    name: "Plaza Loreto",
    address: "Diag. Defensores de la República 226, Los Pinos, 72103, Pue.",
    hours: "Lun–Dom 11:00–21:00",
    map: "https://www.google.com/maps/place/AT%26T+l+PLAZA+LORETO/@19.064839,-98.1787312,16z/data=!3m1!4b1!4m6!3m5!1s0x85cfc1002346c6d9:0xccbddfa18d32abc2!8m2!3d19.0648339!4d-98.1761563!16s%2Fg%2F11vwgmb43f?entry=ttu&g_ep=EgoyMDI2MDkxNC4wIKXMDSoASAFQAw%3D%3D",
  },
];

/* ---------- Planes PREMIUM (con equipo) ----------
   Portabilidad: 20% desc. 6 meses a partir del 3er mes. */
const PLANS_PREMIUM = [
  { name: "Azul 2", price: 485, gb: 8 },
  { name: "Azul 3", price: 600, gb: 14 },
  { name: "Plata", price: 700, gb: 25 },
  { name: "Oro", price: 775, gb: 32 },
  { name: "Black", price: 875, gb: 42 },
  { name: "Platino", price: 1085, gb: 50 },
  { name: "Diamante", price: 1350, gb: 55 },
  { name: "Titanio", price: 1649, gb: 42, note: "Incluye iPhone 17 256GB · se actualiza cada 13 meses", hasAsterisk: true },
];

/* ---------- Planes LITE (solo servicio, sin equipo) ----------
   Portabilidad: Lite/Lite1 10% · Lite2/Lite3 20% · Lite4/Lite5 25% (6 meses, desde 3er mes). */
const PLANS_LITE = [
  { name: "Lite", price: 299, gb: 4, socials: 3, portability: "10%" },
  { name: "Lite 1", price: 399, gb: 12, socials: 6, portability: "10%" },
  { name: "Lite 2", price: 499, gb: 20, socials: 6, portability: "20%" },
  { name: "Lite 3", price: 599, gb: 30, socials: 6, portability: "20%" },
  { name: "Lite 4", price: 719, gb: 50, socials: 6, portability: "25%" },
  { name: "Lite 5", price: 1050, gb: 120, socials: 6, portability: "25%" },
];

/* ---------- Planes SIMPLE (anual, pago por adelantado) ---------- */
const PLANS_SIMPLE = [
  {
    name: "Simple 299", price: 299, gbBase: 1.5, gbDouble: 3,
    terms: [
      { months: 12, pay: 8, free: 4, total: 2392 },
      { months: 18, pay: 11, free: 7, total: 3289 },
      { months: 24, pay: 15, free: 9, total: 4485 },
    ],
  },
  {
    name: "Simple 399", price: 399, gbBase: 2.5, gbDouble: 5,
    terms: [
      { months: 12, pay: 8, free: 4, total: 3192 },
      { months: 18, pay: 11, free: 7, total: 4389 },
      { months: 24, pay: 15, free: 9, total: 5985 },
    ],
  },
  {
    name: "Simple 599", price: 599, gbBase: 4, gbDouble: 8,
    terms: [
      { months: 12, pay: 8, free: 4, total: 4792 },
      { months: 18, pay: 11, free: 7, total: 6589 },
      { months: 24, pay: 15, free: 9, total: 8985 },
    ],
  },
  {
    name: "Simple 649", price: 649, gbBase: 6, gbDouble: 12,
    terms: [
      { months: 12, pay: 8, free: 4, total: 5192 },
      { months: 18, pay: 11, free: 7, total: 7139 },
      { months: 24, pay: 15, free: 9, total: 9735 },
    ],
  },
];

/* ---------- Cotizador por presupuesto ----------
   Cada rango sugiere planes de las 3 categorías que caben en el presupuesto mensual. */
const BUDGET_RANGES = [
  { id: "accesible", label: "$450 – $1,000", tag: "Opciones accesibles", min: 450, max: 1000 },
  { id: "intermedio", label: "$1,001 – $1,500", tag: "Opciones intermedias", min: 1001, max: 1500 },
  { id: "premium", label: "$1,501 – $2,500", tag: "Opciones premium", min: 1501, max: 2500 },
];

/* ---------- FAQ ---------- */
const FAQS = [
  {
    q: "¿Puedo conservar mi número si cambio a AT&T?",
    a: "Sí. Al portar tu número desde otra compañía lo conservas sin cambios, y además obtienes un descuento por portabilidad vigente en planes Premium y Lite.",
  },
  {
    q: "¿Cómo funciona la portabilidad?",
    a: "Marca 051 desde la línea que deseas portar para obtener tu NIP. Compártelo únicamente con el asesor autorizado durante el trámite, nunca en el formulario inicial. El cambio puede tardar de 24 a 36 horas; el asesor te acompaña hasta la activación.",
  },
  {
    q: "¿Qué necesito para contratar?",
    a: "Identificación oficial vigente (INE) o FM3. Para atención a distancia (Call Center) además necesitas conexión a internet y un celular disponible para captura de biométrico.",
  },
  {
    q: "¿Puedo comprar un equipo con plan?",
    a: "Sí, los planes Premium incluyen equipo. Consulta el catálogo vigente con tu ejecutivo, sujeto a disponibilidad y aprobación.",
  },
  {
    q: "¿Puedo recibir atención a domicilio?",
    a: "Sí. Validamos tu zona y, si aplica, un ejecutivo te visita para mostrarte opciones de plan y equipo. Sujeto a cobertura y restricciones del servicio.",
  },
  {
    q: "¿En qué zonas tienen atención a domicilio?",
    a: "Atendemos solicitudes en Puebla y municipios cercanos. La cobertura y disponibilidad de tu dirección se confirman con un asesor antes de agendar.",
  },
  {
    q: "¿Puedo contratar sin acudir a sucursal?",
    a: "Sí, a través de nuestro Call Center / atención a distancia, cumpliendo los requisitos de identificación y validación biométrica.",
  },
  {
    q: "¿Qué requisitos necesito para atención por Call Center?",
    a: "INE, conexión a internet y un teléfono celular disponible para la captura del biométrico.",
  },
  {
    q: "¿Puedo elegir cuánto quiero pagar al mes?",
    a: "Sí, usa nuestro cotizador: dinos tu presupuesto mensual y te mostramos las opciones de equipo y plan que se ajustan a lo que quieres invertir.",
  },
  {
    q: "¿Dónde están sus 9 puntos de venta?",
    a: "Tenemos presencia en distintos puntos de Puebla. Consulta el listado completo con dirección, horario y mapa en la sección de ubicaciones.",
  },
  {
    q: "¿Cómo puedo contactar a un ejecutivo?",
    a: "Escríbenos por WhatsApp desde esta página. Un asesor del equipo dará seguimiento a tu solicitud; la asignación individual se confirma en nuestro CRM.",
  },
];

/* ---------- Cupones ----------
   amount: monto en MXN · product: texto que va en el mensaje de WhatsApp
   from / to: vigencia opcional (YYYY-MM-DD, inclusive, hora de Ciudad de México). */
const COUPONS = [
  {
    id: "premium",
    title: "$200 para servicio + equipo",
    description: "Descuento en el pago inicial de Plan Premium con equipo.",
    amount: 200,
    product: "Plan Premium con equipo",
    image: "assets/cupon-premium-200.png",
    active: true,
    from: "",
    to: "",
  },
  {
    id: "servicio",
    title: "$150 para solo servicio",
    description: "Descuento en tu primer pago al contratar solo servicio.",
    amount: 150,
    product: "solo servicio",
    image: "assets/cupon-servicio-150.png",
    active: true,
    from: "",
    to: "",
  },
];

/* ---------- Zonas de atención a domicilio ---------- */
const COVERAGE_ZONES = [
  "Puebla capital", "San Andrés Cholula", "San Pedro Cholula", "Cuautlancingo", "Amozoc", "Huejotzingo",
  "Coronango", "Ocoyucan", "Atlixco", "San Martín Texmelucan", "San Miguel Xoxtla", "Juan C. Bonilla",
  "Lomas de Angelópolis", "Angelópolis / Sonata", "Zavaleta / La Paz", "Centro Histórico", "Las Ánimas / Estrella de Puebla",
];

/* ---------- Ajustes y colores de marca (valores por defecto) ---------- */
const SETTINGS_DEFAULT = { whatsapp: WHATSAPP_PRINCIPAL, ga4: "G-BTCKL6ENXP", metaPixel: "" };
const THEME_DEFAULT = { azul: "#009fdb", morado: "#bf0cea", rosa: "#e72e70", naranja: "#ff8226", whatsapp: "#25d366" };

/* Traduce una ruta de error del servidor (p. ej. plans.premium[2].price) a algo legible y enlazable. */

const SECTIONS = {
  texts: ["Textos", "#/textos"],
  settings: ["Ajustes", "#/ajustes"],
  theme: ["Apariencia", "#/apariencia"],
  plans: ["Planes", "#/planes"],
  budgetRanges: ["Planes › Cotizador por presupuesto", "#/planes"],
  devices: ["Equipos", "#/equipos"],
  team: ["Equipo comercial", "#/equipo"],
  stores: ["Tiendas", "#/equipo"],
  coupons: ["Cupones", "#/cupones"],
  faqs: ["Preguntas frecuentes", "#/faq"],
  coverageZones: ["Zonas de cobertura", "#/faq"],
};

const FIELD_LABELS = {
  price: "Precio", name: "Nombre", gb: "GB", monthly: "Mensualidad", model: "Modelo", brand: "Marca", plan: "Plan",
  image: "Foto", title: "Título", amount: "Monto", description: "Descripción", from: "Desde", to: "Hasta", q: "Pregunta", a: "Respuesta",
  address: "Dirección", hours: "Horario", map: "Mapa", role: "Puesto", whatsapp: "WhatsApp", ga4: "Google Analytics", metaPixel: "Pixel de Meta",
};

function itemName(content, tokens) {
  let node = content;
  for (const token of tokens) {
    if (node === undefined || node === null) return null;
    node = node[token];
  }
  return node && typeof node === "object" ? (node.name || node.model || node.title || node.q || node.label || null) : null;
}

/** @returns {{section:string, item:string|null, field:string|null, route:string}} */
export function describePath(content, path) {
  const tokens = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  const [top, ...rest] = tokens;
  const [section, route] = SECTIONS[top] || ["Contenido", "#/inicio"];
  let item = null;
  let field = null;
  if (top === "texts") {
    field = rest.join(".");
  } else if (top === "plans") {
    item = itemName(content, tokens.slice(0, 3));
    field = FIELD_LABELS[tokens[tokens.length - 1]] || null;
  } else if (rest.length) {
    item = itemName(content, tokens.slice(0, 2));
    field = FIELD_LABELS[tokens[tokens.length - 1]] || null;
  }
  return { section, item, field, route };
}

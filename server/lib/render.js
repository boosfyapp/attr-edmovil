import { darken, hexToRgb, lighten } from "./color.js";

/** JSON seguro para incrustar en un <script> o servir como JS. */
function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(String.fromCharCode(0x2028)).join("\\u2028")
    .split(String.fromCharCode(0x2029)).join("\\u2029");
}

/** Archivo JS que la landing carga: window.SITE_CONTENT = {...} */
export function renderContentJs(doc, { version = 0 } = {}) {
  const payload = {
    version,
    texts: doc.texts,
    settings: doc.settings,
    plans: doc.plans,
    budgetRanges: doc.budgetRanges,
    devices: doc.devices.filter((d) => !d.hidden),
    team: doc.team,
    stores: doc.stores,
    coupons: doc.coupons.filter((c) => c.active),
    faqs: doc.faqs,
    coverageZones: doc.coverageZones,
  };
  return `window.SITE_CONTENT=${safeJson(payload)};\n`;
}

export function renderEmptyContentJs() {
  return "window.SITE_CONTENT=null;\n";
}

/* Tonos derivados que usa hoy styles.css cuando el color es el original de marca. */
const BRAND_DERIVED = {
  "#009fdb": { dark: "#0080b3", light: "#5fcdf2" },
  "#25d366": { dark: "#1da851" },
};

const rgbList = (hex) => hexToRgb(hex).join(", ");

/** CSS de variables de color (se carga después de styles.css). */
export function renderThemeCss(theme) {
  const azul = theme.azul.toLowerCase();
  const wa = theme.whatsapp.toLowerCase();
  const azulDark = BRAND_DERIVED[azul]?.dark ?? darken(azul, 0.2);
  const azulLight = BRAND_DERIVED[azul]?.light ?? lighten(azul, 0.4);
  const waDark = BRAND_DERIVED[wa]?.dark ?? darken(wa, 0.18);
  return `:root{
  --att-blue:${azul};
  --att-blue-dark:${azulDark};
  --att-blue-light:${azulLight};
  --att-blue-rgb:${rgbList(azul)};
  --morado:${theme.morado.toLowerCase()};
  --rosa:${theme.rosa.toLowerCase()};
  --naranja:${theme.naranja.toLowerCase()};
  --wa-green:${wa};
  --wa-green-dark:${waDark};
  --wa-green-rgb:${rgbList(wa)};
  --shadow-blue:0 14px 40px rgba(${rgbList(azul)}, 0.3);
  --shadow-wa:0 10px 30px rgba(${rgbList(wa)}, 0.35);
}
`;
}

export const EMPTY_THEME_CSS = "/* sin tema publicado: se usan los colores de styles.css */\n";

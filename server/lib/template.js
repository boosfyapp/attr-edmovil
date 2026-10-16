/**
 * Extracción de los textos editables (`data-cms`) de index.html y renderizado
 * del HTML servido (versión publicada o vista previa del borrador).
 */

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };

export function decodeEntities(text) {
  return text.replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m);
}

const OPEN_TAG = /<([a-zA-Z][\w-]*)((?:\s+[^\s=>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
const ATTR = /([^\s=>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function parseAttrs(source) {
  const attrs = {};
  for (const m of source.matchAll(ATTR)) attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
  return attrs;
}

function innerToMarkup(inner, key) {
  let out = "";
  let index = 0;
  const tag = /<(\/?)([a-zA-Z][\w-]*)[^>]*>/g;
  for (const m of inner.matchAll(tag)) {
    const name = m[2].toLowerCase();
    if (name !== "b" && name !== "strong") {
      throw new Error(`data-cms="${key}": solo se permiten <b>/<strong> dentro del texto (encontrado <${name}>)`);
    }
    out += decodeEntities(inner.slice(index, m.index)) + "**";
    index = m.index + m[0].length;
  }
  out += decodeEntities(inner.slice(index));
  return out.replace(/\s+/g, " ").trim();
}

/**
 * @returns {{key:string, attr:string|null, value:string}[]} una entrada por clave, en orden de aparición.
 */
export function extractTexts(html) {
  const seen = new Map();
  for (const m of html.matchAll(OPEN_TAG)) {
    if (!m[2].includes("data-cms=")) continue;
    const tagName = m[1].toLowerCase();
    const attrs = parseAttrs(m[2]);
    const key = attrs["data-cms"];
    if (!key) continue;
    const attr = attrs["data-cms-attr"] || null;
    let value;
    if (attr) {
      if (!(attr in attrs)) throw new Error(`data-cms="${key}": falta el atributo ${attr}`);
      value = decodeEntities(attrs[attr]).replace(/\s+/g, " ").trim();
    } else {
      const closeTag = `</${tagName}>`;
      const start = m.index + m[0].length;
      const end = html.indexOf(closeTag, start);
      if (end < 0) throw new Error(`data-cms="${key}": no se encontró ${closeTag}`);
      const inner = html.slice(start, end);
      if (new RegExp(`<${tagName}[\\s>]`, "i").test(inner)) {
        throw new Error(`data-cms="${key}": etiquetas <${tagName}> anidadas no soportadas`);
      }
      value = innerToMarkup(inner, key);
    }
    const previous = seen.get(key);
    if (previous) {
      if (previous.value !== value || previous.attr !== attr) {
        throw new Error(`data-cms="${key}": usos con valores distintos ("${previous.value}" vs "${value}")`);
      }
      continue;
    }
    seen.set(key, { key, attr, value });
  }
  return [...seen.values()];
}

const CONTENT_REF = /published\/content\.js\?v=[^"']*/;
const THEME_REF = /published\/theme\.css\?v=[^"']*/;

/** HTML público: fija la versión en las URLs de contenido/tema (rompe el caché de Cloudflare). */
export function renderIndex(html, version) {
  const v = Number.isInteger(version) ? version : 0;
  return html.replace(CONTENT_REF, `published/content.js?v=${v}`).replace(THEME_REF, `published/theme.css?v=${v}`);
}

const CONTENT_TAG = /<script src="published\/content\.js\?v=[^"']*"><\/script>/;
const PREVIEW_SCRIPTS = '<script>window.__ATT_PREVIEW = true;</script>\n<script src="draft-content.js"></script>';

const PREVIEW_BAR =`<div id="att-preview-bar" style="position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#14181c;color:#fff;font:700 13px/1.2 system-ui,sans-serif;padding:9px 14px;text-align:center;letter-spacing:.02em;border-top:3px solid #ff8226">VISTA PREVIA — contenido sin publicar</div>`;

/** HTML de la vista previa (/preview/): usa el contenido del borrador y marca la página. */
export function renderPreview(html) {
  return html
    .replace(CONTENT_TAG, PREVIEW_SCRIPTS)
    .replace(THEME_REF, "draft-theme.css")
    .replace("</body>", `${PREVIEW_BAR}</body>`);
}

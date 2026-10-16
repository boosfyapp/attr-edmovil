/** Utilidades de color (hex #rrggbb) para validar contraste y derivar tonos del tema. */

export const HEX = /^#[0-9a-fA-F]{6}$/;

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  const part = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** mezcla con negro (amount 0..1) */
export function darken(hex, amount) {
  return rgbToHex(hexToRgb(hex).map((v) => v * (1 - amount)));
}

/** mezcla con blanco (amount 0..1) */
export function lighten(hex, amount) {
  return rgbToHex(hexToRgb(hex).map((v) => v + (255 - v) * amount));
}

function channel(v) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(hexA, hexB) {
  const [a, b] = [luminance(hexA), luminance(hexB)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

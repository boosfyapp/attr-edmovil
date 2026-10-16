/* Reduce la imagen en el navegador (máx. 1600 px), la convierte a WebP y la sube. */
import { api } from "../api.js";

const MAX_SIDE = 1600;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo convertir la imagen"))), type, quality));
}

export async function prepareImage(file) {
  if (!ACCEPTED.includes(file.type)) throw new Error("Formato no permitido: usa JPG, PNG o WebP");
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("No se pudo leer la imagen. ¿Está dañada?");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvasToBlob(canvas, "image/webp", 0.86);
}

/** Devuelve la ruta pública (p. ej. "uploads/abc.webp"). */
export async function uploadImage(file) {
  const blob = await prepareImage(file);
  const { path } = await api.upload(blob);
  return path;
}

/** Abre el selector de archivos y sube la imagen elegida. Devuelve null si se cancela. */
export function pickAndUpload() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPTED.join(",");
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try { resolve(await uploadImage(file)); } catch (error) { reject(error); }
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

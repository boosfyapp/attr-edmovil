import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { HttpError } from "./http.js";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Detecta el formato por firma (magic bytes); nunca confía en la extensión ni en el Content-Type. */
export function detectImage(buffer) {
  if (buffer.length >= 12 && buffer.toString("latin1", 0, 4) === "RIFF" && buffer.toString("latin1", 8, 12) === "WEBP") return "webp";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  return null;
}

/** Guarda la imagen con nombre = hash de su contenido (inmutable, sin duplicados). */
export function saveImage(dataDir, buffer) {
  if (!buffer.length) throw new HttpError(400, "No se recibió ninguna imagen");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new HttpError(413, "La imagen pesa más de 5 MB");
  const type = detectImage(buffer);
  if (!type) throw new HttpError(400, "Formato no permitido: usa JPG, PNG o WebP");
  const name = `${crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 32)}.${type}`;
  const dir = path.join(dataDir, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) {
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, file);
  }
  return { path: `uploads/${name}` };
}

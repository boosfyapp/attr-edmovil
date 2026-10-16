import fs from "node:fs";
import path from "node:path";
import { MIME, send } from "./http.js";

const SITE_ROOT_FILES = /^(index\.html|styles\.css|script\.js|data\.js|catalog-data\.js|favicon\.png|logo-[a-z-]+\.png)$/;
const SAFE_SEGMENT = /^[A-Za-z0-9_.@-]+$/;

/** Devuelve la ruta relativa normalizada o null si es sospechosa. */
export function cleanRelPath(rawPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  const segments = decoded.split("/").filter(Boolean);
  for (const segment of segments) {
    if (segment === "." || segment === ".." || !SAFE_SEGMENT.test(segment)) return null;
  }
  return segments.join("/");
}

export function isSiteFile(rel) {
  if (SITE_ROOT_FILES.test(rel)) return true;
  return rel.startsWith("assets/") && rel.length > "assets/".length;
}

function cacheHeader(ext, immutable) {
  if (immutable) return "public, max-age=31536000, immutable";
  if (ext === ".html" || ext === ".css" || ext === ".js" || ext === ".json") return "no-cache";
  return "public, max-age=2592000, immutable";
}

/**
 * Sirve un archivo de baseDir. Devuelve true si respondió.
 * `allow(rel)` decide si la ruta relativa es servible.
 */
export function serveStatic(res, baseDir, rawPath, { allow = () => true, immutable = false, method = "GET" } = {}) {
  const rel = cleanRelPath(rawPath);
  if (!rel || !allow(rel)) return false;
  const base = path.resolve(baseDir);
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) return false;
  let stat;
  try {
    stat = fs.statSync(full);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  const ext = path.extname(full).toLowerCase();
  const headers = {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": cacheHeader(ext, immutable),
  };
  if (method === "HEAD") {
    send(res, 200, undefined, headers);
    return true;
  }
  res.writeHead(200, headers);
  fs.createReadStream(full).pipe(res);
  return true;
}

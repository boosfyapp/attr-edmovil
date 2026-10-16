import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../server/app.js";
import { loadConfig } from "../server/lib/config.js";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function tmpDir(prefix = "att-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Arranca la app real con el sitio del repo y un dataDir temporal. */
export async function startApp(overrides = {}) {
  const dataDir = overrides.dataDir || tmpDir();
  const config = {
    ...loadConfig({}),
    siteDir: REPO_ROOT,
    dataDir,
    adminPassword: "clave-de-prueba-123",
    insecureCookies: true,
    ...overrides,
  };
  const server = createApp(config);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    config,
    port,
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** GET sin normalizar la ruta (fetch normaliza `..`). */
export function rawGet(port, rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: rawPath, method: "GET" }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.end();
  });
}

import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  return {
    port: Number(env.PORT || 80),
    siteDir: path.resolve(env.SITE_DIR || root),
    adminDir: path.resolve(env.ADMIN_DIR || path.join(root, "admin")),
    dataDir: path.resolve(env.DATA_DIR || (production ? "/data" : path.join(root, ".data"))),
    adminPassword: env.ADMIN_PASSWORD || "",
    insecureCookies: env.INSECURE_COOKIES === "1",
    /** Sincronización del prompt con el agente de Boosfy (exportador). Todo o nada. */
    agent: {
      url: (env.BOOSFY_AGENT_URL || "").replace(/\/+$/, ""),
      token: env.BOOSFY_AGENT_TOKEN || "",
      flowId: Number.parseInt(env.BOOSFY_AGENT_FLOW_ID || "", 10) || 0,
      production,
    },
  };
}

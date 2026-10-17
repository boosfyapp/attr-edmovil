/**
 * Botón «Actualizar Agente IA»: toma el contenido PUBLICADO de la landing, genera el prompt
 * y lo escribe en el nodo del agente de Boosfy a través del exportador (llave limitada a ese
 * único flujo). Nunca toca la clave API ni la asignación del flujo: solo `data.prompt`.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildAgentPrompt, effectiveTexts } from "./agent-prompt.js";
import { buildSeed } from "./seed.js";

export class AgentSyncError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

export function agentEnabled(config) {
  const a = config.agent;
  return Boolean(a && a.url && a.token && a.flowId);
}

/** Prompt con lo que hoy muestra la landing pública (versión publicada, o el original si no hay). */
export function currentAgentPrompt({ store, siteDir, today }) {
  const published = store.getPublishedContent();
  const content = published?.content ?? buildSeed(siteDir);
  const prompt = buildAgentPrompt({ content, texts: effectiveTexts(siteDir, content), today });
  return { prompt, hash: sha256(prompt), landingVersion: published?.version ?? null };
}

const stateFile = (dataDir) => path.join(dataDir, "agent.json");

function readState(dataDir) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(dataDir), "utf8"));
  } catch {
    return { lastSync: null, lastError: null };
  }
}

function writeState(dataDir, state) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = stateFile(dataDir);
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, file);
}

/** Estado para la pantalla del panel (sin secretos). */
export function agentStatus({ config, store, today }) {
  const enabled = agentEnabled(config);
  const state = readState(config.dataDir);
  const current = currentAgentPrompt({ store, siteDir: config.siteDir, today });
  return {
    enabled,
    flowId: enabled ? config.agent.flowId : null,
    lastSync: state.lastSync,
    lastError: state.lastError,
    upToDate: Boolean(state.lastSync && state.lastSync.promptHash === current.hash),
    landingVersion: current.landingVersion,
    promptChars: current.prompt.length,
  };
}

let running = false;

function describeFailure(status, code) {
  if (status === 401 || status === 403) {
    return code === "FLOW_NOT_ALLOWED"
      ? ["FLOW_NOT_ALLOWED", "La llave no tiene permiso para este agente. Avisa a Frace Solutions."]
      : ["UNAUTHORIZED", "Boosfy rechazó la llave del agente. Avisa a Frace Solutions."];
  }
  if (status === 404) return ["FLOW_NOT_FOUND", "No se encontró el flujo del agente en Boosfy. Verifica que no lo hayan eliminado o desactivado."];
  if (status === 422) return ["NO_AI_NODE", "El flujo de Boosfy no tiene un nodo de Agente IA. Revisa que no lo hayan quitado."];
  if (status === 413) return ["TOO_LARGE", "El prompt es demasiado grande para Boosfy."];
  return ["BOOSFY_ERROR", "Boosfy no pudo guardar el prompt. Inténtalo de nuevo en unos minutos."];
}

/**
 * Escribe el prompt actual en el agente de Boosfy.
 * @param {{config:object, store:object, fetchImpl?:typeof fetch, today?:string}} input
 */
export async function syncAgent({ config, store, fetchImpl = fetch, today }) {
  if (!agentEnabled(config)) throw new AgentSyncError("DISABLED", "La conexión con el agente de Boosfy no está configurada todavía.", 503);
  if (config.agent.production && !config.agent.url.startsWith("https://")) {
    throw new AgentSyncError("INSECURE_URL", "La conexión con Boosfy debe usar HTTPS.", 503);
  }
  if (running) throw new AgentSyncError("BUSY", "Ya hay una actualización en curso. Espera unos segundos.", 409);
  running = true;
  const at = new Date().toISOString();
  try {
    const current = currentAgentPrompt({ store, siteDir: config.siteDir, today });
    let response;
    try {
      response = await fetchImpl(`${config.agent.url}/write-prompt`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.agent.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          boosfyFlowId: config.agent.flowId,
          promptContent: current.prompt,
          versionId: `att-landing-v${current.landingVersion ?? 0}`,
          versionNumber: current.landingVersion ?? 0,
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new AgentSyncError("NETWORK", "No se pudo conectar con Boosfy. Revisa tu conexión e inténtalo de nuevo.", 502);
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const [code, message] = describeFailure(response.status, body?.error);
      throw new AgentSyncError(code, message, response.status === 409 ? 409 : 502);
    }
    const lastSync = { at, landingVersion: current.landingVersion, promptHash: current.hash, promptChars: current.prompt.length };
    writeState(config.dataDir, { lastSync, lastError: null });
    return { ok: true, ...lastSync };
  } catch (error) {
    if (error instanceof AgentSyncError && error.code !== "BUSY") {
      const state = readState(config.dataDir);
      writeState(config.dataDir, { lastSync: state.lastSync, lastError: { at, code: error.code, message: error.message } });
    }
    throw error;
  } finally {
    running = false;
  }
}

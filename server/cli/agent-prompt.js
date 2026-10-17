#!/usr/bin/env node
/**
 * Imprime el prompt del agente de WhatsApp con el contenido ACTUAL de la landing.
 *   node server/cli/agent-prompt.js                 # contenido publicado en DATA_DIR (o el original si no hay)
 *   node server/cli/agent-prompt.js --draft         # borrador del panel
 *   node server/cli/agent-prompt.js --out prompt.md
 */
import fs from "node:fs";
import path from "node:path";
import { buildAgentPrompt, effectiveTexts } from "../lib/agent-prompt.js";
import { loadConfig } from "../lib/config.js";
import { buildSeed } from "../lib/seed.js";

const args = process.argv.slice(2);
const config = loadConfig();
const outIndex = args.indexOf("--out");
const out = outIndex >= 0 ? args[outIndex + 1] : null;

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

let content;
if (args.includes("--draft")) {
  content = readJson(path.join(config.dataDir, "draft.json"))?.content;
} else {
  const meta = readJson(path.join(config.dataDir, "published", "meta.json"));
  content = meta ? readJson(path.join(config.dataDir, "versions", `${meta.version}.json`))?.content : null;
}
content ||= buildSeed(config.siteDir);

const prompt = buildAgentPrompt({ content, texts: effectiveTexts(config.siteDir, content) });
if (out) {
  fs.writeFileSync(out, prompt);
  console.error(`Prompt escrito en ${out} (${prompt.length} caracteres)`);
} else {
  process.stdout.write(prompt);
}

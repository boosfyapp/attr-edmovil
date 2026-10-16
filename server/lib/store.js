import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderContentJs, renderThemeCss } from "./render.js";
import { buildSeed } from "./seed.js";
import { validateContent } from "./validate.js";

export class ConflictError extends Error {
  constructor(revision) {
    super("El borrador cambió en otra pestaña o sesión");
    this.revision = revision;
  }
}

export class ValidationError extends Error {
  constructor(errors, warnings = []) {
    super("El contenido tiene errores");
    this.errors = errors;
    this.warnings = warnings;
  }
}

export class NotFoundError extends Error {}

const TOP_LEVEL = ["texts", "settings", "theme", "plans", "budgetRanges", "devices", "team", "stores", "coupons", "faqs", "coverageZones"];
const MAX_CONTENT_BYTES = 1_500_000;

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export const contentHash = (content) => crypto.createHash("sha256").update(stable(content)).digest("hex");

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

/** Deja solo las claves conocidas del documento (descarta basura enviada por el cliente). */
function pickKnown(content) {
  const out = {};
  for (const key of TOP_LEVEL) if (key in content) out[key] = content[key];
  return out;
}

export function createStore({ dataDir, siteDir }) {
  const f = {
    draft: path.join(dataDir, "draft.json"),
    versions: path.join(dataDir, "versions"),
    publishedDir: path.join(dataDir, "published"),
    meta: path.join(dataDir, "published", "meta.json"),
    contentJs: path.join(dataDir, "published", "content.js"),
    themeCss: path.join(dataDir, "published", "theme.css"),
  };
  const dirs = { siteDir, dataDir };

  const readMeta = () => readJson(f.meta);

  function loadDraft() {
    let draft = readJson(f.draft);
    if (!draft) {
      draft = { revision: 1, updatedAt: new Date().toISOString(), content: buildSeed(siteDir) };
      writeAtomic(f.draft, JSON.stringify(draft));
    }
    return draft;
  }

  function describe(draft) {
    const meta = readMeta();
    return {
      revision: draft.revision,
      updatedAt: draft.updatedAt,
      content: draft.content,
      publishedVersion: meta?.version ?? null,
      publishedAt: meta?.publishedAt ?? null,
      dirty: !meta || meta.hash !== contentHash(draft.content),
    };
  }

  function nextVersionId() {
    let max = 0;
    try {
      for (const name of fs.readdirSync(f.versions)) {
        const n = Number.parseInt(name, 10);
        if (Number.isInteger(n) && `${n}.json` === name) max = Math.max(max, n);
      }
    } catch { /* aún no hay versiones */ }
    return max + 1;
  }

  return {
    paths: f,

    getDraft() {
      return describe(loadDraft());
    },

    saveDraft(content, baseRevision) {
      if (!content || typeof content !== "object" || Array.isArray(content)) throw new ValidationError([{ path: "", message: "Contenido no válido" }]);
      const current = loadDraft();
      if (baseRevision !== current.revision) throw new ConflictError(current.revision);
      const clean = pickKnown(content);
      if (Buffer.byteLength(JSON.stringify(clean)) > MAX_CONTENT_BYTES) throw new ValidationError([{ path: "", message: "El contenido es demasiado grande" }]);
      const next = { revision: current.revision + 1, updatedAt: new Date().toISOString(), content: clean };
      writeAtomic(f.draft, JSON.stringify(next));
      return describe(next);
    },

    validate(content) {
      return validateContent(content ?? loadDraft().content, dirs);
    },

    publish(note = "") {
      const draft = loadDraft();
      const { errors, warnings } = validateContent(draft.content, dirs);
      if (errors.length) throw new ValidationError(errors, warnings);
      const id = nextVersionId();
      const publishedAt = new Date().toISOString();
      const cleanNote = String(note || "").slice(0, 200);
      writeAtomic(path.join(f.versions, `${id}.json`), JSON.stringify({ id, createdAt: publishedAt, note: cleanNote, content: draft.content }));
      writeAtomic(f.contentJs, renderContentJs(draft.content, { version: id }));
      writeAtomic(f.themeCss, renderThemeCss(draft.content.theme));
      writeAtomic(f.meta, JSON.stringify({ version: id, publishedAt, hash: contentHash(draft.content) }));
      return { version: id, publishedAt, warnings };
    },

    listVersions() {
      let names = [];
      try { names = fs.readdirSync(f.versions); } catch { /* sin versiones */ }
      return names
        .filter((n) => /^\d+\.json$/.test(n))
        .map((n) => readJson(path.join(f.versions, n)))
        .filter(Boolean)
        .map(({ id, createdAt, note }) => ({ id, createdAt, note }))
        .sort((a, b) => b.id - a.id);
    },

    getVersion(id) {
      if (!Number.isInteger(id)) throw new NotFoundError("Versión no encontrada");
      const version = readJson(path.join(f.versions, `${id}.json`));
      if (!version) throw new NotFoundError("Versión no encontrada");
      return version;
    },

    restore(id) {
      const version = this.getVersion(id);
      const current = loadDraft();
      const next = { revision: current.revision + 1, updatedAt: new Date().toISOString(), content: pickKnown(version.content) };
      writeAtomic(f.draft, JSON.stringify(next));
      return describe(next);
    },

    /** Archivos publicados o null si todavía no se ha publicado nada. */
    getPublished() {
      const meta = readMeta();
      if (!meta) return null;
      try {
        return { version: meta.version, contentJs: fs.readFileSync(f.contentJs, "utf8"), themeCss: fs.readFileSync(f.themeCss, "utf8") };
      } catch {
        return null;
      }
    },
  };
}

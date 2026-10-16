/* Estado del borrador: edición en memoria con guardado automático y control de concurrencia. */
import { api, ApiError } from "./api.js";

const SAVE_DELAY_MS = 800;

export const store = {
  content: null,
  schema: null,
  revision: 0,
  meta: { dirty: false, publishedVersion: null, publishedAt: null, updatedAt: null },
  status: "idle", // idle | pending | saving | saved | error | conflict
  errorMessage: "",
  listeners: new Set(),
  timer: null,
  saving: null,
  editVersion: 0,

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
  emit() {
    for (const fn of this.listeners) fn(this);
  },

  async load() {
    const [draft, schema] = await Promise.all([api.draft(), this.schema ? Promise.resolve(this.schema) : api.schema()]);
    this.schema = schema;
    this.applyDraft(draft);
    this.status = "idle";
    this.emit();
  },

  applyDraft(draft) {
    this.content = draft.content;
    this.revision = draft.revision;
    this.meta = { dirty: draft.dirty, publishedVersion: draft.publishedVersion, publishedAt: draft.publishedAt, updatedAt: draft.updatedAt };
  },

  /** Aplica un cambio al contenido y programa el guardado. */
  change(mutator) {
    mutator(this.content);
    this.editVersion += 1;
    this.meta.dirty = true;
    if (this.status === "conflict") return;
    this.status = "pending";
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
    this.emit();
  },

  /** Guarda ya (espera a que termine cualquier guardado en curso). */
  async flush() {
    clearTimeout(this.timer);
    if (this.saving) {
      await this.saving;
      if (this.status !== "pending") return;
    }
    if (this.status !== "pending") return;
    this.saving = this.persist().finally(() => { this.saving = null; });
    await this.saving;
  },

  async persist() {
    this.status = "saving";
    const version = this.editVersion;
    this.emit();
    try {
      const result = await api.saveDraft(this.revision, this.content);
      this.revision = result.revision;
      this.meta.updatedAt = result.updatedAt;
      this.meta.dirty = result.dirty;
      this.meta.publishedVersion = result.publishedVersion;
      // si el usuario siguió editando mientras guardaba, queda pendiente otro guardado
      this.status = this.editVersion === version ? "saved" : "pending";
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        this.status = "conflict";
      } else {
        this.status = "error";
        this.errorMessage = error.message;
      }
    }
    this.emit();
  },

  hasUnsaved() {
    return this.status === "pending" || this.status === "saving" || this.status === "error" || this.status === "conflict";
  },

  /** Descarta lo local y vuelve a leer el borrador del servidor. */
  async reload() {
    clearTimeout(this.timer);
    await this.load();
  },
};

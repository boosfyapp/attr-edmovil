import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SESSION_MS = 12 * 60 * 60 * 1000;
const MIN_PASSWORD = 10;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function sameSecret(a, b) {
  const da = crypto.createHash("sha256").update(String(a)).digest();
  const db = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(da, db);
}

/** Limita intentos fallidos por clave (IP) en una ventana deslizante. */
export function createLimiter({ max = 5, windowMs = 15 * 60 * 1000, now = Date.now } = {}) {
  const failures = new Map();
  const recent = (key) => {
    const cutoff = now() - windowMs;
    const list = (failures.get(key) || []).filter((t) => t > cutoff);
    if (list.length) failures.set(key, list);
    else failures.delete(key);
    return list;
  };
  return {
    check(key) {
      const list = recent(key);
      if (list.length < max) return { allowed: true, retryAfter: 0 };
      return { allowed: false, retryAfter: Math.ceil((list[0] + windowMs - now()) / 1000) };
    },
    fail(key) {
      const list = recent(key);
      list.push(now());
      failures.set(key, list);
    },
    reset(key) {
      failures.delete(key);
    },
  };
}

export function createAuth({ dataDir, envPassword = "", now = Date.now }) {
  const authFile = path.join(dataDir, "auth.json");
  const secretFile = path.join(dataDir, "secret");

  const readAuth = () => {
    try { return JSON.parse(fs.readFileSync(authFile, "utf8")); } catch { return null; }
  };

  let secretCache = null;
  const secret = () => {
    if (secretCache) return secretCache;
    try {
      secretCache = fs.readFileSync(secretFile, "utf8").trim();
    } catch {
      secretCache = crypto.randomBytes(32).toString("hex");
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(secretFile, secretCache, { mode: 0o600 });
    }
    return secretCache;
  };

  const sign = (payload) => crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  const epoch = () => String(readAuth()?.epoch ?? 0);

  function enabled() {
    return Boolean(readAuth()?.hash || envPassword);
  }

  function checkPassword(password) {
    if (typeof password !== "string" || !password) return false;
    const stored = readAuth();
    if (stored?.hash) return verifyPassword(password, stored.hash);
    return Boolean(envPassword) && sameSecret(password, envPassword);
  }

  return {
    enabled,
    checkPassword,

    issueToken() {
      const payload = `${now() + SESSION_MS}.${epoch()}.${crypto.randomBytes(8).toString("hex")}`;
      return `${payload}.${sign(payload)}`;
    },

    verifyToken(token) {
      if (typeof token !== "string") return false;
      const parts = token.split(".");
      if (parts.length !== 4) return false;
      const payload = parts.slice(0, 3).join(".");
      const expected = Buffer.from(sign(payload));
      const given = Buffer.from(parts[3]);
      if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
      if (Number(parts[0]) < now()) return false;
      return parts[1] === epoch();
    },

    /** Cambia la contraseña (invalida las demás sesiones). Lanza Error con mensaje en español si no es válida. */
    changePassword(current, next) {
      if (!checkPassword(current)) throw new Error("La contraseña actual no es correcta");
      if (typeof next !== "string" || next.length < MIN_PASSWORD) throw new Error(`La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres`);
      if (next.length > 200) throw new Error("La nueva contraseña es demasiado larga");
      const previous = readAuth();
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(authFile, JSON.stringify({ hash: hashPassword(next), epoch: (previous?.epoch ?? 0) + 1 }), { mode: 0o600 });
    },
  };
}

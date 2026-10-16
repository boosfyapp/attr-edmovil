/* Cliente de la API del panel. */

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || `Error ${status}`);
    this.status = status;
    this.data = data || {};
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

async function request(method, url, { body, raw, contentType } = {}) {
  const headers = { "X-Requested-With": "att-admin" };
  let payload;
  if (raw) {
    payload = raw;
    if (contentType) headers["Content-Type"] = contentType;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, { error: "Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo." });
  }
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo JSON */ }
  if (!res.ok) {
    if (res.status === 401 && !url.endsWith("/api/login") && !url.endsWith("/api/password")) onUnauthorized();
    throw new ApiError(res.status, data);
  }
  return data;
}

export const api = {
  session: () => request("GET", "/api/session"),
  login: (password) => request("POST", "/api/login", { body: { password } }),
  logout: () => request("POST", "/api/logout", { body: {} }),
  schema: () => request("GET", "/api/schema"),
  draft: () => request("GET", "/api/draft"),
  saveDraft: (baseRevision, content) => request("PUT", "/api/draft", { body: { baseRevision, content } }),
  validate: () => request("POST", "/api/validate", { body: {} }),
  publish: (note) => request("POST", "/api/publish", { body: { note } }),
  versions: () => request("GET", "/api/versions"),
  version: (id) => request("GET", `/api/versions/${id}`),
  restore: (id) => request("POST", `/api/versions/${id}/restore`, { body: {} }),
  upload: (blob) => request("POST", "/api/uploads", { raw: blob, contentType: blob.type || "application/octet-stream" }),
  changePassword: (current, next) => request("POST", "/api/password", { body: { current, next } }),
};

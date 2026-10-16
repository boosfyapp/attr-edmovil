# Panel administrativo AT&T — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax. Spec: `docs/superpowers/specs/2026-10-16-admin-panel-design.md`.

**Goal:** Panel `/admin` con login, borrador/vista previa/publicar/historial para editar textos, precios, fotos, colores y cupones de la landing, desplegado en producción.

**Architecture:** Un solo proceso Node 24 sin dependencias npm que sirve la landing, `/published/*`, `/uploads/*`, el panel y la API JSON. El contenido vive en un volumen (`/data`) como JSON (borrador + versiones); publicar genera `content.js` y `theme.css` estáticos que la landing carga con respaldo al contenido del repo.

**Tech Stack:** Node 24 (`http`, `fs`, `crypto`, `node:test`), HTML/CSS/ES modules vanilla (panel y landing), Docker `node:24-alpine`, Docker Swarm, GitHub Actions existente.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `package.json` | scripts `start`, `test`; sin dependencias |
| `server/index.js` | arranque: lee config, crea servidor, escucha |
| `server/app.js` | `createApp(config)` → `http.Server`; enrutado |
| `server/lib/config.js` | `loadConfig(env)` → `{port, siteDir, adminDir, dataDir, adminPassword}` |
| `server/lib/http.js` | `sendJson`, `sendText`, `readBody(req,max)`, `parseCookies`, `MIME` |
| `server/lib/static.js` | `serveStatic(res, baseDir, relPath, opts)` con anti-traversal |
| `server/lib/template.js` | `extractTexts(html)` y `renderIndex(html,{version,mode})` |
| `server/lib/text-labels.js` | `TEXT_LABELS`: clave → `{label, section, multiline?, max?}` |
| `server/lib/seed.js` | `buildSeed(siteDir)` → documento de contenido inicial |
| `server/lib/validate.js` | `validateContent(doc)` → `{errors, warnings}` |
| `server/lib/store.js` | `createStore(dataDir, seedFn)`: draft, publish, versions, restore |
| `server/lib/render.js` | `renderContentJs(doc,defaults)`, `renderThemeCss(theme)` |
| `server/lib/auth.js` | scrypt, sesión HMAC, limitador de intentos |
| `server/lib/uploads.js` | `saveImage(dataDir, buffer)` → `{path}` |
| `admin/index.html`, `admin/app.js`, `admin/api.js`, `admin/ui.js`, `admin/views/*.js`, `admin/admin.css` | SPA del panel |
| `test/*.test.js` | pruebas `node:test` |
| `index.html`, `script.js`, `data.js`, `styles.css` | landing: `data-cms`, `SITE_CONTENT`, cupones/zonas por datos |
| `Dockerfile`, `.dockerignore` | imagen única |

## Contrato de la API (todo bajo sesión salvo `login`, `session`, `healthz`)

```
POST /api/login        {password}                 → 200 {ok:true} + cookie | 401 | 429 | 503 (sin contraseña configurada)
POST /api/logout                                   → 200
GET  /api/session                                  → {authenticated:boolean}
GET  /api/schema                                   → {texts:[{key,label,section,multiline,max,default,attr}], defaults:{...doc de seed}}
GET  /api/draft                                    → {revision, content, publishedVersion, dirty}
PUT  /api/draft        {baseRevision, content}     → 200 {revision} | 409 {revision} | 400 {errors}
POST /api/validate     {content?}                  → {errors, warnings}   (borrador si no se manda)
POST /api/publish      {note?}                     → 200 {version} | 422 {errors}
GET  /api/versions                                 → [{id, createdAt, note}]
POST /api/versions/:id/restore                     → 200 {revision}
POST /api/uploads      (cuerpo binario image/*)    → 200 {path:"uploads/<sha>.webp"} | 400 | 413
POST /api/password     {current, next}             → 200 | 401 | 400
GET  /api/draft/content.js · /api/draft/theme.css  → vista previa
GET  /admin/preview                                → landing con el borrador
GET  /healthz                                      → 200 "ok"
Escrituras exigen header X-Requested-With: att-admin
```

## Reglas del documento de contenido

- `texts` guarda **solo overrides** (clave distinta al default del HTML). Restaurar original = borrar la clave.
- Colecciones (`plans`, `devices`, `team`, `stores`, `coupons`, `faqs`, `coverageZones`, `budgetRanges`) y `settings`/`theme` van completas desde la semilla.
- Equipo comercial sin teléfonos individuales (igual que la landing actual).

---

### Task 1: Esqueleto del servidor, archivos estáticos y /healthz

**Files:** Create `package.json`, `server/index.js`, `server/app.js`, `server/lib/config.js`, `server/lib/http.js`, `server/lib/static.js`, `test/static.test.js`, `test/helpers.js`.

- [ ] **1.1 Prueba que falla** (`test/static.test.js`): con `createApp` sobre un `siteDir` temporal con `index.html`, `styles.css`, `assets/a.png`:
  - `GET /healthz` → 200 `ok`
  - `GET /styles.css` → 200 `text/css`
  - `GET /assets/a.png` → 200 `image/png`
  - `GET /../package.json`, `GET /%2e%2e/package.json`, `GET /server/app.js`, `GET /data.js.bak` → 404
  - `GET /` → 200 HTML con `Cache-Control: no-cache`
- [ ] **1.2 Ejecutar**: `npm test` → FAIL (módulos no existen).
- [ ] **1.3 Implementar** `config.js` (`PORT` def. 80, `SITE_DIR`, `ADMIN_DIR`, `DATA_DIR` def. `/data`, `ADMIN_PASSWORD`), `http.js`, `static.js` (allowlist: `index.html`, `styles.css`, `script.js`, `data.js`, `catalog-data.js`, `favicon.png`, `logo-*.png`, y prefijo `assets/`; resolución con `path.resolve` y verificación de prefijo; cabeceras de seguridad; `ETag` no necesario), `app.js` con `/healthz` y estáticos.
- [ ] **1.4 Ejecutar** `npm test` → PASS. **Commit** `feat(server): static server with allowlist and healthz`.

### Task 2: Marcado `data-cms` en la landing y extracción de textos

**Files:** Modify `index.html`; Create `server/lib/template.js`, `server/lib/text-labels.js`, `test/template.test.js`.

- [ ] **2.1 Prueba que falla**: `extractTexts(html)` devuelve `[{key, attr, value, multiline}]` en orden; decodifica `&amp; &lt; &gt; &quot; &#39;`; convierte `<b>/<strong>` a `**…**`; `data-cms-attr="data-wa-text"` lee ese atributo; error si un elemento `data-cms` tiene otro hijo elemento (p. ej. `<svg>`); claves repetidas con valores distintos lanzan error.
- [ ] **2.2 Implementar** `extractTexts` (regex sobre etiquetas de apertura con `data-cms`, cierre buscado por nombre de etiqueta; para `attr` solo se lee el atributo) y `renderIndex(html, {version, draft})` que reescribe `published/content.js?v=…`/`published/theme.css?v=…` (o `/api/draft/...` con barra de vista previa).
- [ ] **2.3 Marcar `index.html`**: añadir `data-cms="sección.nombre"` a todos los textos visibles (hero, opciones, clasificación, planes, domicilio, cobertura, call center, ubicaciones, cupones, tienda, portabilidad, catálogo, cotizador (solo cabecera de sección), FAQ (solo cabecera), CTA final, footer), a `<title>`, `meta description`, `og:*` (`content`) y a los `data-wa-text` de los CTA (clave `wa.<modalidad>`; un mismo mensaje usa la misma clave). Textos con negrita parcial se escriben como `**…**` en el valor. Los hijos `<svg>` se sacan a hermanos o se envuelve el texto en `<span data-cms>`.
- [ ] **2.4 Etiquetas**: `text-labels.js` exporta `TEXT_LABELS` con `{label, section}` para **cada** clave; prueba: conjunto de claves del HTML == conjunto de `TEXT_LABELS` (sin faltantes ni sobrantes).
- [ ] **2.5** `npm test` → PASS. **Commit** `feat(landing): data-cms text slots and extractor`.

### Task 3: Semilla de contenido

**Files:** Modify `data.js` (añadir `COUPONS`, `COVERAGE_ZONES`, `SETTINGS_DEFAULT`, `THEME_DEFAULT`), `index.html` (contenedores vacíos `#couponGrid`, `#coverageList`); Create `server/lib/seed.js`, `test/seed.test.js`.

- [ ] **3.1 Prueba que falla**: `buildSeed(siteDir)` devuelve documento con 18 planes (8/6/4), 34 `devices`, 6 `team`, 9 `stores`, 2 `coupons` ($200 y $150, activos, sin fechas), 11 `faqs`, 17 `coverageZones`, 3 `budgetRanges`, `settings.whatsapp === "522223303739"`, `settings.ga4 === "G-BTCKL6ENXP"`, `theme.azul === "#009fdb"`, `texts === {}`.
- [ ] **3.2 Implementar** evaluando `data.js` y `catalog-data.js` con `vm.runInNewContext(src + "\n({...})")` (sin dependencias) y mapeando `DEVICE_CATALOG` descartando `quoteOnly`/sin precio, `expires` (no se usa). Añadir en `data.js` los cupones y zonas que hoy están en el HTML.
- [ ] **3.3** `npm test` → PASS. **Commit** `feat(server): content seed from repo data`.

### Task 4: Validación del contenido

**Files:** Create `server/lib/validate.js`, `test/validate.test.js`.

- [ ] **4.1 Pruebas que fallan** (una por regla): semilla válida → `errors: []`; precio `0`/`-1`/`"abc"`/vacío en plan o equipo → error con `path` (`plans.premium[2].price`); WhatsApp ≠ `^52\d{10}$`; color no `^#[0-9a-f]{6}$`; texto vacío (`texts.x === ""`); texto > 600 caracteres (FAQ `a` > 1500); cupón activo sin título o monto ≤ 0; `from > to`; imagen con ruta fuera de `^(assets|uploads)/[A-Za-z0-9_./-]+$`; imagen `uploads/…` inexistente en `dataDir`; `terms.total` ≠ `pay*price` produce **warning** (no error); contraste bajo en tema produce warning.
- [ ] **4.2 Implementar** `validateContent(doc, {dataDir, siteDir})` → `{errors:[{path,message}], warnings:[...]}`.
- [ ] **4.3** PASS. **Commit** `feat(server): content validation`.

### Task 5: Store (borrador, publicar, versiones) y render

**Files:** Create `server/lib/store.js`, `server/lib/render.js`, `test/store.test.js`, `test/render.test.js`.

- [ ] **5.1 Pruebas que fallan**:
  - Primer `getDraft()` crea `draft.json` desde la semilla con `revision: 1`, `publishedVersion: null`, `dirty: true`.
  - `saveDraft(doc, baseRevision)` incrementa; con `baseRevision` viejo lanza `ConflictError` con la revisión actual.
  - `publish(note)` con borrador válido: crea `versions/1.json`, `published/content.js`, `published/theme.css`, `published/meta.json`; `dirty:false`; segundo publish sin cambios crea versión 2 igualmente.
  - `publish` con errores no escribe nada y lanza `ValidationError` con `errors`.
  - `restore(1)` reemplaza borrador con la versión 1 (revision +1) y no toca lo publicado.
  - Escritura atómica: no queda `.tmp`.
  - `renderContentJs(doc, defaults)`: empieza con `window.SITE_CONTENT=`, es JS válido (`vm`), incluye solo overrides en `texts`, escapa `</script>` y U+2028/2029; `renderThemeCss`: `:root{--att-blue:…;--att-blue-dark:…;--att-blue-light:…;--morado:…;--rosa:…;--naranja:…;--wa-green:…;--wa-green-dark:…;--shadow-blue:…}` con derivados calculados (oscurecer 20 %, aclarar 40 %).
- [ ] **5.2 Implementar** `store.js` (`getDraft`, `saveDraft`, `publish`, `listVersions`, `restore`, `getPublished()` → `{version, contentJs, themeCss}`; `contentHash` para `dirty`) y `render.js`.
- [ ] **5.3** PASS. **Commit** `feat(server): draft/publish store and renderers`.

### Task 6: Autenticación

**Files:** Create `server/lib/auth.js`, `test/auth.test.js`.

- [ ] **6.1 Pruebas que fallan**: `hashPassword`/`verifyPassword` (scrypt, salt, comparación `timingSafeEqual`); `signSession`/`verifySession` (HMAC-SHA256, expira a 12 h, manipulación rechazada); limitador: 5 fallos / 15 min por IP bloquea el sexto aunque la contraseña sea correcta y se libera al pasar la ventana (reloj inyectable); `getPasswordSource`: `auth.json` prevalece sobre `ADMIN_PASSWORD`; sin ninguno → `null`.
- [ ] **6.2 Implementar** y **PASS**. **Commit** `feat(server): auth primitives`.

### Task 7: Rutas de la API, subida de imágenes y vista previa

**Files:** Modify `server/app.js`; Create `server/lib/uploads.js`, `test/api.test.js`, `test/uploads.test.js`.

- [ ] **7.1 Pruebas que fallan** (servidor real en puerto efímero con `dataDir` temporal): login correcto/incorrecto/limitado/503; rutas protegidas → 401 sin cookie; POST sin `X-Requested-With` → 403; flujo `GET /api/draft` → `PUT` → `POST /api/publish` → `GET /published/content.js` con el cambio; 409 por revisión vieja; 422 con errores; `restore`; `/api/draft/content.js` solo con sesión; `/admin/preview` contiene `/api/draft/content.js` y la barra; `/` publicado usa `?v=<versión>`; subida: acepta WebP/PNG/JPEG por magic bytes, rechaza texto/SVG/HTML renombrado, >5 MB → 413, mismo contenido → mismo nombre; `/uploads/<archivo>` sirve con `immutable`; `POST /api/password` cambia y exige actual.
- [ ] **7.2 Implementar** enrutado completo y `uploads.js`. Cookie `att_session` `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200` (sin `Secure` solo si `config.insecureCookies`, para pruebas locales). IP de cliente desde `CF-Connecting-IP`/`X-Forwarded-For`.
- [ ] **7.3** PASS. **Commit** `feat(server): admin API, uploads and preview routes`.

### Task 8: Landing consume el contenido publicado

**Files:** Modify `script.js`, `index.html`, `styles.css` (si hay colores literales de marca, pasarlos a `var(--…)`).

- [ ] **8.1** `index.html`: `<link rel="stylesheet" href="published/theme.css?v=0">` tras `styles.css`; `<script src="published/content.js?v=0"></script>` antes de `data.js`; GA4 dinámico (`settings.ga4` o `G-BTCKL6ENXP`) y Meta Pixel solo si hay ID; subir `?v=` de `styles.css`/`script.js`/`data.js`/`catalog-data.js` a 7.
- [ ] **8.2** `script.js`: `const SC = window.SITE_CONTENT || {}`; fuentes `PLANS_*`, `TEAM`, `STORES`, `DEVICE_CATALOG` (sin `hidden`), `FAQS`, `BUDGET_RANGES`, `COUPONS`, `COVERAGE_ZONES`, WhatsApp, tomadas de `SC` con respaldo a las constantes; `applyTexts(SC.texts)` con `setRichText` (nodos DOM, `**negrita**`) y atributos; `renderCoupons()` con vigencia en `America/Mexico_City` (sección `#cupones` oculta si no hay vigentes); `renderCoverage()`; **escapar con `escapeHtml` todo valor interpolado** (planes, equipos, tiendas, FAQ, cupones). Mensaje de cupón usa `amount`/`product` de datos.
- [ ] **8.3 Verificar en navegador** (servidor local con `dataDir` temporal sin publicar): la landing se ve y funciona igual que producción (capturas hero, planes, catálogo, cupones, ubicaciones, FAQ; consola sin errores); luego con un `content.js` de prueba (texto, precio, color, cupón vencido) se refleja. **Commit** `feat(landing): consume published content with safe fallbacks`.

### Task 9: Panel — base, login, inicio, textos

**Files:** Create `admin/index.html`, `admin/admin.css`, `admin/api.js`, `admin/ui.js`, `admin/app.js`, `admin/views/home.js`, `admin/views/texts.js`.

- [ ] **9.1** `api.js`: `fetch` con `credentials`, header `X-Requested-With`, manejo 401 → pantalla de login, 409 → aviso de conflicto. `ui.js`: helpers `h(tag,props,...kids)` (sin `innerHTML`), toasts, diálogo de confirmación, campo con etiqueta, guardado automático con *debounce* (800 ms) y estado "Guardado ✓ / Guardando… / Error".
- [ ] **9.2** `app.js`: enrutado por hash (`#/inicio`, `#/textos`, …), barra lateral (barra inferior en móvil), cabecera con **Vista previa** y **Publicar**.
- [ ] **9.3** Inicio (estado, última publicación, cambios sin publicar), Textos (secciones colapsables, contador de caracteres, "restaurar original").
- [ ] **9.4 Verificar en navegador**: login, editar un texto, ver Guardado, recargar y persistir. **Commit** `feat(admin): shell, login, home, texts`.

### Task 10: Panel — resto de pantallas

**Files:** Create `admin/views/plans.js`, `devices.js`, `coupons.js`, `people-stores.js`, `faq-zones.js`, `appearance.js`, `settings.js`, `history.js`, `preview.js`, `admin/lib/image-upload.js` (reduce a 1600 px y convierte a WebP con canvas, sube y devuelve la ruta), `admin/lib/contrast.js`.

- [ ] **10.1** Editor genérico de listas (`listEditor({schema,items,onChange})`: añadir, duplicar, eliminar con confirmación, reordenar ↑↓, campos tipados `text|number|money|url|image|toggle|date|textarea`) usado por Planes (tres pestañas), Equipos (con filtro por marca y "ocultar"), Cupones, Equipo, Tiendas, FAQ, Zonas, Rangos del cotizador.
- [ ] **10.2** Apariencia (5 selectores de color, vista previa de botones, contraste con aviso, "Restaurar colores de marca"), Ajustes (WhatsApp, GA4, Pixel, cambiar contraseña), Historial (Ver/Restaurar), Vista previa (`iframe` a `/admin/preview` con alternancia móvil/escritorio).
- [ ] **10.3** Publicar: valida en servidor, muestra errores enlazados a la pantalla y campo; pide nota opcional; confirma y muestra "Publicado — versión N".
- [ ] **10.4 Verificar en navegador** de punta a punta (cambiar un precio, subir una foto, crear un cupón con vigencia, cambiar un color, publicar, ver la landing, restaurar). **Commit** `feat(admin): plans, devices, coupons, people, FAQ, appearance, settings, history, preview`.

### Task 11: Imagen Docker

**Files:** Modify `Dockerfile`, `.dockerignore`.

- [ ] **11.1** `Dockerfile`: `FROM node:24-alpine`; `WORKDIR /app`; copiar `package.json`, `server/`, `admin/` y los archivos de la landing a `/app/site` (mismos que hoy, más `data.js`, `catalog-data.js`, `assets/`); `ENV PORT=80 SITE_DIR=/app/site ADMIN_DIR=/app/admin DATA_DIR=/data NODE_ENV=production`; `RUN mkdir -p /data && chown -R node:node /data /app`; `USER node`; `VOLUME /data`; `HEALTHCHECK … wget -qO- http://127.0.0.1/healthz`; `CMD ["node","server/index.js"]`. `.dockerignore`: `.git .github deploy docs test node_modules`.
- [ ] **11.2** Construir y probar local: `docker build -t att-admin-test .`; correr **sin volumen ni contraseña** (como el smoke test del servidor): `/`, `/styles.css`, `/script.js` → 200; correr con volumen y `ADMIN_PASSWORD` y repetir el ciclo login → editar → publicar → restaurar con `curl`. Confirmar que `node` (no root) puede escuchar en 80; si no, quitar `USER node`.
- [ ] **11.3 Commit** `build: single node image serving landing, admin and API`.

### Task 12: Producción

- [ ] **12.1** README de despliegue actualizado (`deploy/README.md`): nueva arquitectura, volumen, variables, recuperación. Commit.
- [ ] **12.2** En el VPS (SSH): comprobar servicio y mounts actuales; `docker service update --mount-add type=volume,source=att-redmovil-data,target=/data --env-add ADMIN_PASSWORD=<temporal> att-redmovil_app` (antes de desplegar la imagen nueva el servicio actual (nginx) simplemente ignora el volumen y la variable).
- [ ] **12.3** Merge de `feat/admin-panel` a `main` y push → GitHub Actions → verificar el run, la imagen activa, servicio 1/1, `https://att.fracesolutions.com/` y `/admin/` 200.
- [ ] **12.4** Verificación real: login con la contraseña temporal, comprobar que la landing publicada es idéntica (nada publicado aún), hacer un cambio de prueba **y revertirlo** (publicar → restaurar → publicar), confirmar `?v=` y que Cloudflare entrega el contenido nuevo.
- [ ] **12.5** Entrega: guardar la contraseña temporal en un archivo local fuera del repo; actualizar Master Mind (nota del cliente + procedimiento) y la memoria del proyecto.

## Autoevaluación contra el spec

Cubre: arquitectura y volumen (T1, T5, T11, T12), modelo y semilla (T3), textos `data-cms` (T2), integración landing incl. GA4/Pixel/cupones por vigencia/escape (T8), panel y pantallas (T9–T10), vista previa (T7, T10), validaciones (T4), seguridad (T1, T6, T7), despliegue y rollback (T11–T12), pruebas (cada tarea).

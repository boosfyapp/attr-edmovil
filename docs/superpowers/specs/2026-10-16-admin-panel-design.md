# Panel administrativo de la landing AT&T Barrio Cascatta — Diseño

Fecha: 2026-10-16 · Estado: aprobado por Paco en conversación (arquitectura, pantallas, flujo, entrega).

## Objetivo

El cliente (Isaac / Sergio) debe poder cambiar por sí mismo, sin código ni redeploy: **textos, precios, fotos, colores y cupones** de `att.fracesolutions.com`, con borrador, vista previa, publicación e historial restaurable.

Decisiones confirmadas por el usuario:

- Cupones = administrar los actuales (título, monto, condiciones, imagen, vigencia, activo). Se siguen pidiendo por WhatsApp; **no** hay códigos canjeables.
- Un solo acceso compartido (una contraseña).
- Flujo borrador → vista previa → Publicar, con historial y restauración.
- Arquitectura "A": servidor Node propio en el mismo contenedor, contenido publicado como archivos estáticos.

## Arquitectura

```
/                      landing (index.html + estáticos del repo)
/published/content.js  contenido publicado (window.SITE_CONTENT = {...})
/published/theme.css   variables de color publicadas
/uploads/<hash>.webp   fotos subidas desde el panel (inmutables)
/admin/                panel (SPA vanilla, ES modules, sin build)
/api/*                 API del panel (cookie de sesión)
/healthz               healthcheck
```

Un único proceso Node 24 **sin dependencias npm** (http, fs, crypto, node:test). Sirve la landing, los estáticos, los archivos publicados y el panel. Reemplaza a nginx dentro del mismo servicio Swarm (`att-redmovil_app`, puerto 80), de modo que el pipeline de GitHub Actions existente sigue funcionando.

Persistencia: volumen Docker montado en `/data`:

```
/data/draft.json            borrador actual
/data/versions/<n>.json     una versión por publicación (+ note, fecha)
/data/published/            content.js, theme.css, meta.json (id de versión publicada)
/data/uploads/              imágenes subidas
/data/auth.json             hash de contraseña (si se cambió desde el panel)
/data/secret                secreto de sesión (generado al primer arranque)
```

El contenido vive en el volumen, **no** en el repo: un redeploy desde GitHub no lo pisa. Si `/data/published/` está vacío, `content.js` responde `window.SITE_CONTENT=null` y la landing se ve exactamente como el repo (respaldo).

## Modelo de contenido (documento)

```
{
  texts:    { "<clave>": "texto" },          // claves data-cms de index.html
  settings: { whatsapp, ga4, metaPixel },
  theme:    { azul, morado, rosa, naranja, whatsapp },   // #rrggbb
  plans:    { premium:[{name,price,gb,note,hasAsterisk}],
              lite:[{name,price,gb,socials,portability}],
              simple:[{name,price,gbBase,gbDouble,terms:[{months,pay,free,total}]}] },
  budgetRanges: [{id,label,tag,min,max}],
  devices:  [{brand,model,plan,monthly,term,image,hidden}],
  team:     [{role,name,image,principal}],
  stores:   [{name,address,hours,map,principal}],
  coupons:  [{id,title,description,amount,product,image,active,from,to}],
  faqs:     [{q,a}],
  coverageZones: ["Puebla capital", ...]
}
```

**Semilla**: el primer borrador se construye a partir de lo que hoy está en el repo — `data.js`, `catalog-data.js`, los `data-cms` de `index.html` y los dos cupones actuales. Por eso el estado inicial publicado equivale a producción hoy.

### Textos

Los elementos de texto de `index.html` llevan `data-cms="<clave>"` (y `data-cms-attr="<atributo>"` cuando se edita un atributo, p. ej. `data-wa-text`, `content`). El valor por defecto de cada clave es el que está escrito en el HTML (única fuente de verdad). Un archivo `server/lib/text-labels.js` da etiqueta y sección a cada clave para el panel; una prueba exige que toda clave del HTML tenga etiqueta y viceversa, y que claves repetidas tengan el mismo valor por defecto.

Marcado mínimo en los textos: `**negrita**`. Nunca HTML: el loader construye nodos DOM (`textContent`), por lo que el contenido del panel no puede inyectar scripts.

## Integración con la landing

- `index.html` conserva sus textos como respaldo, y agrega `<link rel="stylesheet" href="published/theme.css?v=0">` y `<script src="published/content.js?v=0"></script>` antes de `data.js`.
- El servidor sirve `/` reescribiendo `?v=` con el id de la versión publicada (evita el caché de Cloudflare sobre CSS/JS; el HTML se sirve `no-cache`).
- `script.js` lee `window.SITE_CONTENT` si existe y sustituye cada fuente (`PLANS_*`, `TEAM`, `STORES`, `DEVICE_CATALOG`, `FAQS`, `BUDGET_RANGES`, `WHATSAPP_PRINCIPAL`) por la publicada; aplica textos `data-cms`; renderiza cupones desde datos (vigencia evaluada en el navegador, zona horaria America/Mexico_City, por lo que un cupón vencido desaparece solo) y zonas de cobertura desde datos; **escapa todo valor** que interpola en HTML.
- GA4 se carga dinámicamente con `settings.ga4` (hoy está fijo en el HTML); el Pixel de Meta, si hay ID, se inicializa igual.
- Qué NO es editable: estructura y orden de secciones, textos internos del cotizador (pasos/opciones), iconos. Eso sigue siendo cambio de código.

## Panel (`/admin`)

Pantallas: Inicio · Textos · Planes · Equipos · Cupones · Equipo y tiendas · Apariencia · Ajustes · Historial. Español, responsive.

- Edición siempre sobre el borrador; guardado automático con `revision` (control de concurrencia optimista: si otra pestaña guardó antes, se avisa y no se pisa).
- **Vista previa**: `/preview/` sirve la landing real con `draft` (`/api/draft/content.js`, `/api/draft/theme.css`) bajo sesión, con barra "VISTA PREVIA — no publicado" y alternancia móvil/escritorio (iframe).
- **Publicar**: valida el borrador; si pasa, escribe `content.js` y `theme.css` de forma atómica (tmp + rename), guarda `versions/<n>.json` y actualiza `meta.json`. **Restaurar** una versión la carga como borrador (no publica).
- Validaciones que bloquean publicar: precios/mensualidades vacíos, ≤ 0 o no numéricos; WhatsApp ≠ `52` + 10 dígitos; colores que no sean `#rrggbb`; imágenes inexistentes; cupón activo sin título/monto, o con `from` > `to`; texto vacío; longitudes máximas. Apariencia muestra contraste y advierte (no bloquea) por debajo de 4.5:1.
- Imágenes: el navegador las reduce (máx. 1600 px) y las convierte a WebP con canvas antes de subirlas; el servidor valida magic bytes (WebP/JPEG/PNG), límite 5 MB y las guarda con nombre = hash SHA-256 (inmutables, `Cache-Control: immutable`).

## Seguridad

- Contraseña inicial por variable de entorno del servicio (`ADMIN_PASSWORD`); si se cambia desde el panel, queda como hash scrypt en `/data/auth.json` y prevalece. Sin `ADMIN_PASSWORD` ni `auth.json` el panel responde 503 y la landing sigue normal.
- Sesión: cookie `HttpOnly; Secure; SameSite=Strict`, firmada con HMAC (secreto en `/data/secret`), 12 h. Login con límite de 5 intentos / 15 min por IP.
- API: solo JSON con cabecera `X-Requested-With: att-admin` en métodos que escriben (anti-CSRF junto con SameSite).
- Rutas de archivos: allowlist estricta; sin path traversal (resolución + comprobación de prefijo). Cabeceras de seguridad (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, CSP en `/admin`).
- El repo es público: no contiene contraseñas, hashes ni secretos.

## Despliegue

- Dockerfile: `node:24-alpine`, copia del servidor, panel y archivos de la landing; `HEALTHCHECK` en `/healthz`; usuario no-root si el puerto 80 lo permite.
- El script de deploy del servidor (`server-deploy.sh`) no cambia: construye, hace smoke test (`/`, `/styles.css`, `/script.js` — la imagen debe arrancar sin volumen ni contraseña), actualiza el servicio y revierte si falla.
- Una sola vez en el VPS: `docker service update --mount-add type=volume,source=att-redmovil-data,target=/data --env-add ADMIN_PASSWORD=… att-redmovil_app`. Mount y env persisten en cada `service update --image` posterior.
- Respaldo previo: la imagen activa (`att-redmovil:git-5bbf7776181c`) queda disponible para rollback manual (`docker service update --rollback`).

## Pruebas

- `node:test` sin dependencias: validación, semilla, extracción de `data-cms`, ciclo borrador → publicar → restaurar, concurrencia (`revision`), auth (login, límite, sesión, CSRF), subida de imágenes (tipo, tamaño, hash), render de `content.js`/`theme.css`, servidor de archivos (traversal bloqueado).
- Navegador: la landing sin publicar se ve igual que producción; con un cambio publicado (texto, precio, color, cupón) se refleja; vista previa muestra el borrador y la landing real no cambia hasta publicar.
- Producción: HTTP 200 de `/`, `/admin/`, `/healthz`; ciclo completo publicar → restaurar sobre el servicio real.

## Notas de implementación (post-entrega)

- La vista previa vive en `/preview/` (no en `/admin/preview`): así las URLs relativas y las anclas de la landing funcionan igual que en producción. Usa `draft-content.js` / `draft-theme.css` y desactiva GA4 (`window.__ATT_PREVIEW`).
- Sin nada publicado, «cambios sin publicar» significa «distinto del contenido original del repo».
- Cloudflare cachea `.js`/`.css` aunque el origen diga `no-cache`: el panel se sirve `no-store` y el contenido publicado va versionado (`?v=<versión>`); la landing tolera HTML antiguo en caché del navegador.
- Contraseña inicial: variable `ADMIN_PASSWORD` del servicio; se cambia desde Ajustes.

## Riesgos

- EasyPanel recreando el servicio desde su UI descartaría el volumen/env: el servicio se creó a mano (Swarm + Traefik yaml), no lo gestiona EasyPanel.
- El puerto 80 como usuario no-root depende de `ip_unprivileged_port_start`; si falla en el smoke test, se corre como root dentro del contenedor.
- Un solo nodo y un solo contenedor escribiendo en el volumen: sin necesidad de bloqueo distribuido (escrituras atómicas locales).

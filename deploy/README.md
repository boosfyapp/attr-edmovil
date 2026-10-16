# Despliegue automático

Cada `push` a `main` en `boosfyapp/attr-edmovil` ejecuta `.github/workflows/deploy.yml`. El workflow se conecta al VPS con una llave SSH dedicada cuya entrada en `authorized_keys` obliga a ejecutar `/usr/local/sbin/att-redmovil-deploy`. La llave sólo acepta `deploy <SHA>`; el script obtiene ese commit del repositorio público, construye y prueba la imagen, actualiza `att-redmovil_app`, comprueba la URL pública y sincroniza el código fuente de EasyPanel.

El script instalado en el servidor es una copia de `deploy/server-deploy.sh`, propiedad de root. Cambiarlo en GitHub **no** cambia automáticamente la copia instalada; un administrador debe revisar e instalar las modificaciones. Las credenciales `ATT_REDMOVIL_DEPLOY_KEY` y `ATT_REDMOVIL_KNOWN_HOSTS` viven en GitHub Actions Secrets, no en este repositorio.

## Qué corre en el servicio

Una sola imagen (`node:24-alpine`, sin dependencias npm) sirve:

| Ruta | Qué es |
|---|---|
| `/` | landing pública (HTML del repo con la versión publicada fijada en las URLs) |
| `/published/content.js`, `/published/theme.css` | contenido y colores publicados desde el panel |
| `/uploads/*` | fotos subidas desde el panel |
| `/admin/` | panel administrativo |
| `/api/*` | API del panel (sesión por cookie) |
| `/preview/` | vista previa del borrador (requiere sesión) |
| `/healthz` | comprobación de salud |

El **contenido editable no vive en el repo**: está en el volumen `att-redmovil-data` montado en `/data` (`draft.json`, `versions/`, `published/`, `uploads/`, `auth.json`, `secret`). Un redeploy desde GitHub nunca lo pisa. Si `/data/published/` está vacío, la landing se ve exactamente como el HTML/JS del repo (`data.js`, `catalog-data.js`).

> Tras la primera publicación desde el panel, los datos viven en el panel: cambiar `data.js` en el repo ya no modifica lo que ve el público (sí sirve de semilla y de respaldo). Los textos nuevos con `data-cms` en `index.html` sí aparecen sin tocar el panel, mientras nadie los haya editado allí.

## Configuración del servicio (una sola vez)

```bash
docker service update \
  --mount-add type=volume,source=att-redmovil-data,target=/data \
  --env-add ADMIN_PASSWORD='<contraseña inicial>' \
  att-redmovil_app
```

`mount` y `env` se conservan en cada `docker service update --image …` posterior (lo que hace el script de deploy). Sin `ADMIN_PASSWORD` y sin `/data/auth.json`, el panel responde 503 «sin configurar» y la landing funciona normal. Desde el panel (Ajustes) se puede cambiar la contraseña; queda como hash en `/data/auth.json` y prevalece sobre la variable.

Variables admitidas: `PORT` (80), `SITE_DIR`, `ADMIN_DIR`, `DATA_DIR` (`/data`), `ADMIN_PASSWORD`, `INSECURE_COOKIES=1` (solo pruebas locales sin HTTPS).

## Operación

- Consultar resultados: [GitHub Actions](https://github.com/boosfyapp/attr-edmovil/actions/workflows/deploy.yml).
- Ejecutar otra vez un despliegue: usar **Run workflow** sobre `main`.
- Revertir la imagen activa desde el VPS: `docker service update --rollback --detach=false att-redmovil_app`. Después, revertir el commit de `main` si se quiere evitar que el siguiente despliegue reactive esa versión.
- Comprobar la imagen activa: `docker service inspect att-redmovil_app --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'`.
- Respaldar el contenido: `docker run --rm -v att-redmovil-data:/data -v "$PWD":/out alpine tar czf /out/att-data.tgz -C /data .`
- Recuperar acceso al panel: `docker service update --env-add ADMIN_PASSWORD='<nueva>' att-redmovil_app` **y** borrar `/data/auth.json` (si existe) dentro del volumen.
- Desarrollo local: `ADMIN_PASSWORD=… INSECURE_COOKIES=1 PORT=4180 npm start` y `npm test`.

El workflow conserva el orden de despliegues. Si hay un push más reciente mientras una ejecución está en curso, el script omite el commit anterior antes de actualizar el servicio.

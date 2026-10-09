# Despliegue automático

Cada `push` a `main` en `boosfyapp/attr-edmovil` ejecuta `.github/workflows/deploy.yml`. El workflow se conecta al VPS con una llave SSH dedicada cuya entrada en `authorized_keys` obliga a ejecutar `/usr/local/sbin/att-redmovil-deploy`. La llave sólo acepta `deploy <SHA>`; el script obtiene ese commit del repositorio público, construye y prueba la imagen, actualiza `att-redmovil_app`, comprueba la URL pública y sincroniza el código fuente de EasyPanel.

El script instalado en el servidor es una copia de `deploy/server-deploy.sh`, propiedad de root. Cambiarlo en GitHub **no** cambia automáticamente la copia instalada; un administrador debe revisar e instalar las modificaciones. Las credenciales `ATT_REDMOVIL_DEPLOY_KEY` y `ATT_REDMOVIL_KNOWN_HOSTS` viven en GitHub Actions Secrets, no en este repositorio.

## Operación

- Consultar resultados: [GitHub Actions](https://github.com/boosfyapp/attr-edmovil/actions/workflows/deploy.yml).
- Ejecutar otra vez un despliegue: usar **Run workflow** sobre `main`.
- Revertir la imagen activa desde el VPS: `docker service update --rollback --detach=false att-redmovil_app`. Después, revertir el commit de `main` si se quiere evitar que el siguiente despliegue reactive esa versión.
- Comprobar la imagen activa: `docker service inspect att-redmovil_app --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'`.

El workflow conserva el orden de despliegues. Si hay un push más reciente mientras una ejecución está en curso, el script omite el commit anterior antes de actualizar el servicio.

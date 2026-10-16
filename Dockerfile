FROM node:24-alpine

WORKDIR /app

# Servidor y panel (sin dependencias npm)
COPY package.json ./
COPY server/ ./server/
COPY admin/ ./admin/

# Landing pública
COPY index.html styles.css script.js data.js catalog-data.js favicon.png logo-light-bg-compact.png logo-dark-bg-compact.png ./site/
COPY assets/ ./site/assets/

ENV NODE_ENV=production \
    PORT=80 \
    SITE_DIR=/app/site \
    ADMIN_DIR=/app/admin \
    DATA_DIR=/data

# Contenido editable (borrador, versiones, fotos subidas): se monta como volumen en producción.
RUN mkdir -p /data && chown -R node:node /data /app && chmod -R a+rX /app
VOLUME /data

USER node
EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:80/healthz || exit 1

CMD ["node", "server/index.js"]

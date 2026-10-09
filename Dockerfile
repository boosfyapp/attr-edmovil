FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY styles.css /usr/share/nginx/html/styles.css
COPY data.js /usr/share/nginx/html/data.js
COPY catalog-data.js /usr/share/nginx/html/catalog-data.js
COPY script.js /usr/share/nginx/html/script.js
COPY assets/ /usr/share/nginx/html/assets/
COPY favicon.png /usr/share/nginx/html/favicon.png
COPY logo-light-bg-compact.png /usr/share/nginx/html/logo-light-bg-compact.png
COPY logo-dark-bg-compact.png /usr/share/nginx/html/logo-dark-bg-compact.png
EXPOSE 80

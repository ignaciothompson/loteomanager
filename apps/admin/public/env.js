// Runtime config para el admin SPA.
//
// En dev: se sirve este archivo tal cual (default = http://localhost:8080).
// En docker/prod: el entrypoint del contenedor admin-web (docker/admin-entrypoint.sh)
// REGENERA este archivo en /usr/share/nginx/html/env.js a partir de la env var
// POCKETBASE_URL antes de arrancar nginx.
//
// Para overridear en dev local: editar este archivo (gitignored si querés mantenerlo)
// o setear `window.__env.POCKETBASE_URL` desde la consola del browser.
window.__env = window.__env || {};
window.__env.POCKETBASE_URL = window.__env.POCKETBASE_URL || 'http://localhost:8090';

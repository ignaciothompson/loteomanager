window.__env = window.__env || {};
window.__env.POCKETBASE_URL = window.__env.POCKETBASE_URL || 'http://localhost:8090';
// Vacío en local: no carga widget Cloudflare (evita Brunhilde/401).
// En prod, /env.js dinámico del SSR inyecta TURNSTILE_SITE_KEY desde env del container.
window.__env.TURNSTILE_SITE_KEY = window.__env.TURNSTILE_SITE_KEY || '';

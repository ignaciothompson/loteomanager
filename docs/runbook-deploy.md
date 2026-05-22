# Runbook — Deploy de LoteoManager en Dokploy

Este documento describe el procedimiento completo para desplegar LoteoManager por primera vez en un VPS con Dokploy y Cloudflare Tunnel.

## Pre-requisitos

- VPS con Docker + Dokploy instalado y accesible.
- Cuenta de Cloudflare con un Tunnel ya creado.
- Dominio con DNS gestionado en Cloudflare.
- Cuenta de Cloudflare Turnstile con un site creado y sus keys.
- Acceso al repositorio del proyecto.

## Pasos

### 1. Crear el proyecto en Dokploy

1. Login en Dokploy.
2. Crear un nuevo proyecto: **LoteoManager**.
3. Crear una nueva aplicación tipo **Compose**.
4. Conectar el repositorio Git:
   - URL: `https://github.com/<owner>/loteomanager.git`
   - Branch: `main` (o la rama que corresponda)
   - Path del compose: `docker/docker-compose.yml`

### 2. Configurar variables de entorno

En la sección de Environment Variables de la aplicación, agregar todas las variables del `.env.example` con sus valores reales:

| Variable | Cómo obtenerla |
|---|---|
| `PB_VERSION` | Última versión estable, ej: `0.23.0` |
| `PB_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `PB_SERVICE_USER` | Email del user de servicio (después se crea en PocketBase) |
| `PB_SERVICE_PASSWORD` | `openssl rand -base64 24` |
| `PUBLIC_BASE_URL` | URL de la landing pública (ej: `https://www.example.com`) |
| `INMOBILIARIA_NOMBRE` | Nombre comercial visible |
| `TURNSTILE_SITE_KEY` | Dashboard de Cloudflare Turnstile → tu site |
| `TURNSTILE_SECRET_KEY` | Idem (mantener seguro) |
| `CLOUDFLARE_TUNNEL_TOKEN` | Dashboard del Tunnel → Connect → token |

### 3. Configurar el Cloudflare Tunnel

En el dashboard del Tunnel (Cloudflare Zero Trust → Networks → Tunnels):

1. Editar el Tunnel existente.
2. En **Public Hostnames**, agregar:

| Subdomain | Domain | Service |
|---|---|---|
| `panel` | `tu-dominio.com` | `http://admin-web:80` |
| `www` | `tu-dominio.com` | `http://landing-ssr:4000` |

3. Guardar los cambios.

**Nota:** los hostnames apuntan a los nombres internos de los contenedores en la red `loteo_network`. PocketBase NO se expone públicamente.

### 4. Desplegar

1. En Dokploy, click en **Deploy**.
2. Monitorear los logs de build de cada contenedor.
3. Esperar a que los 4 servicios queden en estado `healthy`.

### 5. Configuración inicial de PocketBase

Una vez desplegado, PocketBase necesita un superuser inicial. Hay dos formas:

**Opción A — Vía exec en Dokploy:**

```bash
docker exec -it loteo_pocketbase /pocketbase superuser create admin@example.com una_password_fuerte
```

**Opción B — Vía Dokploy terminal:**

Entrar al contenedor `loteo_pocketbase` desde la UI de Dokploy y ejecutar:

```bash
/pocketbase superuser create admin@example.com una_password_fuerte
```

### 6. Acceder al admin de PocketBase

Por seguridad, PocketBase no se expone públicamente. Para acceder al admin UI, hay dos opciones:

**Opción A (recomendada): SSH tunnel temporal**

Exponer PocketBase solo en localhost del VPS (agregar temporalmente al servicio `pocketbase` en el compose):

```yaml
ports:
  - "127.0.0.1:8080:8080"
```

Redeploy, luego desde tu máquina:

```bash
ssh -L 8080:127.0.0.1:8080 user@vps
```

Y en el navegador local: `http://localhost:8080/_/`.

**Opción B: Exponer vía Cloudflare con Access**

Agregar al Tunnel un hostname `pb.tu-dominio.com → http://pocketbase:8080` y proteger con Cloudflare Access (email OTP o lista blanca de emails). **Nunca exponer sin auth.**

### 7. Crear el user de servicio para el SSR

Desde el admin UI de PocketBase:

1. Ir a Collections → `users` → New record.
2. Email: el valor de `PB_SERVICE_USER` del `.env`.
3. Password: el valor de `PB_SERVICE_PASSWORD`.
4. Role: `admin` (o un role limitado si tenés uno custom para servicios).
5. Verified: `true`.
6. Guardar.

### 8. Verificación post-deploy

Probar en orden:

1. `https://panel.tu-dominio.com/` debería cargar el login del admin.
2. Loguearse con un user admin del sistema.
3. Navegar a una ruta interna (ej: `/usuarios`). Refrescar la página. **NO debe dar 404** (gracias al nginx.conf con fallback).
4. `https://www.tu-dominio.com/` debería cargar la home de la landing.
5. Crear una comparativa de prueba desde el admin.
6. Abrir el link público de la comparativa.
7. Enviar un mensaje desde el form de contacto. Verificar que llega al admin como interesado.

### 9. Si algo falla

- **Build de admin falla:** revisar logs, suele ser falta de memoria. Aumentar RAM del VPS o agregar swap.
- **Build de landing falla por Playwright:** los downloads de Chromium pueden ser lentos. Aumentar timeout o reintentar.
- **Healthcheck de landing falla:** verificar que la ruta `/healthz` esté implementada en el server Express.
- **Healthcheck de PocketBase falla:** verificar que `wget` está disponible (sí está en alpine).
- **Cloudflare Tunnel no conecta:** verificar que el `CLOUDFLARE_TUNNEL_TOKEN` es correcto y que el tunnel está activo en el dashboard.

### 10. Logs

Para ver logs en Dokploy:

- Cada servicio tiene su tab de logs en tiempo real.
- Para logs históricos: `docker logs loteo_pocketbase --tail=200`.

### 11. Backups (post-deploy)

Setear un cron en el VPS (fuera de Docker) que ejecute periódicamente:

```bash
docker exec loteo_pocketbase /pocketbase backup
```

Y suba el zip generado a Backblaze B2. Procedimiento completo en `docs/runbook-restore.md`.

# LoteoManager

Sistema integral de gestión inmobiliaria para inmobiliarias y desarrolladoras de loteos. Incluye un panel administrativo para gestión interna, una landing pública con presentación de propiedades, y un sistema de comparativas y propuestas comerciales compartibles vía link único.

---

## Tabla de contenidos

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Estructura del monorepo](#estructura-del-monorepo)
- [Requisitos](#requisitos)
- [Setup local](#setup-local)
- [Variables de entorno](#variables-de-entorno)
- [Comandos disponibles](#comandos-disponibles)
- [Modelo de datos](#modelo-de-datos)
- [Sistema de permisos](#sistema-de-permisos)
- [Sistema de campos custom y estados](#sistema-de-campos-custom-y-estados)
- [Importador de Excel](#importador-de-excel)
- [Comparativas y propuestas](#comparativas-y-propuestas)
- [Despliegue](#despliegue)
- [Mantenimiento](#mantenimiento)
- [Convenciones de código](#convenciones-de-código)
- [Roadmap](#roadmap)
- [Licencia](#licencia)

---

## Características

### Panel administrativo (`/admin`)

- Login con autenticación JWT.
- Dashboard con métricas (unidades por estado, ventas del período, leads y conversión).
- CRUD de barrios, unidades (lotes / casas / departamentos), arquitectos, usuarios.
- Sistema de permisos con roles (admin / vendedor) y asignación de barrios por vendedor (directa o por zona).
- ABM de **campos custom (extras)** configurables por entidad, con tipos texto / número / opciones / booleano / fecha.
- ABM de **estados configurables** con colores e iconos personalizables (manteniendo estados "core" del sistema).
- Sistema de comparativas: propuesta individual (1 unidad) o comparación múltiple (2-5 unidades).
- Importador de Excel con flujo de 2 pasos (staging + revisión + commit) y soporte para mapeo manual de columnas y extras.
- Auditoría automática de cambios en colecciones críticas.

### Landing pública (`/`)

- Páginas públicas de comparativas accesibles vía link único corto (`/c/:token`).
- Generación de PDF on-demand de comparativas con Playwright.
- Modo claro / oscuro con detección automática y toggle persistente.
- Mapas integrados con Leaflet + tiles de CARTO.
- Formulario de contacto con protección anti-spam (Cloudflare Turnstile + honeypot + rate limit).
- Página de expiración para links vencidos.
- Tracking de vistas (IP hasheada, sin almacenar IPs reales).
- Meta tags Open Graph y Twitter Card para previews ricos al compartir.

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Monorepo | [Nx](https://nx.dev) | última estable |
| Frontend | [Angular](https://angular.dev) | 21 |
| UI (admin) | [PrimeNG](https://primeng.org) + [Sakai-NG](https://sakai.primeng.org) | 21 |
| Estilos | [Tailwind CSS](https://tailwindcss.com) | 3.x |
| Backend / DB | [PocketBase](https://pocketbase.io) (SQLite + Auth + Files) | 0.23+ |
| SSR | Angular SSR + Express runtime | 21 |
| Mapas | [Leaflet](https://leafletjs.com) + CARTO tiles | 1.9+ |
| PDF | [Playwright](https://playwright.dev) (Chromium headless) | última estable |
| Anti-spam | [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) | — |
| Excel parser | [exceljs](https://github.com/exceljs/exceljs) | 4.x |
| Contenedores | Docker + Docker Compose | — |
| Despliegue | [Dokploy](https://dokploy.com) | — |
| Red pública | [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/) | — |
| Tipos generados | [pocketbase-typegen](https://github.com/patmood/pocketbase-typegen) | última |

---

## Arquitectura

### Vista de alto nivel

```
                                Internet
                                    │
                  ┌─────────────────┴────────────────────┐
                  │           Cloudflare Edge            │
                  │    (WAF + Cache + Turnstile)         │
                  └─────────────────┬────────────────────┘
                                    │
                          Cloudflare Tunnel
                                    │
                  ┌─────────────────┴────────────────────┐
                  │            VPS (Docker)              │
                  │                                      │
                  │  ┌──────────────┐  ┌──────────────┐  │
                  │  │  panel.*     │  │   www.*      │  │
                  │  │  admin (NX)  │  │  landing SSR │  │
                  │  │  Nginx       │  │  Node SSR    │  │
                  │  └──────┬───────┘  └──────┬───────┘  │
                  │         │                 │          │
                  │         └────────┬────────┘          │
                  │                  │                   │
                  │           ┌──────┴───────┐           │
                  │           │  PocketBase  │           │
                  │           │  (interno)   │           │
                  │           └──────┬───────┘           │
                  │                  │                   │
                  │              pb_data/                │
                  │           (SQLite + files)           │
                  └──────────────────┬───────────────────┘
                                     │
                              Backblaze B2
                          (backups automáticos)
```

### Principios de diseño

- **PocketBase nunca se expone públicamente.** Solo accesible desde la red interna de Docker y desde el admin del SoloDev vía Cloudflare Access.
- **El SSR de la landing accede a PocketBase con un user de servicio** (`landing-ssr@interno.local`) con permisos restringidos: lectura de comparativas válidas y creación de interesados.
- **El formulario público de leads pasa por el SSR**, no directamente contra PocketBase. El SSR valida Turnstile, honeypot y campos antes de escribir.
- **Las automatizaciones con n8n corren en homelab del desarrollador** y consumen la API de PocketBase por pull (cron), no por webhooks push, lo que da resiliencia ante caídas.

---

## Estructura del monorepo

```
loteomanager/
├── apps/
│   ├── admin/                 # Panel administrativo (Angular + Sakai)
│   │   └── src/app/
│   │       ├── features/      # Módulos de negocio
│   │       │   ├── admin/     # ABMs de configuración (extras, estados)
│   │       │   ├── auth/      # Login, reset, cambio inicial de password
│   │       │   ├── barrios/
│   │       │   ├── comparativas/
│   │       │   ├── dashboard/
│   │       │   ├── importador/
│   │       │   ├── interesados/
│   │       │   ├── unidades/
│   │       │   └── usuarios/
│   │       ├── core/          # Guards, interceptors, errores
│   │       └── layout/        # Layout de Sakai (topbar, sidebar, menú)
│   │
│   └── landing/               # Landing pública (Angular SSR)
│       └── src/
│           ├── app/
│           │   ├── layout/    # Topbar y footer minimalista (no Sakai)
│           │   ├── pages/
│           │   │   ├── home/                  # placeholder
│           │   │   ├── comparativa-publica/   # /c/:token
│           │   │   ├── expirada/              # /expirada
│           │   │   └── not-found/             # /404
│           │   ├── components/                # mapa, fab, dato-card, etc.
│           │   ├── services/                  # theme, config-publica
│           │   └── pipes/
│           └── server/        # Server routes y utilidades SSR-only
│               ├── pocketbase.client.ts
│               ├── pdf-generator.ts
│               ├── turnstile.ts
│               └── ip-hash.ts
│
├── libs/
│   ├── shared-types/          # Tipos generados con pocketbase-typegen
│   ├── shared-pb-client/      # Cliente PB + BaseCollectionService + servicios
│   │   └── src/lib/
│   │       ├── services/      # Servicios por colección
│   │       ├── permisos/      # PermisosService, constantes, guards
│   │       └── auth/          # AuthService, AuthGuard
│   ├── shared-ui/             # Componentes reutilizables (badge, editor extras, etc.)
│   └── shared-utils/          # Validators, formatters, slugify
│
├── pb_hooks/                  # JS hooks de PocketBase
│   ├── main.pb.js
│   ├── lm_extras_estados_shared.js
│   └── _tests/                # Tests de hooks
│
├── pb_migrations/             # Migraciones JS versionadas
│
├── docker/                    # Dockerfiles y compose
│   ├── docker-compose.yml
│   ├── pocketbase.Dockerfile
│   ├── admin.Dockerfile
│   └── landing.Dockerfile
│
├── docs/                      # Documentación del proyecto
│   ├── architecture.md
│   ├── permisos.md
│   ├── configuracion-dinamica.md
│   ├── runbook-deploy.md
│   ├── runbook-restore.md
│   └── known-bugs.md
│
├── tools/
│   └── pb-typegen.sh          # Regeneración de tipos
│
├── .github/workflows/         # CI (lint + build)
├── nx.json
├── package.json
├── tsconfig.base.json
└── README.md
```

---

## Requisitos

### Para desarrollo local

- **Node.js** 20 LTS o superior
- **npm** 10 o superior
- **Docker** y **Docker Compose** (para PocketBase y para probar el setup completo)
- Binario de **PocketBase** v0.23+ (alternativa a Docker para correr solo el backend)
- Cuenta gratuita de **Cloudflare Turnstile** (para formularios anti-spam)

### Para producción

Todo lo anterior, más:

- VPS con mínimo 8GB de RAM, 2 vCPU, Ubuntu 24.04 LTS
- Dominio con DNS gestionado en Cloudflare
- Cuenta de Backblaze B2 (para backups automáticos)
- Cuenta de Resend, Brevo o similar (para envío de emails)
- Dokploy instalado en el VPS

---

## Setup local

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/<owner>/loteomanager.git
cd loteomanager
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con los valores correspondientes (ver [Variables de entorno](#variables-de-entorno)).

### 3. Levantar PocketBase

**Opción A — Docker (solo PocketBase en local):**

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up -d pocketbase
```

PocketBase queda en `http://localhost:8080` (UI: `http://localhost:8080/_/`). El compose base sin `docker-compose.dev.yml` es el de producción (sin puertos expuestos).

**Opción B — Binario nativo:**

Descargar el binario de PocketBase desde https://github.com/pocketbase/pocketbase/releases, descomprimir y ejecutar:

```bash
./pocketbase serve --dir=./pb_data
```

### 4. Aplicar migraciones y crear superuser

Al primer arranque, PocketBase aplicará automáticamente las migraciones de `pb_migrations/`.

**Con Docker (recomendado):** si seteaste `PB_SUPERUSER_EMAIL` y `PB_SUPERUSER_PASSWORD` en `.env`, el entrypoint del contenedor crea/actualiza el superuser automáticamente (`upsert`) en cada arranque. La password debe tener mínimo 10 caracteres. Más detalle en `docs/runbook-deploy.md`, sección 5.

Si preferís crearlo a mano (o si las vars no están seteadas):

```bash
# Con Docker:
docker compose exec pocketbase /pocketbase superuser create admin@local admin12345

# Con binario:
./pocketbase superuser create admin@local admin12345
```

Acceder a `http://localhost:8080/_/` y verificar que las colecciones existen.

### 5. Crear datos de prueba (opcional)

Desde la UI de PocketBase, crear:

- Un user con `role=admin` para usar el panel administrativo.
- Un user de servicio (`landing-ssr@interno.local`) para que la landing pública pueda consultar datos.

### 6. Regenerar tipos TypeScript

```bash
npm run pb:types
```

Esto genera `libs/shared-types/src/lib/pocketbase-types.ts` a partir del schema actual.

### 7. Levantar las apps

En terminales separadas:

```bash
# Panel administrativo
npm run dev:admin    # → http://localhost:4200

# Landing pública con SSR
npm run dev:landing  # → http://localhost:4000
```

---

## Variables de entorno

Ver `.env.example` para la lista completa. Las variables críticas son:

### Backend (PocketBase)

| Variable | Descripción |
|---|---|
| `PB_INTERNAL_URL` | URL interna donde corre PocketBase (ej: `http://pocketbase:8080`). Usada por el SSR de la landing dentro de la red Docker. |
| `POCKETBASE_PUBLIC_URL` | URL pública del PB desde el browser. El admin-web la inyecta en `env.js` al arrancar; la landing la usa para las URLs de archivos en el snapshot. Cambiarla y redeployar — no requiere rebuild. |
| `PB_SUPERUSER_EMAIL` | Email del superuser de PocketBase (creado/actualizado vía bootstrap del entrypoint) |
| `PB_SUPERUSER_PASSWORD` | Password del superuser (mín. 10 caracteres; rotable cambiando el valor y redeployando) |

### SSR de la landing

| Variable | Descripción |
|---|---|
| `PB_SERVICE_USER` | Email del user de servicio del SSR |
| `PB_SERVICE_PASSWORD` | Password del user de servicio |
| `PUBLIC_BASE_URL` | URL pública de la landing (ej: `https://www.example.com`) |

### Cloudflare Turnstile

| Variable | Descripción |
|---|---|
| `TURNSTILE_SITE_KEY` | Site key pública (se incluye en HTML) |
| `TURNSTILE_SECRET_KEY` | Secret key (solo server-side) |

### Despliegue (producción)

| Variable | Descripción |
|---|---|
| `CLOUDFLARE_TUNNEL_TOKEN` | Token del Cloudflare Tunnel |
| `PB_ENCRYPTION_KEY` | Clave de encriptación de PocketBase (`openssl rand -base64 32`) |
| `PB_VERSION` | Versión del binario PocketBase en Docker (ej: `0.23.0`) |
| `B2_KEY_ID` | Application Key ID de Backblaze |
| `B2_APP_KEY` | Application Key secreta |
| `B2_BUCKET` | Nombre del bucket de backups |

**Importante:** nunca commitear `.env`. Mantener `.env.example` actualizado con todas las variables (con valores placeholder).

---

## Comandos disponibles

```bash
# Desarrollo
npm run dev:admin              # Levanta el panel admin en http://localhost:4200
npm run dev:landing            # Levanta la landing SSR en http://localhost:4000

# Build
npm run build:all              # Build de producción de admin + landing
nx build admin                 # Build solo admin
nx build landing               # Build solo landing

# Testing
npm run test:all               # Todos los tests
nx test shared-utils           # Tests de una lib específica

# Linting
npm run lint:all               # Lint en todo el monorepo
nx lint admin                  # Lint de una app

# Tipos PocketBase
npm run pb:types               # Regenera tipos desde el schema actual

# Affected (solo lo que cambió)
nx affected -t lint
nx affected -t test
nx affected -t build
```

---

## Modelo de datos

### Colecciones principales

| Colección | Propósito |
|---|---|
| `users` | Usuarios del sistema con roles (admin / vendedor) |
| `barrios` | Conjuntos urbanísticos con zona, ubicación, plano general |
| `unidades` | Lotes, casas y departamentos (con o sin barrio asociado) |
| `arquitectos` | Directorio de profesionales asociables a unidades |
| `interesados` | Leads y prospectos |
| `comparativas` | Propuestas y comparaciones compartibles vía link |
| `comparativa_vistas` | Tracking de accesos a comparativas (IP hasheada) |
| `extras_definiciones` | ABM de campos custom por entidad |
| `estados_definiciones` | ABM de estados configurables (core + custom) |
| `vendedor_barrios` | Pivot N:N de asignación directa de barrios |
| `vendedor_zonas` | Asignación de zonas a vendedores |
| `importaciones` | Sesiones de importación (Excel o API) |
| `importacion_filas` | Filas individuales con su estado de validación |
| `audit_log` | Registro inmutable de cambios |
| `config` | Singleton de configuración global |

Cada migración en `pb_migrations/` define una colección o un cambio de schema. Las migraciones se aplican automáticamente al arrancar PocketBase.

Para el detalle completo del schema y las API Rules, ver `docs/architecture.md`.

---

## Sistema de permisos

El sistema usa **2 roles fijos** (`admin` y `vendedor`) y **permisos granulares** definidos en código como constantes en `libs/shared-pb-client/src/lib/permisos/permisos.constants.ts`. La arquitectura está preparada para sumar un rol `supervisor` en el futuro sin reescribir código.

### Reglas por rol

| Acción | Admin | Vendedor |
|---|---|---|
| Ver todas las unidades | ✓ | ✓ |
| Editar todos los campos de unidades | ✓ | ✗ |
| Cambiar estado de unidades en sus barrios | ✓ | ✓ |
| Cambiar estado de unidades fuera de sus barrios | ✓ | ✗ |
| Crear / editar barrios | ✓ | ✗ |
| Ver todos los leads | ✓ | Configurable |
| Crear comparativas | ✓ | ✓ (solo de unidades visibles) |
| Configurar extras y estados | ✓ | ✗ |
| Importar datos | ✓ | ✗ |
| Gestionar usuarios | ✓ | ✗ |

### Asignación de barrios a vendedores

Un vendedor puede tener acceso a barrios de dos formas:

1. **Asignación directa:** se eligen barrios individuales (tabla `vendedor_barrios`).
2. **Por zona:** los barrios tienen un campo `zona` y se asignan zonas al vendedor (tabla `vendedor_zonas`).

El vendedor ve la **unión** de ambas asignaciones.

Más detalle en `docs/permisos.md`.

---

## Sistema de campos custom y estados

### Extras (campos custom)

El admin puede agregar campos custom (extras) a barrios, unidades e interesados desde el ABM en `/admin/extras`. Cada extra tiene:

- `code` (snake_case, inmutable)
- `nombre` (editable, se denormaliza en los registros)
- `tipo` (texto, número, opciones, booleano, fecha)
- `opciones` (solo si tipo = opciones)
- Flags: requerido, visible en listado, visible en landing, visible en comparativa
- Grupo, orden de display, activo

### Estados configurables

El admin puede agregar/editar estados desde `/admin/estados`. Hay dos tipos:

- **Core:** los del sistema (disponible, vendido, etc.) — no se pueden borrar, solo renombrar/recolorar.
- **Custom:** agregados por el admin — se pueden borrar (forzando reasignación de registros existentes).

### Modelo híbrido de almacenamiento

Los registros guardan los extras como JSON denormalizado:

```json
{
  "extras": [
    {
      "extra_id": "abc123",
      "code": "piscina_barrio",
      "nombre": "Piscina del barrio",
      "valor": "Incluida"
    }
  ]
}
```

Esto da lectura rápida (un solo query trae el registro con sus extras) y resiliencia (el nombre denormalizado funciona como fallback). Un hook sincroniza el nombre en todos los registros cuando el admin renombra una definición.

Más detalle en `docs/configuracion-dinamica.md`.

---

## Importador de Excel

El importador permite cargar barrios y unidades en masa desde un archivo Excel, con un flujo de 2 pasos:

1. **Análisis (staging):** se sube el archivo, se parsea, se valida cada fila contra el schema y se detectan duplicados. Las filas se guardan en `importacion_filas` con estado `ok`, `duplicado`, `error` o `advertencia`. Las columnas y extras no reconocidos quedan pendientes de mapeo manual.

2. **Revisión y commit:** el admin revisa las filas problemáticas, decide caso por caso (omitir / crear / actualizar), mapea columnas y extras no reconocidos, y confirma la importación. Los registros se crean/actualizan en orden (primero barrios, después unidades).

Formato esperado: una hoja con columna `tipo` (`barrio` | `unidad`), columnas base según el tipo y columnas `Extra: <nombre>` para los campos custom.

El importador genera una plantilla descargable con dropdowns en las celdas para evitar errores comunes.

Más detalle en `docs/importador.md`.

---

## Comparativas y propuestas

Existen dos tipos de comparativas:

- **Propuesta individual:** una sola unidad, formato detallado (hero, datos, mapa, plano, galería).
- **Comparación múltiple:** 2-5 unidades, formato comparativo (cards arriba + tabla detallada).

Cada comparativa se identifica por un `token_publico` único de 16 caracteres. El link público es de la forma `https://www.example.com/c/<token>`.

### Snapshot histórico

Al crear una comparativa, el sistema captura los datos actuales de las unidades en un campo `contenido_snapshot` (JSON). Esto garantiza que el cliente vea siempre los datos como estaban al momento de generarse, aunque después se modifiquen.

### Generación de PDF

Los PDFs se generan on-demand con Playwright (Chromium headless) renderizando la misma página pública con un modo especial `?pdf=1`. El PDF generado se cachea en `comparativas.pdf_generado` y se regenera si la comparativa se modifica.

### Anti-spam

El formulario de contacto en las comparativas usa:

- **Cloudflare Turnstile:** captcha invisible.
- **Honeypot:** campo oculto que solo bots completan.
- **Rate limiting:** configurado en Cloudflare WAF.
- **Validación server-side:** formato de email, campos requeridos, comparativa válida y no expirada.

---

## Despliegue

### Arquitectura de producción

El sistema corre sobre **Docker + Dokploy** en un VPS, con **Cloudflare Tunnel** como única salida a internet (sin puertos abiertos). Los contenedores son:

- `pocketbase` (no expuesto público)
- `admin-web` (Nginx con build estático de Angular)
- `landing-ssr` (Node con SSR)
- `cloudflared` (tunnel)

Cloudflare enruta:

- `panel.dominio.com` → admin-web
- `www.dominio.com` → landing-ssr

PocketBase queda solo accesible desde la red interna de Docker.

### Pasos de despliegue

Ver `docs/runbook-deploy.md` para el procedimiento completo.

### Bootstrap automático del superuser

El contenedor `pocketbase` ejecuta `docker/pocketbase-entrypoint.sh` en cada arranque:

1. Levanta PocketBase y espera a que `/api/health` responda 200.
2. Si `PB_SUPERUSER_EMAIL` y `PB_SUPERUSER_PASSWORD` están definidas, corre `superuser upsert` (crea en primer deploy, actualiza password en redeploys).
3. Si faltan, loguea `[entrypoint] PB_SUPERUSER_EMAIL/PASSWORD no definidas, skip bootstrap` y sigue — el flujo de dev local sin `.env` no se rompe.

**Rotar password:** cambiar `PB_SUPERUSER_PASSWORD` en Environment y redeployar. `upsert` es idempotente.

**Dokploy:** las dos variables van en la pestaña **Environment** del servicio Compose (junto con el resto del `.env.example`).

> **Seguridad:** la password del superuser queda en el entorno del contenedor. En producción, usar un gestor de secretos si aplica (secrets de Dokploy, Vault, Doppler, etc.). Nunca commitear `.env` con valores reales.

### Backups

Los backups corren diariamente vía cron a Backblaze B2 (~$0.005/GB/mes). Se mantienen 30 días daily + 12 meses month-end. El comando `backup` nativo de PocketBase genera un zip de `pb_data/` que se sube a B2 con `b2-cli`.

Procedimiento de restauración: `docs/runbook-restore.md`.

---

## Mantenimiento

### Tareas mensuales

- Verificar backups recientes en Backblaze B2.
- Aplicar actualizaciones de seguridad del sistema (`apt update && apt upgrade`).
- Revisar leads en estado `error` de sync con HubSpot (cuando esté implementado).
- Revisar logs de PocketBase y de los containers en busca de errores recurrentes.

### Monitoreo

UptimeRobot (free tier) monitorea:

- `https://www.dominio.com/healthz`
- `https://panel.dominio.com/healthz`
- Healthcheck interno de PocketBase

Alertas configuradas al email del desarrollador.

### Bugs conocidos

Ver `docs/known-bugs.md` para el registro de bugs pendientes con su severidad y archivo afectado.

---

## Convenciones de código

- **TypeScript strict mode** en todo el proyecto.
- **Standalone components** de Angular 21.
- **Signals** para reactividad (no Observables salvo HTTP).
- **Reactive Forms** (no Template-driven).
- **Tailwind CSS** para utilidades + variables CSS de PrimeNG para colores temáticos.
- **PrimeIcons** como librería de iconos.
- Naming: `xyz-list`, `xyz-form`, `xyz-detail` para componentes de feature.
- **Migraciones JS de PocketBase** versionadas con timestamp en el nombre (`1700000XYZ_*.js`).
- **Hooks de PocketBase** documentados con comentarios sobre los eventos que escuchan.
- **No commitear secretos.** Toda variable sensible va en `.env` (gitignored), con placeholders en `.env.example`.

Más detalle en `docs/conventions.md` (a futuro).

---

## Roadmap

### Completado

- [x] Setup del monorepo y stack base
- [x] Panel admin con CRUDs principales
- [x] Sistema de extras y estados configurables
- [x] Sistema de usuarios, permisos y asignación de barrios (directa + por zona)
- [x] Reset y cambio inicial de password
- [x] Importador de Excel con flujo de 2 pasos
- [x] Comparativas con páginas públicas y generación de PDF

### En curso

- [ ] Pulido visual y consistencia de componentes
- [ ] Documentación detallada (`docs/`)

### Próximo

- [ ] Landing pública completa (home, listado de propiedades, detalle, barrios)
- [ ] Integración con HubSpot vía n8n (sync de leads)
- [ ] Notificaciones automáticas a vendedores (WhatsApp + email)
- [ ] Importación de interesados y arquitectos
- [ ] Filtros avanzados por extras en listados públicos

### Futuro

- [ ] Sistema de roles configurable por admin (RBAC completo)
- [ ] Multi-tenancy (varios clientes en una sola instancia)
- [ ] Dashboard avanzado con gráficas y reportes
- [ ] Logs de acceso y auditoría expandida
- [ ] App móvil para vendedores (PWA)

---

## Licencia

Este proyecto es de uso privado. Ver `LICENSE` para más detalles.

---

## Contacto

Desarrollado por [Ignacio Thompson](https://ignaciothompson.com).
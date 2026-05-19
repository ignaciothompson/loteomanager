# Especificaciones Técnicas — LoteoManager

**Versión:** 2.0
**Fecha:** Mayo 2026
**Rol del desarrollador:** SoloDev
**Objetivo:** Ecosistema de gestión inmobiliaria seguro, de baja latencia y altamente automatizado, priorizando facilidad de despliegue, mantenimiento mínimo y costo operativo bajo.

---

## 1. Cambios respecto a la v1

Esta versión corrige los siguientes problemas detectados en la revisión:

- **Seguridad:** PocketBase ya no se expone públicamente. La Landing accede vía SSR con un token de servicio.
- **Anti-abuso:** Cloudflare Turnstile + honeypot + rate limit en formularios públicos.
- **Resiliencia:** n8n se mueve al homelab del desarrollador y trabaja por *pull* (cron) en vez de webhooks. Esto da reintentos automáticos e idempotencia.
- **Backups:** Estrategia explícita de respaldo a Backblaze B2.
- **Schema:** Estados de lote ampliados, geolocalización en barrios, separación de galería y plano, auditoría de cambios.
- **Frontend:** Monorepo Nx con tipos compartidos generados desde PocketBase.
- **Versiones:** Stack fijado en Angular 21 + PrimeNG 21 + Sakai-NG.

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión | Notas |
|---|---|---|---|
| Frontend | Angular | 21.x | Signals, SSR nativo, Server Routes |
| UI Kit | Sakai-NG (PrimeNG) | 21.x | Boilerplate admin, Tailwind, Modo Oscuro |
| Backend / DB | PocketBase | 0.23+ | SQLite, Auth, Files, API Rules |
| Hosting | VPS Linux | 8GB RAM / 2 vCPU | Hetzner CPX21 o equivalente |
| OS | Ubuntu Server | 24.04 LTS | |
| Contenedores | Docker + Dokploy | última estable | |
| Red pública | Cloudflare Tunnel | — | Zero Trust, sin puertos abiertos |
| Caché edge | Cloudflare | — | Cache Rules sobre rutas SSR |
| Anti-abuso | Cloudflare Turnstile | — | Captcha invisible gratuito |
| Automatización | n8n self-hosted | última | **En homelab del dev**, no en VPS |
| CRM | HubSpot | — | Plan free/starter inicial |
| Backups | Backblaze B2 | — | ~$0.005/GB/mes |
| Tipos TS | pocketbase-typegen | — | Generación automática de tipos |
| Monorepo | Nx | última | apps + libs compartidas |

---

## 3. Arquitectura general

### 3.1 Diagrama de red

```
Internet
   │
   ├─► [Cloudflare Edge: WAF + Cache + Turnstile]
   │       │
   │       └─► [Cloudflare Tunnel] ──► VPS (sin puertos abiertos)
   │                                     │
   │                                     ├─ panel.dominio.com  → Nginx → Angular Admin (estático)
   │                                     ├─ www.dominio.com    → Node SSR (Landing pública)
   │                                     └─ pb-internal        → PocketBase (NO expuesto público)
   │
   │
Homelab del dev
   │
   └─► [n8n] ── pull cada 1-2 min ──► PocketBase del VPS (vía API + token servicio)
                                       │
                                       └─► HubSpot (push contactos/deals)
                                       └─► WhatsApp/Email (notificación a vendedores)
```

### 3.2 Decisiones clave

**PocketBase no se expone a la web pública.** Solo el panel admin (autenticado) y el SSR de Angular tienen acceso. La landing pública sirve datos pre-renderizados y cacheados en Cloudflare.

**El SSR de Angular es el único componente que escribe leads.** El formulario de la landing manda al endpoint Server Route de Angular, este valida Turnstile, valida campos y recién ahí escribe en PocketBase con un token de servicio.

**n8n hace pull, no recibe push.** Esto elimina la necesidad de exponer el homelab a internet y da resiliencia: si n8n está caído, los leads se acumulan como `sync_status='pending'` y se procesan al volver.

---

## 4. Infraestructura — VPS

### 4.1 Especificaciones

- **Proveedor sugerido:** Hetzner CPX21 (3 vCPU AMD, 4GB) o CPX31 (4 vCPU, 8GB) — preferir 8GB.
- **Costo estimado:** €8-15/mes según proveedor.
- **OS:** Ubuntu Server 24.04 LTS.
- **Swap:** 2GB configurados como red de seguridad.
- **Firewall:** UFW activo, solo permite SSH (con clave, no password) y la salida del túnel Cloudflare. Puertos 80/443 cerrados al mundo.

### 4.2 Setup inicial del servidor

Pasos manuales una sola vez:

1. Crear VPS, copiar SSH pubkey, deshabilitar password login.
2. `apt update && apt upgrade -y`.
3. Configurar swap 2GB.
4. Instalar Docker + Docker Compose.
5. Instalar Dokploy según docs oficiales.
6. Crear cuenta Cloudflare, agregar dominio, habilitar tunnel.
7. Crear cuenta Backblaze B2, generar Application Key con permiso writeFiles + listBuckets sobre el bucket de backups.

### 4.3 Distribución de RAM esperada

| Servicio | RAM estimada |
|---|---|
| PocketBase | 200-400 MB |
| Angular SSR (Node) | 400-700 MB |
| Nginx (admin estática) | 50 MB |
| cloudflared | 50 MB |
| Sistema Ubuntu | 600-800 MB |
| **Total promedio** | ~2 GB |
| **Margen para picos / Dokploy / build** | ~6 GB |

### 4.4 Contenedores Docker

Una sola red interna `loteo_network`:

| Contenedor | Imagen | Puerto interno | Expuesto al tunnel |
|---|---|---|---|
| `pocketbase` | custom (Dockerfile) | 8080 | No (solo red interna) |
| `admin-web` | nginx:alpine | 80 | Sí → panel.dominio.com |
| `landing-ssr` | node:20-alpine | 4000 | Sí → www.dominio.com |
| `cloudflared` | cloudflare/cloudflared | — | Sí (es la salida) |

**No hay contenedor de n8n en el VPS.** n8n vive en el homelab.

### 4.5 Cloudflare Cache Rules

Configurar en el dashboard de Cloudflare:

- **Rule 1:** URL Path matches `/_next/*` o `/assets/*` → Edge Cache TTL: 1 mes.
- **Rule 2:** URL Path matches `/lotes/*` o `/` → Edge Cache TTL: 10 minutos, respect origin.
- **Rule 3:** URL Path matches `/api/*` → Bypass cache.
- **Rule 4 (WAF):** Rate limit 5 requests / 10 minutos por IP en `/api/leads/*`.

### 4.6 Backups

**Estrategia:**

- **Diario 03:00 AM:** PocketBase ejecuta su comando `backup` nativo, genera `pb_data_YYYYMMDD.zip`.
- **Subida automática:** script bash con `b2-cli` sube el zip a Backblaze B2 bucket `loteomanager-backups`.
- **Retención:** lifecycle rule en B2 mantiene 30 días daily + 12 meses month-end.
- **Costo estimado:** <$1/mes con DB de pocas GB.

**Restauración:** documentar el procedimiento en `docs/runbook-restore.md`. **Probar la restauración al menos una vez antes de producción.**

---

## 5. Frontend — Monorepo Nx

### 5.1 Estructura

```
loteomanager/
├── apps/
│   ├── admin/              # Panel administrativo (Sakai-NG, CSR)
│   │   └── src/
│   ├── landing/            # Landing pública (SSR)
│   │   └── src/
│   └── landing-e2e/        # Tests E2E con Playwright
├── libs/
│   ├── shared-types/       # Interfaces TS generadas con pocketbase-typegen
│   ├── shared-pb-client/   # Cliente PocketBase configurado + interceptors
│   ├── shared-ui/          # Componentes reutilizables (vacío inicial)
│   └── shared-utils/       # Validators, formatters, etc.
├── tools/
│   ├── pb-typegen.sh       # Script de regeneración de tipos
│   └── deploy.sh           # Script de deploy manual de fallback
├── docs/                   # Toda la documentación del proyecto
├── docker/
│   ├── docker-compose.yml
│   ├── pocketbase.Dockerfile
│   ├── admin.Dockerfile
│   └── landing.Dockerfile
├── nx.json
├── package.json
└── tsconfig.base.json
```

### 5.2 App Admin (Sakai-NG)

**Configuración:**

- Crear con Sakai CLI: `npx @primeng/sakai-cli@latest new`.
- Mover dentro de `apps/admin/` del monorepo.
- Mantener intacto `src/app/layout/` (cáscara, topbar, sidebar, footer).
- Modificar `src/app/layout/component/app.menu.ts` con las rutas reales:
  - Dashboard
  - Inventario → Barrios, Lotes
  - Ventas → Interesados, Enlaces compartibles
  - Directorio → Arquitectos, Usuarios
- Eliminar `src/app/pages/` excepto `dashboard/`, `crud/` (referencia) y `landing/` (no se usa, se borra después).
- Crear módulos propios: `pages/barrios/`, `pages/lotes/`, `pages/interesados/`, etc.
- **Modo oscuro:** default activado pero respetar la elección del usuario, persistir en `localStorage`.
- **Estilos:** Tailwind para utilidades, variables CSS de PrimeNG para colores temáticos.

**Servicios genéricos:**

```typescript
// libs/shared-pb-client/src/lib/base-collection.service.ts
@Injectable()
export abstract class BaseCollectionService<T> {
  abstract collection: string;
  // CRUD genérico contra PocketBase, expone signals
  list(filter?: string): Signal<T[]>;
  get(id: string): Signal<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}
```

Cada colección extiende: `BarriosService extends BaseCollectionService<Barrio>`.

### 5.3 App Landing (SSR)

**Obligatorio SSR** para SEO. Angular 21 lo trae nativo con `@angular/ssr`.

**Rutas:**
- `/` — home con buscador y carrusel de destacados.
- `/barrios` — listado de barrios.
- `/barrios/:slug` — detalle de barrio con plano clickeable y lotes disponibles.
- `/lotes/:id` — detalle de lote con galería, plano individual, formulario de contacto.
- `/sitemap.xml` — server route que genera sitemap dinámico desde PocketBase.
- `/robots.txt` — estático.
- `/api/leads` — server route que recibe el form, valida Turnstile, escribe en PocketBase.

**Cliente PocketBase del SSR:**

- Usa un usuario de servicio (`landing-ssr@interno.local`) con permisos limitados:
  - Lectura de barrios y lotes con `estado='Disponible'`.
  - Creación de interesados.
  - Sin permisos de update/delete sobre nada.
- Token guardado como variable de entorno `PB_SERVICE_TOKEN`, montado en el contenedor.

**Optimización de imágenes:**
- Usar siempre `?thumb=WxH` de PocketBase para servir thumbnails.
- Nunca embed imágenes originales >5MB en la landing.

**Mapas:**
- Leaflet (gratis, sin API key).
- Tile provider: OpenStreetMap o CARTO Voyager.

### 5.4 Generación de tipos

Comando `npm run pb:types` que ejecuta:

```bash
pocketbase-typegen --db ./pb_data/data.db --out libs/shared-types/src/lib/pocketbase-types.ts
```

Correr cada vez que se modifique el schema. Idealmente como pre-commit hook.

---

## 6. Backend — PocketBase

### 6.1 Versión y configuración

- PocketBase v0.23+ (verificar nombres de hooks actualizados al implementar).
- Custom Dockerfile que incluye `pb_hooks/` y `pb_migrations/` versionados en git.
- Settings:
  - SMTP configurado (Resend / SendGrid free tier) para emails de auth.
  - S3 settings apuntando a Backblaze B2 para uploads (opcional, si crece el storage).

### 6.2 Schema completo de colecciones

#### `users` (sistema de PocketBase, extendida)
```
- id (autogen)
- email (Email, unique)
- password (System)
- name (Text)
- role (Select: admin, vendedor)
- telefono (Text, nullable)
- whatsapp (Text, nullable)  ← para notificaciones
- avatar (File, single, image/*)
```

#### `barrios`
```
- id (autogen)
- slug (Text, unique)         ← para URLs amigables
- nombre (Text, required)
- descripcion (Editor, nullable)
- ubicacion_texto (Text)      ← dirección legible
- lat (Number, nullable)      ← geolocalización
- lng (Number, nullable)
- plano_general (File, single, image/svg+xml | image/*)
- imagen_portada (File, single, image/*)
- estado (Select: activo, en_desarrollo, pausado)
- created / updated (autogen)
```

#### `arquitectos`
```
- id (autogen)
- nombre (Text, required)
- matricula (Text)
- email (Email)
- telefono (Text)
- notas (Editor)
- created / updated
```

#### `lotes`
```
- id (autogen)
- barrio_id (Relation → barrios, required)
- numero_lote (Text, required)
- metros_cuadrados (Number, required)
- precio (Number, required)
- moneda (Select: USD, ARS) — default USD
- estado (Select: disponible, bloqueado, reservado, sena, vendido, escriturado)
- destacado (Bool, default false)   ← carrusel landing
- oferta (Bool, default false)
- precio_oferta (Number, nullable)
- arquitecto_id (Relation → arquitectos, nullable)
- responsable_id (Relation → users, required)  ← vendedor asignado manualmente
- galeria (File, multiple, max 10, image/*, max 5MB c/u)
- plano_lote (File, single, image/* | application/pdf)
- descripcion (Editor)
- created / updated
```

#### `interesados`
```
- id (autogen)
- lote_id (Relation → lotes, nullable)   ← null si es consulta general
- nombre (Text, required)
- email (Email, required)
- telefono (Text)
- mensaje (Text)
- origen (Select: web, manual, whatsapp, referido)
- hubspot_contact_id (Text, nullable)
- hubspot_deal_id (Text, nullable)
- sync_status (Select: pending, synced, error) — default pending
- sync_error (Text, nullable)
- synced_at (Date, nullable)
- created / updated
```

#### `audit_log`
```
- id (autogen)
- user_id (Relation → users, nullable)
- collection (Text)         ← nombre de la colección modificada
- record_id (Text)
- action (Select: create, update, delete)
- before (JSON, nullable)   ← snapshot pre-cambio
- after (JSON, nullable)
- created (autogen)
```

#### `config` (singleton)
```
- id (autogen, fijo: "global")
- responsable_default_id (Relation → users)  ← para leads sin lote
- whatsapp_notif_enabled (Bool)
- email_notif_enabled (Bool)
- mensaje_bienvenida (Editor)
```

### 6.3 API Rules

**Principio:** ninguna regla pública. Todo va vía SSR con token de servicio o admin autenticado.

```
users:
  List/View:    @request.auth.id != ""
  Create:       @request.auth.role = "admin"
  Update:       @request.auth.id = id || @request.auth.role = "admin"
  Delete:       @request.auth.role = "admin"

barrios, lotes, arquitectos:
  List/View:    @request.auth.id != ""
  Create/Update/Delete: @request.auth.role = "admin"

interesados:
  List/View:    @request.auth.id != ""
  Create:       @request.auth.id != ""    ← incluye al user de servicio del SSR
  Update:       @request.auth.id != ""    ← n8n necesita actualizar sync_status
  Delete:       @request.auth.role = "admin"

audit_log:
  List/View:    @request.auth.role = "admin"
  Create:       @request.auth.id != ""    ← lo crean los hooks
  Update/Delete: nadie (registro inmutable)

config:
  List/View:    @request.auth.id != ""
  Update:       @request.auth.role = "admin"
```

### 6.4 Hooks (`pb_hooks/main.pb.js`)

**Verificar nombres reales en docs de PocketBase v0.23+ al implementar.** Estructura general:

```javascript
// Auditoría: log automático de cambios en lotes y barrios
onRecordAfterUpdateSuccess((e) => {
  $app.dao().saveRecord(buildAuditRecord(e, "update"));
}, "lotes", "barrios", "interesados");

onRecordAfterCreateSuccess((e) => {
  // Si es interesado, dejar sync_status='pending' (default ya lo hace)
  // Si es otra colección, log de auditoría
}, "lotes", "barrios", "interesados");

// Validación extra de leads
onRecordBeforeCreateRequest((e) => {
  if (e.collection.name === "interesados") {
    // Validar formato email
    // Detectar duplicados recientes (mismo email + mismo lote en últimos 5 min)
    // Si dup, lanzar BadRequestError
  }
});
```

---

## 7. Flujo de leads end-to-end

```
1. Usuario completa form en /lotes/:id
   ↓
2. JS frontend resuelve Turnstile (invisible o checkbox)
   ↓
3. POST a /api/leads del SSR de Angular con {nombre, email, telefono, mensaje, lote_id, cf-turnstile-response, honeypot}
   ↓
4. SSR valida:
   - honeypot vacío
   - turnstile token contra siteverify de Cloudflare
   - campos requeridos y formatos
   ↓
5. SSR escribe en PocketBase con token de servicio:
   POST /api/collections/interesados/records
   { ..., sync_status: "pending", origen: "web" }
   ↓
6. SSR responde 200 al usuario → muestra "Gracias, te contactaremos"
   ↓
7. (Asíncrono) n8n en homelab corre cron cada 1-2 min:
   GET /api/collections/interesados/records?filter=(sync_status='pending')
   ↓
8. Por cada lead pending:
   a. Buscar/crear contacto en HubSpot (search by email)
   b. Si lote_id existe, crear Deal asociado
   c. Obtener responsable_id del lote → users → telefono/email
   d. Enviar notificación WhatsApp (vía Evolution API o WAHA en homelab) + email
   e. PATCH al lead: sync_status='synced', hubspot_contact_id, synced_at
   f. Si falla cualquier paso: sync_status='error', sync_error=mensaje
   ↓
9. Admin ve en panel los leads con badge de estado de sync
```

**Reintentos:** un segundo cron en n8n cada 30 min reintenta los `sync_status='error'` con backoff (max 3 intentos por lead, después queda manual).

---

## 8. Anti-abuso del formulario público

### 8.1 Capas de defensa

1. **Cloudflare Turnstile** — captcha invisible obligatorio.
2. **Honeypot field** — `<input name="website" tabindex="-1" autocomplete="off">` con CSS `display:none`. Si llega lleno, descartar.
3. **Rate limit Cloudflare WAF** — 5 reqs / 10 min por IP en `/api/leads/*`.
4. **Validación server-side** — formato email, longitudes razonables, lote_id existe y está disponible.
5. **Detección de duplicados** — hook de PocketBase rechaza mismo email + mismo lote_id en últimos 5 min.
6. **Logs de seguridad** — todas las requests bloqueadas se loguean para revisión.

### 8.2 Setup Turnstile

1. Crear sitio en Cloudflare Turnstile dashboard.
2. Obtener `site_key` (público) y `secret_key` (server).
3. Frontend incluye widget: `<div class="cf-turnstile" data-sitekey="..."></div>`.
4. SSR valida con POST a `https://challenges.cloudflare.com/turnstile/v0/siteverify`.

---

## 9. Dokploy y despliegue

### 9.1 Estructura del despliegue

- **Dokploy gestiona** los 4 contenedores como una "Application" tipo Compose.
- **Git-based deploy:** push a `main` → Dokploy detecta cambios → rebuild contenedores afectados.
- **Variables de entorno** se configuran en la UI de Dokploy (no se commitean).
- **Volúmenes persistentes:**
  - `pb_data/` (DB SQLite + uploads de PocketBase)
  - `cloudflared/` (config del tunnel)

### 9.2 Plan B: deploy manual

Si Dokploy falla, debe poderse levantar todo con:

```bash
cd /opt/loteomanager
docker compose -f docker/docker-compose.yml up -d
```

Por eso `docker-compose.yml` se mantiene versionado y funcional independientemente de Dokploy.

### 9.3 Variables de entorno

```
# PocketBase
PB_ADMIN_EMAIL=
PB_ADMIN_PASSWORD=
PB_ENCRYPTION_KEY=

# SSR Landing
PB_SERVICE_TOKEN=          # token JWT del user landing-ssr
PB_INTERNAL_URL=http://pocketbase:8080
TURNSTILE_SECRET_KEY=
TURNSTILE_SITE_KEY=        # también va al frontend
PUBLIC_BASE_URL=https://www.dominio.com

# Cloudflare Tunnel
CF_TUNNEL_TOKEN=

# Backups
B2_KEY_ID=
B2_APP_KEY=
B2_BUCKET=loteomanager-backups
```

---

## 10. Fases de desarrollo

### Etapa 1 — Core Admin (semanas 1-4)

**Objetivo:** CRUD funcional, infra estable.

- [ ] Setup VPS, swap, Docker, Dokploy.
- [ ] Cuenta Cloudflare, dominio, tunnel configurado.
- [ ] Custom Dockerfile de PocketBase, deploy.
- [ ] Schema completo de colecciones + API Rules.
- [ ] Setup Backblaze B2 + script de backup automatizado.
- [ ] Probar restauración de backup en VPS de prueba.
- [ ] Crear monorepo Nx con `apps/admin` desde Sakai CLI.
- [ ] `libs/shared-pb-client` con `BaseCollectionService` genérico.
- [ ] Login + interceptors JWT.
- [ ] Vistas: Barrios (CRUD completo), Lotes (CRUD + galería + plano), Arquitectos, Usuarios.
- [ ] Dashboard básico con conteos por estado.
- [ ] Generación automática de tipos con `pocketbase-typegen`.

### Etapa 2 — Landing pública (semanas 5-8)

**Objetivo:** portal SEO-friendly que captura leads.

- [ ] `apps/landing` con SSR habilitado.
- [ ] Usuario de servicio en PocketBase + token.
- [ ] Páginas: home (destacados + buscador), barrios, detalle de lote.
- [ ] Mapa con Leaflet en barrios.
- [ ] Galería de imágenes con lightbox.
- [ ] Formulario de contacto con Turnstile + honeypot.
- [ ] Server Route `/api/leads` con validaciones.
- [ ] `/sitemap.xml` y `/robots.txt`.
- [ ] Cloudflare Cache Rules configuradas.
- [ ] WAF rate limit configurado.
- [ ] Meta tags Open Graph + Twitter Cards.
- [ ] Lighthouse mobile >90 en performance, SEO, accesibilidad.

### Etapa 3 — Automatizaciones (semanas 9-10)

**Objetivo:** sincronización HubSpot + notificaciones.

- [ ] n8n levantado en homelab del dev.
- [ ] Workflow A: cron 1 min, procesa `interesados.sync_status='pending'`.
- [ ] Workflow B: cron 30 min, reintenta `sync_status='error'` con backoff.
- [ ] Integración HubSpot: search/create contact, create deal.
- [ ] Notificación WhatsApp (Evolution API o WAHA) al responsable.
- [ ] Notificación email al responsable (fallback si WhatsApp falla).
- [ ] Vista en admin: badge de estado de sync por lead.

### Etapa 4 — Mantenimiento (mes 4 en adelante)

**Objetivo:** operación estable con intervención mínima.

- [ ] Monitoreo: UptimeRobot (gratis) sobre www, panel y healthcheck de PocketBase.
- [ ] Alertas a email del dev si algún servicio cae.
- [ ] Actualizaciones de seguridad mensuales (apt + imágenes Docker).
- [ ] Revisión semanal/quincenal de leads en estado `error`.
- [ ] Validar backups recientes una vez al mes.

---

## 11. Costos operativos mensuales estimados

| Item | Costo USD/mes |
|---|---|
| VPS Hetzner CPX31 (8GB) | ~12 |
| Dominio (.com) | ~1 (prorrateado anual) |
| Backblaze B2 backups | <1 |
| Cloudflare (Free plan) | 0 |
| Cloudflare Turnstile | 0 |
| HubSpot Free | 0 |
| n8n (homelab del dev) | 0 |
| WhatsApp API (Evolution / WAHA self-hosted) | 0 |
| **Total** | **~15** |

El presupuesto mensual de 200 USD del cliente cubre con holgura: VPS + dominio + soporte + un margen para imprevistos (escala del VPS si crece, costo eventual de HubSpot si supera el free tier, etc.).

---

## 12. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Caída del homelab del dev | Media | Bajo | Leads se acumulan como `pending`, se procesan al volver |
| Pérdida del VPS | Baja | Alto | Backups diarios B2, restauración documentada |
| Spam masivo en form | Media | Medio | 5 capas anti-abuso (sección 8) |
| HubSpot rate limit | Baja | Bajo | n8n procesa con backoff, sync_status='error' visible |
| Crecimiento de DB >1GB | Baja | Bajo | SQLite soporta GB sin problema, B2 escala lineal |
| Dokploy bug bloqueante | Baja | Medio | docker-compose.yml versionado, deploy manual posible |
| Dev no disponible (vacaciones, etc.) | Alta | Bajo | Sistema diseñado para auto-operar, alertas a email |

---

## 13. Documentación a producir

Carpeta `docs/` del repo:

- `README.md` — overview y links.
- `architecture.md` — este documento.
- `runbook-deploy.md` — pasos para desplegar desde cero.
- `runbook-restore.md` — restauración de backup.
- `runbook-incidents.md` — qué hacer si X cae.
- `n8n-workflows.md` — exports JSON de los workflows + descripción.
- `pocketbase-schema.md` — schema actualizado (auto-generable).
- `api-leads-spec.md` — spec del endpoint público de leads.

---

## 14. Criterios de cierre por etapa

**Etapa 1 cerrada cuando:**
- Admin puede crear/editar/eliminar barrios, lotes, arquitectos, usuarios.
- Backups corriendo y al menos una restauración probada.
- Login funciona, sesiones persisten, roles diferencian admin de vendedor.

**Etapa 2 cerrada cuando:**
- Landing renderiza correctamente en mobile y desktop.
- Lighthouse mobile >90 en performance, SEO, accesibilidad.
- Formulario rechaza spam (probado con 100 envíos automatizados).
- Lead enviado desde landing aparece en panel admin en <30 segundos.

**Etapa 3 cerrada cuando:**
- Lead nuevo aparece en HubSpot como contacto en <2 minutos.
- Vendedor recibe WhatsApp/email con datos del lead y link al lote.
- 10 leads de prueba en 1 hora se procesan sin pérdidas.

---

**Fin del documento — listo para inicio de Etapa 1.**

# Tarea: Setup inicial del monorepo LoteoManager

Sos el agente principal coordinando la creación del scaffolding inicial de **LoteoManager**, una app de gestión inmobiliaria. Voy a darte el plan completo y vos vas a ejecutar usando **delegación a subagentes en paralelo donde sea posible**.

## Contexto del proyecto

- Cliente: SoloDev, Argentina.
- Stack: **Nx monorepo + Angular 21 + PrimeNG 21 + Sakai-NG + TypeScript strict + Tailwind**.
- Backend (no se construye en este prompt, solo se prepara la integración): PocketBase v0.23+.
- Despliegue: Docker + Dokploy + Cloudflare Tunnel.
- Importante: en esta tarea **NO se escribe lógica de negocio**, solo scaffolding, configuración base y placeholders bien comentados. El proyecto se inicia desde cero, no hay código previo que migrar.

## Estructura objetivo

```
loteomanager/
├── apps/
│   ├── admin/              # Panel admin (Sakai-NG, CSR)
│   └── landing/            # Landing pública (SSR obligatorio)
├── libs/
│   ├── shared-types/       # Tipos generados con pocketbase-typegen
│   ├── shared-pb-client/   # Cliente PocketBase + BaseCollectionService
│   ├── shared-ui/          # Componentes reutilizables
│   └── shared-utils/       # Validators, formatters
├── tools/
│   └── pb-typegen.sh       # Script de regeneración de tipos
├── docker/
│   ├── docker-compose.yml
│   ├── pocketbase.Dockerfile
│   ├── admin.Dockerfile
│   └── landing.Dockerfile
├── docs/
│   └── README.md
├── .github/workflows/
│   └── ci.yml
├── nx.json
├── package.json
├── tsconfig.base.json
├── tailwind.preset.js
├── .env.example
└── .gitignore
```

---

## Plan de ejecución con delegación

Ejecutá las fases en orden. **Dentro de cada fase, lanzá los subagentes en paralelo** y esperá que todos terminen antes de pasar a la siguiente fase.

### FASE 0 — Bootstrap (vos directamente, no delegues)

Esta fase la hacés vos porque establece la base sobre la que trabajan los subagentes:

1. Crear workspace Nx vacío:
   ```bash
   npx create-nx-workspace@latest loteomanager --preset=apps --packageManager=npm --nxCloud=skip
   ```
2. Entrar al directorio y verificar que `nx.json` y `package.json` existan.
3. Instalar plugins necesarios: `@nx/angular`.
4. Crear las carpetas vacías: `tools/`, `docker/`, `docs/`, `.github/workflows/`.
5. **Inicializar git** con primer commit "chore: initial nx workspace" para tener checkpoint de rollback.

Cuando termines la Fase 0, **antes de delegar nada**, mostrame:
- El árbol de archivos generado.
- Confirmación de que `nx --version` funciona.

---

### FASE 1 — Apps (delegar en paralelo, 2 subagentes)

Lanzá **estos dos subagentes en paralelo**, ambos trabajan sobre el monorepo ya creado:

#### Subagente A — App `admin` con Sakai-NG

> Sos un subagente especializado en setup de proyectos Angular. Tu única tarea:
>
> 1. Generar Sakai-NG en directorio temporal: `npx @primeng/sakai-cli@latest new sakai-temp` (versión Angular 21 / PrimeNG 21).
> 2. Mover el contenido de `sakai-temp/` a `apps/admin/` del monorepo Nx existente.
> 3. Crear `apps/admin/project.json` adaptado a Nx con targets `build`, `serve`, `test`, `lint`.
> 4. Adaptar `apps/admin/tsconfig.json` extendiendo `tsconfig.base.json` del root.
> 5. **Limpiar páginas de demo** de Sakai: eliminar `src/app/pages/` excepto `dashboard/`, `crud/` (referencia) y dejar `landing/` solo si el template lo necesita para compilar (si no, eliminar también).
> 6. Modificar `src/app/layout/component/app.menu.ts` con menú real:
>    - Dashboard
>    - Inventario → Barrios, Lotes
>    - Ventas → Interesados, Enlaces compartibles
>    - Directorio → Arquitectos, Usuarios
> 7. Configurar `LayoutService` con dark mode default ON pero respetando `localStorage`.
> 8. Verificar que `nx serve admin` levanta sin errores.
>
> No escribas componentes de páginas reales — dejá los routes apuntando a placeholders vacíos con un comentario `// TODO: implementar en Etapa 1`. No instales dependencias innecesarias.
>
> Reportá al final: comandos exactos ejecutados, archivos creados/modificados, y output de `nx serve admin`.

#### Subagente B — App `landing` con SSR

> Sos un subagente especializado en Angular SSR. Tu única tarea:
>
> 1. Generar app Angular con SSR: `nx g @nx/angular:application landing --ssr=true --routing=true --style=scss --strict=true --skipTests=false`.
> 2. Configurar tres **Server Routes** vacías como placeholders:
>    - `GET /sitemap.xml` → responde `text/xml` con un sitemap mínimo válido y comentario `// TODO: generar dinámicamente desde PocketBase`.
>    - `GET /robots.txt` → responde `text/plain` con `User-agent: *\nAllow: /\nSitemap: <BASE_URL>/sitemap.xml`.
>    - `POST /api/leads` → handler vacío que retorna `501 Not Implemented` con comentario `// TODO: validar Turnstile + escribir en PocketBase`.
> 3. Crear estructura de páginas placeholder: `home`, `barrios`, `barrios/:slug`, `lotes/:id`. Sin contenido real, solo skeleton con `<h1>` indicando la página.
> 4. Configurar `provideClientHydration()` con event replay habilitado.
> 5. Setup de meta tags base (title, description, OG) usando `Meta` y `Title` services de Angular.
> 6. Verificar que `nx serve landing --ssr` levanta y que `curl http://localhost:4000/` devuelve HTML pre-renderizado (no shell vacío).
>
> No implementes integración con PocketBase ni captcha. Solo scaffolding con TODOs claros.
>
> Reportá al final: rutas server creadas, output del curl de verificación, y cualquier ajuste que hayas tenido que hacer al `project.json`.

**Esperá a que ambos subagentes terminen antes de continuar.** Si alguno falla, leé su reporte, decidí si reintentar o ajustar, y recién después seguís.

---

### FASE 2 — Libs compartidas (delegar en paralelo, 4 subagentes)

Las 4 libs son independientes entre sí en esta fase de scaffolding. Lanzá **4 subagentes en paralelo**:

#### Subagente C — `shared-types`

> Crear lib buildable: `nx g @nx/angular:library shared-types --buildable --strict=true`.
>
> Crear `libs/shared-types/src/lib/pocketbase-types.ts` con header:
>
> ```typescript
> /**
>  * Tipos generados automáticamente desde el schema de PocketBase.
>  * NO EDITAR A MANO.
>  *
>  * Regenerar con: npm run pb:types
>  * Origen: pocketbase-typegen contra ./pb_data/data.db
>  */
> export type Collections = unknown; // placeholder hasta primera generación
> ```
>
> Exportar desde `index.ts`. Verificar que `nx build shared-types` compila.

#### Subagente D — `shared-pb-client`

> Crear lib buildable: `nx g @nx/angular:library shared-pb-client --buildable --strict=true`.
>
> Instalar `pocketbase` en el monorepo: `npm install pocketbase`.
>
> Crear estos archivos con código real funcional (no solo placeholders):
>
> **`pocketbase.config.ts`:** factory de `InjectionToken<PocketBase>` que toma URL de `environment.pocketbaseUrl` y devuelve instancia configurada.
>
> **`base-collection.service.ts`:** clase abstracta genérica usando **Angular Signals** (no Observables). Métodos:
> - `list(filter?: string): Signal<T[]>`
> - `get(id: string): Signal<T | null>`
> - `create(data: Partial<T>): Promise<T>`
> - `update(id: string, data: Partial<T>): Promise<T>`
> - `delete(id: string): Promise<void>`
>
> Internamente usar el cliente PocketBase inyectado y manejar errores con un signal interno `error`.
>
> **`auth.interceptor.ts`:** functional HTTP interceptor que agrega `Authorization: Bearer <token>` desde el `AuthStore` de PocketBase si existe.
>
> **`auth.service.ts`:** wrapper sobre `pb.collection('users').authWithPassword()` exponiendo signals `currentUser`, `isAuthenticated`.
>
> Exportar todo desde `index.ts`. Verificar `nx build shared-pb-client`.

#### Subagente E — `shared-ui`

> Crear lib buildable: `nx g @nx/angular:library shared-ui --buildable --strict=true`.
>
> Dejar **vacía** salvo por:
> - Un componente standalone placeholder `EmptyStateComponent` (recibe `icon`, `title`, `message` como inputs signals) que se va a usar en tablas vacías.
> - Export desde `index.ts`.
>
> Verificar `nx build shared-ui`.

#### Subagente F — `shared-utils`

> Crear lib buildable: `nx g @nx/angular:library shared-utils --buildable --strict=true`.
>
> Implementar utilities reales (no placeholders):
> - `validators/` — `isValidEmail(s: string): boolean`, `isValidPhoneAR(s: string): boolean` (mobile +54 9 ...).
> - `formatters/` — `formatCurrency(amount: number, currency: 'USD' | 'ARS'): string`, `formatDate(d: Date | string, fmt?: string): string`.
> - `slugify.ts` — convierte string a slug url-safe (sin diacríticos, lowercase, guiones).
>
> Tests unitarios básicos para cada función. Exportar desde `index.ts`. Verificar `nx test shared-utils` y `nx build shared-utils`.

**Esperá a que los 4 terminen.** Reportá al usuario una tabla con qué libs quedaron, qué exporta cada una, y resultado de los builds.

---

### FASE 3 — Configuración cross-cutting (delegar en paralelo, 3 subagentes)

#### Subagente G — Tailwind compartido

> 1. Instalar Tailwind compatible con Angular 21: `npm install -D tailwindcss postcss autoprefixer`.
> 2. Crear `tailwind.preset.js` en raíz con configuración base (theme extend con paleta neutral, fontFamily Inter como fallback).
> 3. Crear `apps/admin/tailwind.config.js` extendiendo el preset, **compatible con PrimeNG** (importante: configurar `darkMode: ['selector', '[data-theme="dark"]']` o el selector que use Sakai).
> 4. Crear `apps/landing/tailwind.config.js` extendiendo el preset.
> 5. Agregar directivas `@tailwind base; @tailwind components; @tailwind utilities;` al global stylesheet de cada app.
> 6. Verificar que ambas apps siguen compilando con `nx build admin` y `nx build landing`.

#### Subagente H — Docker

> Crear los 4 archivos en `docker/` con código completo y comentado:
>
> **`pocketbase.Dockerfile`:**
> - Base `alpine:latest`.
> - Descarga binario PocketBase v0.23+ (parametrizar versión con ARG).
> - Copia `pb_hooks/` y `pb_migrations/` (crear ambas carpetas vacías con `.gitkeep` en raíz del repo).
> - Expone 8080 internamente.
> - CMD: `pocketbase serve --http=0.0.0.0:8080`.
>
> **`admin.Dockerfile`:** multi-stage:
> - Stage 1 `node:20-alpine`: copia monorepo, `npm ci`, `nx build admin --configuration=production`.
> - Stage 2 `nginx:alpine`: copia output de build a `/usr/share/nginx/html`, incluir `nginx.conf` con fallback para SPA routing.
>
> **`landing.Dockerfile`:** multi-stage:
> - Stage 1 build SSR con `nx build landing --configuration=production`.
> - Stage 2 `node:20-alpine` runtime: copia output, `CMD ["node", "dist/apps/landing/server/server.mjs"]`, expone 4000.
>
> **`docker-compose.yml`:**
> - 4 servicios: `pocketbase`, `admin-web`, `landing-ssr`, `cloudflared`.
> - Red interna `loteo_network` (bridge).
> - **NO exponer puertos al host** (todo va por cloudflared).
> - Volumen persistente `pb_data` para PocketBase.
> - Variables desde `.env` (referenciar `.env.example`).
> - Comentarios extensos explicando cada bloque.
>
> Crear también `.env.example` en raíz con TODAS las variables necesarias (PocketBase, SSR, Cloudflare, Backblaze) con valores placeholder y comentarios.

#### Subagente I — CI + scripts + docs

> 1. Crear `.github/workflows/ci.yml`:
>    - Trigger: push a `main`, PRs.
>    - Jobs: install (con caché de npm), `nx affected -t lint`, `nx affected -t test`, `nx affected -t build`.
>    - Usar `nx-set-shas` action para affected.
>
> 2. Crear `tools/pb-typegen.sh`:
>    ```bash
>    #!/usr/bin/env bash
>    # Regenera tipos TypeScript desde el schema de PocketBase.
>    # Requiere: npx pocketbase-typegen y pb_data/data.db existente (descargar de prod o usar local).
>    # ...
>    ```
>    Hacerlo ejecutable.
>
> 3. Agregar scripts al `package.json` raíz:
>    ```json
>    "dev:admin": "nx serve admin",
>    "dev:landing": "nx serve landing --ssr",
>    "build:all": "nx run-many -t build --projects=admin,landing",
>    "lint:all": "nx run-many -t lint",
>    "test:all": "nx run-many -t test",
>    "pb:types": "bash tools/pb-typegen.sh"
>    ```
>
> 4. Crear `.gitignore` cubriendo: `node_modules/`, `dist/`, `.nx/cache`, `.env`, `.env.local`, `pb_data/`, `*.log`, `.DS_Store`, `tmp/`.
>
> 5. Crear `docs/README.md` con: descripción breve del proyecto, comandos básicos (dev, build, test, pb:types), estructura del monorepo, link al spec técnico v2 (placeholder).

**Esperá a que los 3 terminen.** Verificá que el CI workflow esté sintácticamente válido y que los Dockerfiles no tengan errores obvios (no hace falta buildear las imágenes).

---

### FASE 4 — Verificación final (vos directamente)

1. Correr en serie:
   - `npm install` (limpio si hace falta).
   - `nx run-many -t lint`
   - `nx run-many -t build`
   - `nx serve admin` → verificar que abre en `http://localhost:4200`.
   - Matar y correr `nx serve landing --ssr` → verificar SSR con `curl`.
2. Generar el árbol de archivos final con `tree -L 3 -I 'node_modules|.nx|dist'`.
3. Hacer commit final: `git add . && git commit -m "chore: complete monorepo scaffold"`.

---

## Reglas globales (aplican a vos y a todos los subagentes)

- **TypeScript strict en todo.** Sin `any` salvo casos imprescindibles documentados.
- **No instalar dependencias innecesarias.** Cada `npm install` debe estar justificado.
- **Cada archivo de configuración tiene un comentario inicial** explicando qué hace y por qué.
- **No commitear secretos.** Todo va en `.env.example` con placeholders.
- **No escribir lógica de negocio.** Solo estructura, configuración, y placeholders con TODOs.
- **Si un subagente encuentra un blocker, debe reportarlo claramente, no improvisar.**
- **Versiones exactas pinneadas** para Angular core, PrimeNG, Nx (no usar `^` en estas tres).

## Coordinación entre subagentes

- Los subagentes no se comunican entre sí. Vos sos el único punto de coordinación.
- **Antes de delegar cada fase**, mostrame el resumen de qué vas a delegar y a cuántos subagentes.
- **Después de cada fase**, mostrame el reporte consolidado de todos los subagentes antes de pasar a la siguiente.
- Si dos subagentes producirían **conflictos de archivos** (ej: ambos quieren modificar `package.json` raíz), serializalos en lugar de paralelizarlos. En este plan ya lo evité, pero verificá antes de lanzar.

## Entregable final

- Monorepo funcional listo para desarrollo de Etapa 1.
- Reporte ejecutivo con: árbol de archivos, libs/apps creadas, comandos disponibles, pasos manuales pendientes (ej: configurar `.env` real, instalar Docker en VPS).
- Tres puntos clave a revisar manualmente antes de empezar a desarrollar features.

¿Estás listo para empezar la Fase 0?

# Tarea: Desarrollo de la lógica base del sistema de administración — LoteoManager

Sos el agente principal encargado de implementar la **lógica de negocio** del panel administrativo de LoteoManager. El monorepo ya está scaffoldeado (Nx + Angular 21 + Sakai-NG + PocketBase). Esta tarea cubre el **backend (PocketBase schema, hooks, migrations) + servicios Angular del admin**, pero **NO la UI completa** — solo componentes mínimos para validar que la lógica funciona. La UI pulida viene en una tarea posterior.

## Contexto

- **Stack:** Angular 21 + PrimeNG 21 + Sakai-NG (admin) + PocketBase v0.23+.
- **Monorepo Nx** ya scaffoldeado con `apps/admin`, `apps/landing`, `libs/shared-types`, `libs/shared-pb-client`, `libs/shared-ui`, `libs/shared-utils`.
- **Rol del desarrollador:** SoloDev, segundo proyecto en paralelo a trabajo principal.
- **Objetivo de esta tarea:** dejar funcionando todo el backend + la capa de servicios Angular + tests, con UI mínima funcional para validar.

## Alcance de esta tarea

### Incluye

1. Schema completo de PocketBase como migraciones JS versionadas (`pb_migrations/`).
2. Hooks de PocketBase (`pb_hooks/`) para:
   - Auditoría de cambios.
   - Validación de permisos por campo (vendedor solo edita estados).
   - Actualización automática de fechas comerciales en unidades al cambiar estado.
   - Validación de duplicados en interesados.
3. Servicios Angular en `libs/shared-pb-client` extendiendo `BaseCollectionService`.
4. Tipos TypeScript generados con `pocketbase-typegen`.
5. Sistema de permisos en frontend (guards, directivas, signals).
6. Lógica del importador en 2 pasos (parser Excel + endpoint API + flujo de revisión).
7. Lógica de comparativas (generación de token, tracking, PDF generation con Playwright).
8. Componentes Angular mínimos funcionales para cada módulo (sin diseño pulido, solo p-table + p-form básicos para validar el flujo).
9. Tests unitarios para validators críticos y hooks de PocketBase.

### NO incluye

- Diseño pulido de UI (eso es tarea separada).
- Integración con HubSpot (es etapa 3, vive en n8n).
- Landing pública (es tarea separada).
- Configuración de Cloudflare/dominio/deploy.

---

## Modelo de datos completo

### Colección: `users` (extender la nativa de PocketBase)

```
- id (autogen)
- email (Email, unique, required)
- password (System)
- name (Text, required)
- role (Select: admin | vendedor, required)
- telefono (Text, nullable)
- whatsapp (Text, nullable)
- avatar (File, single, image/*, max 2MB)
- leads_visibility (Select: solo_mios | mios_mas_sin_asignar | todos_mis_barrios | todos)
  - default: "solo_mios"
  - aplica solo si role = "vendedor"
- activo (Bool, default true)
- created / updated (autogen)
```

### Colección: `barrios`

```
- id (autogen)
- slug (Text, unique, required, lowercase, sin espacios)
- nombre (Text, required)
- descripcion (Editor, nullable)
- ubicacion_texto (Text)
- lat (Number, nullable, range -90 a 90)
- lng (Number, nullable, range -180 a 180)
- plano_general (File, single, image/svg+xml | image/*, max 5MB)
- imagen_portada (File, single, image/*, max 5MB)
- estado (Select: activo | en_desarrollo | pausado, default activo)
- destacado (Bool, default false)
- created / updated (autogen)
```

### Colección: `vendedor_barrios` (tabla pivot N:N)

```
- id (autogen)
- vendedor_id (Relation → users, required)
- barrio_id (Relation → barrios, required)
- created (autogen)
- UNIQUE (vendedor_id, barrio_id)
```

### Colección: `arquitectos`

```
- id (autogen)
- nombre (Text, required)
- matricula (Text)
- email (Email, nullable)
- telefono (Text, nullable)
- notas (Editor)
- created / updated
```

### Colección: `unidades` (reemplaza a "lotes" del schema original)

```
- id (autogen)

# Identificación y categorización
- tipo_unidad (Select: lote | casa | departamento, required)
- codigo_interno (Text, unique, required)  // ej: "BS-L-042" o "INDEP-CASA-001"
- barrio_id (Relation → barrios, NULLABLE)
- numero_unidad (Text)  // número de lote, número de depto, etc.
- direccion_propia (Text, nullable)  // requerido si barrio_id es null

# Datos físicos comunes
- metros_cuadrados (Number, required, min 0)
- metros_construidos (Number, nullable)  // solo casa/depto
- ambientes (Number, nullable)  // solo casa/depto
- antiguedad_anios (Number, nullable)  // solo casa/depto, 0 = a estrenar
- cocheras (Number, default 0)

# Datos comerciales
- precio (Number, required, min 0)
- moneda (Select: USD | ARS, default USD)
- oferta (Bool, default false)
- precio_oferta (Number, nullable)
- destacado (Bool, default false)

# Estado y fechas comerciales
- estado (Select: disponible | bloqueado | reservado | sena | vendido | escriturado, default disponible)
- fecha_ingreso (Date, default = created)
- fecha_bloqueo (Date, nullable)
- fecha_reserva (Date, nullable)
- fecha_sena (Date, nullable)
- fecha_venta (Date, nullable)
- fecha_escritura (Date, nullable)
- interesado_comprador_id (Relation → interesados, nullable)

# Responsable y arquitecto
- responsable_id (Relation → users, required)
- arquitecto_id (Relation → arquitectos, nullable)

# Contenido
- descripcion (Editor)
- galeria (File, multiple, max 10, image/*, max 5MB c/u)
- plano_unidad (File, single, image/* | application/pdf, max 10MB)

- created / updated
```

### Colección: `interesados`

```
- id (autogen)
- unidad_id (Relation → unidades, nullable)
- comparativa_id (Relation → comparativas, nullable)
- nombre (Text, required)
- email (Email, required)
- telefono (Text)
- mensaje (Text)
- origen (Select: web | manual, default web)
- estado (Select: nuevo | contactado | reunion | oferta | cerrado_ganado | cerrado_perdido, default nuevo)
- responsable_id (Relation → users, nullable)  // vendedor asignado
- hubspot_contact_id (Text, nullable)
- hubspot_deal_id (Text, nullable)
- sync_status (Select: pending | synced | error, default pending)
- sync_error (Text, nullable)
- synced_at (Date, nullable)
- notas_internas (Editor)  // notas locales del vendedor, no van a HubSpot
- created / updated
```

### Colección: `comparativas`

```
- id (autogen)
- tipo (Select: propuesta_individual | comparacion_multiple, required)
- token_publico (Text, unique, required, 16-20 chars alfanuméricos)
- titulo (Text, required)  // ej: "Propuesta Lote 42 - Barrio Sol"
- mensaje_personalizado (Editor, nullable)  // texto del vendedor al cliente
- unidades_ids (Relation → unidades, multiple, min 1, max 5)
- cliente_destinatario_nombre (Text, nullable)
- cliente_destinatario_email (Email, nullable)
- creado_por (Relation → users, required)
- expira_en (Date, nullable)
- vistas_count (Number, default 0)
- pdf_generado (File, single, application/pdf, nullable)
- created / updated
```

### Colección: `comparativa_vistas` (tracking de accesos)

```
- id (autogen)
- comparativa_id (Relation → comparativas, required)
- accessed_at (Date, autogen on create)
- ip_hash (Text)  // hash de IP, no IP real, por privacidad
- user_agent (Text)
- created (autogen)
```

### Colección: `importaciones`

```
- id (autogen)
- tipo (Select: barrios | unidades | barrios_con_unidades, required)
- origen (Select: excel | api, required)
- estado (Select: analizando | listo_para_confirmar | confirmada | descartada | con_errores, default analizando)
- archivo_origen (File, single, .xlsx | .xls | .csv, nullable)
- total_filas (Number, default 0)
- filas_ok (Number, default 0)
- filas_duplicado (Number, default 0)
- filas_error (Number, default 0)
- filas_advertencia (Number, default 0)
- creado_por (Relation → users, required)
- confirmada_en (Date, nullable)
- created / updated
```

### Colección: `importacion_filas`

```
- id (autogen)
- importacion_id (Relation → importaciones, required)
- numero_fila (Number, required)  // fila del Excel original
- datos_originales (JSON)  // raw parseado
- datos_normalizados (JSON)  // listo para crear el registro
- estado_fila (Select: ok | duplicado | error | advertencia, required)
- mensaje (Text)  // descripción del error/duplicado/warning
- registro_existente_id (Text, nullable)  // id del registro duplicado si aplica
- decision_usuario (Select: pendiente | omitir | crear | actualizar, default pendiente)
- aplicada (Bool, default false)  // true cuando ya se procesó en el commit
- created / updated
```

### Colección: `audit_log`

```
- id (autogen)
- user_id (Relation → users, nullable)
- collection (Text, required)
- record_id (Text, required)
- action (Select: create | update | delete, required)
- before (JSON, nullable)
- after (JSON, nullable)
- created (autogen)
```

### Colección: `config` (singleton)

```
- id (autogen, único registro con id="global")
- responsable_default_id (Relation → users, required)
- whatsapp_notif_enabled (Bool, default true)
- email_notif_enabled (Bool, default true)
- mensaje_bienvenida_landing (Editor)
- comparativa_expiracion_default_dias (Number, default 30)
- updated_at (Date)
```

---

## API Rules de PocketBase

**Principio:** ninguna regla pública. Todo acceso autenticado. El user de servicio del SSR de la landing (que se crea en otra tarea) tendrá role específico.

```
users:
  List/View:    @request.auth.id != ""
  Create:       @request.auth.role = "admin"
  Update:       @request.auth.id = id || @request.auth.role = "admin"
  Delete:       @request.auth.role = "admin"

barrios:
  List/View:    @request.auth.id != ""
  Create:       @request.auth.role = "admin"
  Update:       @request.auth.role = "admin"
  Delete:       @request.auth.role = "admin"

vendedor_barrios:
  List/View:    @request.auth.id != "" && (@request.auth.role = "admin" || vendedor_id = @request.auth.id)
  Create/Update/Delete: @request.auth.role = "admin"

unidades:
  List/View:    @request.auth.id != ""
  Create:       @request.auth.role = "admin"
  Update:       @request.auth.id != ""  // hook valida qué campos puede tocar cada rol
  Delete:       @request.auth.role = "admin"

interesados:
  List/View:    @request.auth.id != ""  // hook filtra según leads_visibility del vendedor
  Create:       @request.auth.id != ""
  Update:       @request.auth.id != ""
  Delete:       @request.auth.role = "admin"

comparativas:
  List/View:    @request.auth.id != ""  // hook permite ver solo las propias para vendedores
  Create:       @request.auth.id != ""
  Update:       @request.auth.id != "" && creado_por = @request.auth.id
  Delete:       @request.auth.role = "admin" || creado_por = @request.auth.id

comparativa_vistas:
  List/View:    @request.auth.role = "admin" || @request.auth.id != "" && comparativa_id.creado_por = @request.auth.id
  Create:       @request.auth.id != "" || ""  // el SSR público las crea
  Update/Delete: nadie

importaciones, importacion_filas:
  List/View:    @request.auth.role = "admin" || creado_por = @request.auth.id
  Create:       @request.auth.id != ""
  Update:       @request.auth.id != "" && creado_por = @request.auth.id
  Delete:       @request.auth.role = "admin"

audit_log:
  List/View:    @request.auth.role = "admin"
  Create/Update/Delete: nadie  // solo hooks

config:
  List/View:    @request.auth.id != ""
  Update:       @request.auth.role = "admin"
  Create/Delete: nadie
```

---

## Hooks de PocketBase (`pb_hooks/main.pb.js`)

### Hook 1 — Auditoría automática

Sobre las colecciones `unidades`, `barrios`, `interesados`, `comparativas`, `users` registrar create/update/delete en `audit_log`. Usar `onRecordAfterCreateSuccess`, `onRecordAfterUpdateSuccess`, `onRecordAfterDeleteSuccess` (verificar nombre exacto en docs de PocketBase v0.23+).

Para updates, capturar `before` y `after` del record (PocketBase expone `e.record.originalCopy()` o equivalente).

### Hook 2 — Validación de permisos por campo en `unidades`

Sobre `onRecordBeforeUpdateRequest` para `unidades`:

```
Si el usuario que hace el request tiene role = "vendedor":
  - Verificar que la unidad pertenece a un barrio asignado al vendedor
    (consultar vendedor_barrios donde vendedor_id = auth.id AND barrio_id = unidad.barrio_id)
  - Si NO está asignado: throw ForbiddenError("No tenés permiso sobre este barrio")
  - Si SÍ está asignado: validar que solo se modifican campos permitidos.
    Campos permitidos para vendedor: estado, fecha_reserva, fecha_sena, fecha_venta, fecha_escritura,
    fecha_bloqueo, interesado_comprador_id, oferta, precio_oferta, destacado.
  - Si intenta modificar otros campos: throw BadRequestError("Solo podés modificar estados, no datos")
```

### Hook 3 — Actualización automática de fechas comerciales

Sobre `onRecordBeforeUpdateRequest` para `unidades`, si cambia `estado`:

- `estado` cambia a `bloqueado` y `fecha_bloqueo` es null → setear `fecha_bloqueo = ahora`.
- `estado` cambia a `reservado` y `fecha_reserva` es null → setear `fecha_reserva = ahora`.
- `estado` cambia a `sena` y `fecha_sena` es null → setear `fecha_sena = ahora`.
- `estado` cambia a `vendido` y `fecha_venta` es null → setear `fecha_venta = ahora`.
- `estado` cambia a `escriturado` y `fecha_escritura` es null → setear `fecha_escritura = ahora`.

Si el admin edita manualmente las fechas, respetar lo que ingrese (no sobreescribir).

### Hook 4 — Validación de duplicados en interesados

Sobre `onRecordBeforeCreateRequest` para `interesados`:

- Validar formato de email.
- Buscar en últimos 5 minutos: ¿existe otro interesado con mismo `email` y mismo `unidad_id`?
- Si sí: throw BadRequestError("Ya enviaste una consulta sobre esta unidad recientemente").

### Hook 5 — Cierre de interesado actualiza unidad

Sobre `onRecordBeforeUpdateRequest` para `interesados`:

- Si `estado` cambia a `cerrado_ganado` y tiene `unidad_id`:
  - Verificar que la unidad existe y no está ya en estado `vendido` o `escriturado`.
  - Actualizar la unidad: `estado = vendido`, `interesado_comprador_id = este interesado.id`, `fecha_venta = hoy`.
  - Esto se hace via `$app.dao().saveRecord()` para que dispare el resto de hooks.

### Hook 6 — Generación de token público de comparativa

Sobre `onRecordBeforeCreateRequest` para `comparativas`:

- Generar `token_publico` aleatorio de 16 chars alfanuméricos (a-z, A-Z, 0-9).
- Verificar unicidad antes de guardar (retry si colisiona, máx 5 intentos).

### Hook 7 — Singleton de config

Sobre `onRecordBeforeCreateRequest` para `config`:

- Si ya existe un registro, throw BadRequestError("Config es singleton, solo hay un registro permitido").
- Forzar `id = "global"` siempre.

---

## Migraciones JS

Crear todas las colecciones como **migraciones versionadas** en `pb_migrations/`. Una migración por colección con timestamp en el nombre:

```
pb_migrations/
├── 1700000001_create_users_extended.js
├── 1700000002_create_barrios.js
├── 1700000003_create_vendedor_barrios.js
├── 1700000004_create_arquitectos.js
├── 1700000005_create_unidades.js
├── 1700000006_create_interesados.js
├── 1700000007_create_comparativas.js
├── 1700000008_create_comparativa_vistas.js
├── 1700000009_create_importaciones.js
├── 1700000010_create_importacion_filas.js
├── 1700000011_create_audit_log.js
├── 1700000012_create_config.js
└── 1700000013_seed_initial_data.js  // admin default, config singleton
```

Cada migración debe tener su contrapartida `down` (rollback).

El seed inicial crea:
- 1 user admin con email y password de variables de entorno.
- 1 registro de `config` con id="global" apuntando al admin como `responsable_default_id`.

---

## Capa de servicios Angular (`libs/shared-pb-client`)

### Servicios a crear

Cada uno extiende `BaseCollectionService<T>` ya existente:

- `BarriosService`
- `UnidadesService`
- `InteresadosService`
- `ArquitectosService`
- `UsersService`
- `VendedorBarriosService`
- `ComparativasService`
- `ImportacionesService`
- `ImportacionFilasService`
- `ConfigService` (singleton, expone signal `current()` con la config)
- `AuditLogService` (solo lectura)

### Lógica especial en servicios

**`UnidadesService.cambiarEstado(unidadId, nuevoEstado)`:**
- Wrapper sobre update que solo manda el campo `estado`.
- Captura errores específicos del hook de permisos y los re-emite con mensaje claro.

**`InteresadosService.cerrarComoGanado(interesadoId)`:**
- Actualiza el estado a `cerrado_ganado`.
- El hook del backend se encarga de actualizar la unidad.

**`ComparativasService.crear(payload)`:**
- Genera la comparativa, recibe el `token_publico` del backend.
- Devuelve la URL pública construida: `${env.publicBaseUrl}/c/${token}`.

**`ComparativasService.generarPdf(comparativaId)`:**
- Llama a un endpoint server-side (lo definiremos como custom route en PocketBase o como server route del SSR de la landing — para esta tarea, dejar interfaz lista con TODO).

**`ImportacionesService.uploadExcel(file, tipo)`:**
- Sube archivo, crea `importaciones` con estado `analizando`.
- Llama a parser (ver abajo).
- Una vez parseado, devuelve el id de la importación para que el usuario revise.

**`ImportacionesService.confirmar(importacionId)`:**
- Toma todas las filas en `importacion_filas` con `decision_usuario != "omitir"`.
- Crea/actualiza los registros según `decision_usuario` y `datos_normalizados`.
- Marca `aplicada = true` en cada fila.
- Cambia estado de la importación a `confirmada`.
- Maneja errores parciales (algunas filas fallan, otras OK).

---

## Parser de Excel (importador)

Crear en `apps/admin/src/app/features/importador/parser/`:

- Usar librería `xlsx` o `exceljs` (preferir `exceljs`, más moderna y con mejor TS).
- Función `parseBarriosUnidades(file: File): Promise<ParsedRow[]>`.
- Soporta 2 formatos:
  - **Formato 1:** Una sola hoja con columnas `tipo` (barrio | unidad), `nombre`, `barrio_slug`, `metros`, `precio`, etc.
  - **Formato 2:** Dos hojas separadas (`Barrios`, `Unidades`).
- Por cada fila:
  - Validar campos requeridos.
  - Validar tipos (number, email, etc.).
  - Detectar duplicados contra DB (consultar PocketBase por `slug` o `codigo_interno`).
  - Asignar estado: `ok` | `duplicado` | `error` | `advertencia`.
  - Generar `datos_normalizados` listo para crear el registro.
- Crear todos los `importacion_filas` en bulk.

Endpoint API para n8n: custom route en PocketBase `POST /api/import/json` que:
- Acepta `{ tipo, filas: [...] }`.
- Mismo pipeline de validación.
- Devuelve `importacion_id` para revisión.

---

## Sistema de permisos en Angular

### AuthGuard

`apps/admin/src/app/core/guards/auth.guard.ts` — functional guard que valida que `authService.isAuthenticated()` es true. Redirige a `/login` si no.

### RoleGuard

`apps/admin/src/app/core/guards/role.guard.ts` — guard parametrizable con roles requeridos. Uso:

```typescript
canActivate: [authGuard, roleGuard(['admin'])]
```

### Directiva `*hasRole`

`libs/shared-ui/src/lib/directives/has-role.directive.ts`:

```html
<button *hasRole="['admin']">Borrar</button>
<div *hasRole="['admin', 'vendedor']">Visible para ambos</div>
```

### Signal `currentUser` y `currentRole` en `AuthService`

Disponibles en toda la app vía inyección.

---

## Componentes Angular mínimos a crear

UI **funcional pero sin diseño pulido** (eso es tarea posterior). Solo p-table de PrimeNG + formularios básicos.

### Páginas

```
apps/admin/src/app/features/
├── dashboard/
│   ├── dashboard.component.ts        # cards de métricas según role
│   └── widgets/
│       ├── unidades-por-estado.widget.ts
│       ├── ventas-periodo.widget.ts
│       ├── leads-conversion.widget.ts
│       └── ofertas-destacados.widget.ts
├── barrios/
│   ├── barrios-list.component.ts    # p-table
│   └── barrio-form.component.ts     # crear/editar
├── unidades/
│   ├── unidades-list.component.ts   # p-table con filtros por tipo, estado, barrio
│   ├── unidad-form.component.ts     # crear/editar (admin only)
│   └── unidad-detail.component.ts   # vista con cambio rápido de estado
├── interesados/
│   ├── interesados-list.component.ts
│   └── interesado-detail.component.ts
├── arquitectos/
│   ├── arquitectos-list.component.ts
│   └── arquitecto-form.component.ts
├── usuarios/
│   ├── usuarios-list.component.ts        # admin only
│   ├── usuario-form.component.ts         # admin only
│   └── asignacion-barrios.component.ts   # asignar barrios a vendedor
├── comparativas/
│   ├── comparativas-list.component.ts
│   ├── comparativa-builder.component.ts  # wizard: tipo → unidades → preview → guardar
│   └── comparativa-detail.component.ts   # ver link, copiar, regenerar PDF
└── importador/
    ├── importador-list.component.ts   # lista de importaciones previas
    ├── importador-upload.component.ts # paso 1: subir archivo
    └── importador-review.component.ts # paso 2: revisar filas con problema
```

### Funcionalidad mínima requerida por componente

- **Listados:** p-table con paginación, filtros básicos, columnas relevantes, botón "Nuevo" si aplica.
- **Forms:** validación reactiva (Reactive Forms), feedback de errores, save con disabled durante request.
- **Dashboard:** 4 widgets para admin (los 4 que pediste), 2 widgets para vendedor (mis leads, mis ventas). Selector de período mensual/trimestral/anual.
- **Comparativa builder:** wizard de 3 pasos (elegir tipo, elegir unidades vía multi-select con preview, datos del cliente y mensaje).
- **Importador:** upload con preview de filas problemáticas en tabla, decisiones por fila, botón "Confirmar importación".

---

## Tests

### Tests unitarios obligatorios

- `shared-utils/validators/*` — todos los validators.
- `shared-pb-client/base-collection.service.ts` — métodos CRUD con mock de PocketBase.
- `importador/parser/parser.spec.ts` — casos: Excel válido, duplicados, errores de tipo, columnas faltantes.

### Tests de hooks de PocketBase

Crear `pb_hooks/_tests/` con tests usando el framework de testing nativo de PocketBase (Goja JS). Casos críticos:
- Vendedor intenta modificar precio de unidad → debe fallar.
- Vendedor modifica estado de unidad en su barrio → OK.
- Cambio de estado a "vendido" actualiza `fecha_venta`.
- Interesado duplicado en 5 min → falla.
- Cierre de interesado como ganado actualiza la unidad.

---

## Reglas de implementación

- **TypeScript strict en todo.** Sin `any` salvo cases imprescindibles y documentados.
- **Signals de Angular 21**, no Observables (salvo cuando lo requiera una API externa).
- **Reactive Forms**, no Template-driven.
- **Standalone components** (Angular 21 default).
- **Path aliases del monorepo:** importar desde `@loteomanager/shared-types` etc., no rutas relativas largas.
- **Errores del backend deben llegar al frontend con mensaje claro.** El frontend muestra toasts de PrimeNG.
- **No mockear PocketBase en producción.** Los tests sí pueden, pero el código real va contra la instancia real.
- **Todas las fechas se manejan como ISO strings** en transit, `Date` en runtime cuando es necesario.
- **Monedas:** los amounts se guardan como `Number` (siempre en la unidad menor: centavos USD o centavos ARS). Display con formatter de `shared-utils`.

---

## Plan de ejecución sugerido con subagentes

### FASE 0 — Validación de entorno (vos directamente)

1. Verificar que el monorepo está scaffoldeado y compila (`nx run-many -t build`).
2. Verificar que PocketBase corre localmente (`docker compose up pocketbase` o binario).
3. Confirmar que `pocketbase-typegen` está disponible.

### FASE 1 — Backend PocketBase (2 subagentes en paralelo)

- **Subagente A:** Crear todas las migraciones JS de schema (12 colecciones + seed).
- **Subagente B:** Crear todos los hooks de `pb_hooks/main.pb.js` con tests.

Después de Fase 1: levantar PocketBase localmente, correr migraciones, verificar que el admin UI de PocketBase muestra todas las colecciones correctamente. Correr `npm run pb:types` para generar tipos.

### FASE 2 — Servicios Angular (3 subagentes en paralelo)

- **Subagente C:** Servicios CRUD básicos (Barrios, Unidades, Arquitectos, Users, Config, AuditLog).
- **Subagente D:** Servicios con lógica especial (Interesados, Comparativas).
- **Subagente E:** Sistema de permisos (AuthService, AuthGuard, RoleGuard, hasRole directive) + Importador (parser Excel + service).

### FASE 3 — Componentes UI mínimos (4 subagentes en paralelo)

- **Subagente F:** Dashboard + widgets.
- **Subagente G:** CRUDs simples (Barrios, Unidades, Arquitectos, Usuarios).
- **Subagente H:** Interesados + Comparativas.
- **Subagente I:** Importador (upload + review).

### FASE 4 — Verificación integral (vos directamente)

1. Correr `nx run-many -t lint`.
2. Correr `nx run-many -t test`.
3. Correr `nx run-many -t build`.
4. Levantar admin + PocketBase, hacer smoke test manual:
   - Login como admin.
   - Crear barrio, crear unidad, crear interesado.
   - Cambiar estado de unidad → verificar fecha automática.
   - Crear comparativa → verificar token generado.
   - Crear vendedor + asignarle barrio.
   - Login como vendedor → verificar permisos restringidos.
   - Importar Excel pequeño de prueba → revisar flujo de 2 pasos.

### Entregable final

- Backend funcional con schema, hooks y migraciones.
- Servicios Angular completos con tests.
- UI mínima funcional para validar todos los flujos.
- README en `docs/admin-logic.md` con:
  - Cómo correr migraciones.
  - Cómo regenerar tipos.
  - Cómo testear permisos manualmente.
  - Puntos pendientes para la etapa de UI pulida.

---

## Coordinación entre subagentes

- Los subagentes no se comunican entre sí. Vos sos el único punto de coordinación.
- **Antes de delegar cada fase**, mostrame qué vas a delegar y a qué subagentes.
- **Después de cada fase**, mostrame el reporte consolidado.
- Si dos subagentes producirían conflictos de archivos, serializalos.
- Si un subagente encuentra un blocker técnico (ej: PocketBase v0.23 cambió la API de hooks), debe reportarlo claramente, NO improvisar.

## Preguntas que el agente principal debe hacerme antes de empezar

Si al leer este prompt tenés dudas sobre algún punto específico, hacé las preguntas ANTES de empezar la Fase 0. No improvises sobre puntos ambiguos.

¿Listo para arrancar la Fase 0?

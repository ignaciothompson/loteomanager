# Tarea: Sistema de campos custom (extras) y estados configurables — LoteoManager

Sos el agente principal encargado de **extender el sistema** con un módulo de configuración dinámica que permite al admin definir extras (campos custom) y estados sin tocar código. El sistema base ya está funcionando: monorepo Nx + Angular 21 + Sakai-NG + PocketBase con CRUDs de barrios, unidades, interesados y comparativas operativos.

## Contexto del estado actual

- **Repo:** loteomanager (Nx monorepo).
- **Apps funcionando:** `apps/admin` con login, dashboard, CRUDs básicos. `apps/landing` con home y comparativa pública.
- **Backend:** PocketBase v0.23 con migraciones JS versionadas, hooks operativos (auditoría, fechas comerciales, permisos por campo, validación de duplicados).
- **Convención del repo:** todo bajo `apps/admin/src/app/features/` (recientemente unificado, antes había mezcla con `pages/`).
- **Cambio reciente:** `barrios` ya tiene un campo `extras` como JSON genérico (sin estructura ni ABM). Este sistema lo reemplaza con uno propiamente diseñado.

## Alcance de esta tarea

### Incluye

1. Backend de **definiciones de extras** y **estados custom** (migraciones, hooks).
2. ABM de extras por entidad (barrios, unidades, interesados).
3. ABM de estados custom (con distinción core vs custom).
4. **Refactor** del campo `extras` en `barrios`, `unidades` e `interesados` al nuevo formato híbrido con nombre denormalizado.
5. Componentes Angular reutilizables para renderizar y editar extras dinámicamente según su tipo.
6. **Cache de definiciones** en frontend (signal global, se carga 1 vez al login).
7. Hook de sincronización: si el admin renombra un extra, se actualizan los registros que lo usan.
8. Hook de protección al borrar estados en uso (forzar reemplazo).
9. Snapshot histórico en comparativas (capturar valores actuales al momento de generar).
10. Migración de datos existentes (si hay datos en `extras` viejo, preservarlos).
11. Tests para los hooks críticos.

### NO incluye

- Filtros avanzados por extras en listados (puede venir después).
- Visualización de extras en landing pública (los flags `visible_en_landing` se persisten pero el render en landing es tarea posterior).
- Cambios en la lógica de fechas comerciales (sigue funcionando solo sobre estados core).

---

## Modelo de datos nuevo

### Colección: `extras_definiciones`

```
- id (autogen)
- code (Text, unique, required, slug formato snake_case)  
    // ej: "piscina_barrio", "tiene_cochera_techada"
    // INMUTABLE una vez creado, es el identificador estable
- entidad (Select: barrios | unidades | interesados, required)
- nombre (Text, required)  
    // ej: "Piscina del barrio", "Tiene cochera techada"
    // editable, se denormaliza en los registros
- descripcion (Text, nullable)  // ayuda para el admin
- tipo (Select: texto | numero | opciones | booleano | fecha, required)
- opciones (JSON, nullable)  
    // solo si tipo = "opciones", array de strings
    // ej: ["Incluida", "Socios", "No tiene"]
- requerido (Bool, default false)
- visible_en_lista (Bool, default false)
- visible_en_landing (Bool, default false)
- visible_en_comparativa (Bool, default false)
- orden_display (Number, default 0)
- grupo (Text, nullable)  // ej: "Amenities", "Datos técnicos" - para agrupar en form
- activo (Bool, default true)  // soft delete
- created / updated (autogen)

INDEX (entidad, activo, orden_display)
UNIQUE (entidad, code)
```

### Colección: `estados_definiciones`

```
- id (autogen)
- code (Text, unique, required, slug snake_case)
    // INMUTABLE, identificador estable
    // Los estados CORE tienen codes reservados: disponible, bloqueado, reservado, 
    // sena, vendido, escriturado (unidades), nuevo, contactado, reunion, oferta, 
    // cerrado_ganado, cerrado_perdido (interesados)
- entidad (Select: unidades | interesados, required)
- nombre (Text, required)  // label visible, editable incluso en core
- color (Text, default "#6366f1")  // hex color para badge
- icono (Text, nullable)  // nombre de icono PrimeIcons opcional
- es_core (Bool, default false)  // true = no se puede borrar, code inmutable
- orden_display (Number, default 0)
- activo (Bool, default true)
- created / updated (autogen)

INDEX (entidad, activo, orden_display)
UNIQUE (entidad, code)
```

### Modificación a `barrios`, `unidades`, `interesados`

Reemplazar el campo `extras` actual (JSON libre o `estado` viejo en unidades) por:

```
extras (JSON, default [])
  // Array de objetos:
  // [
  //   {
  //     extra_id: "abc123",        // FK lógica a extras_definiciones.id
  //     code: "piscina_barrio",     // code denormalizado, fallback y queries
  //     nombre: "Piscina del barrio", // nombre denormalizado, sincronizado por hook
  //     valor: "Incluida"           // el valor real
  //   }
  // ]
```

**Nota:** en `unidades` el campo `estado` actual (Select fijo con codes) se mantiene como Text para que pueda referenciar tanto estados core como custom. El validador a nivel de hook verifica que el code exista en `estados_definiciones` y esté activo.

Lo mismo para `interesados.estado`.

### Modificación a `comparativas`

Agregar campo:

```
- contenido_snapshot (JSON, nullable)
  // Se genera al crear la comparativa
  // Captura los datos de las unidades + sus extras en el momento exacto
  // Estructura:
  // {
  //   generated_at: "2026-05-15T10:30:00Z",
  //   unidades: [
  //     {
  //       id, codigo_interno, tipo_unidad, precio, moneda, m2, 
  //       barrio_nombre, barrio_lat, barrio_lng,
  //       galeria_urls: [...],
  //       extras_visible: [
  //         { nombre: "Piscina", valor: "Incluida" }, ...
  //       ]
  //     }, ...
  //   ]
  // }
```

El PDF y la landing pública renderizan **desde el snapshot**, no consultando las unidades en vivo. Esto garantiza que la comparativa enviada a un cliente en marzo muestre los precios y datos de marzo aunque después cambien.

---

## API Rules nuevas

```
extras_definiciones:
  List/View:    @request.auth.id != ""
  Create:       @request.auth.role = "admin"
  Update:       @request.auth.role = "admin"
  Delete:       @request.auth.role = "admin"  // hook valida si está en uso

estados_definiciones:
  List/View:    @request.auth.id != ""
  Create:       @request.auth.role = "admin"
  Update:       @request.auth.role = "admin"  // hook protege es_core
  Delete:       @request.auth.role = "admin"  // hook bloquea core, valida uso de custom
```

---

## Hooks de PocketBase nuevos

### Hook 1 — Sincronización de nombre denormalizado

Sobre `onRecordAfterUpdateSuccess` para `extras_definiciones`:

```
Si cambió el campo "nombre" comparado con before:
  Para cada entidad (barrios, unidades, interesados):
    Buscar registros donde extras contenga este extra_id (filtro JSON).
    Para cada uno: actualizar el campo "nombre" dentro del array extras.
    Guardar el registro (silenciosamente, sin disparar audit log para no spamear).
```

**Implementación:** usar `$app.dao().findRecordsByFilter()` con filter de PocketBase JSON. Si el filtro JSON nativo no alcanza, hacer query manual con SQL crudo via `$app.db()`.

**Performance:** si hay más de 500 registros afectados, ejecutar en batches de 100. Loguear progreso.

### Hook 2 — Protección al borrar definición de extra

Sobre `onRecordBeforeDeleteRequest` para `extras_definiciones`:

```
Contar cuántos registros usan este extra (en barrios, unidades, interesados).
Si count > 0:
  throw BadRequestError(
    "No se puede borrar este extra porque está en uso en N registros. 
     Marcalo como inactivo (campo 'activo' = false) si querés ocultarlo."
  )
```

**Soft delete preferido:** sugerir al admin marcar `activo = false` en lugar de borrar. Los extras inactivos no aparecen en formularios de creación pero sí en registros que ya los tenían.

### Hook 3 — Protección de estados core

Sobre `onRecordBeforeUpdateRequest` para `estados_definiciones`:

```
Si es_core = true:
  El campo "code" NO puede cambiar (revertir si vino diferente).
  El campo "es_core" NO puede cambiar.
  Los demás campos (nombre, color, icono, orden_display, activo) sí.

Si es_core = false (custom):
  Cualquier campo se puede modificar.
```

Sobre `onRecordBeforeDeleteRequest` para `estados_definiciones`:

```
Si es_core = true:
  throw BadRequestError("No se pueden borrar estados del sistema.")

Si es_core = false:
  Contar registros con estado = este.code en la entidad correspondiente.
  Si count > 0:
    throw BadRequestError(
      "Hay N registros usando este estado. 
       Usá el endpoint /api/admin/estados/replace-and-delete para reasignar primero."
    )
```

### Hook 4 — Endpoint custom para reemplazo de estado + delete

Route HTTP custom en `pb_hooks/main.pb.js`:

```
POST /api/admin/estados/replace-and-delete
Body: { estado_id_a_borrar, estado_id_reemplazo }

Validaciones:
  - Solo admin.
  - Ambos estados existen y son de la misma entidad.
  - El estado a borrar NO es core.

Lógica:
  - Actualizar todos los registros con estado = code_viejo → estado = code_nuevo.
  - Borrar el estado viejo.
  - Devolver { registros_actualizados: N }.

Esto va en una sola transacción si PocketBase lo soporta, sino con rollback manual en caso de error.
```

### Hook 5 — Validación de valores en extras al guardar

Sobre `onRecordBeforeCreateRequest` y `onRecordBeforeUpdateRequest` para `barrios`, `unidades`, `interesados`:

```
Si viene el campo "extras":
  Para cada item en el array:
    1. Verificar que extra_id existe en extras_definiciones.
    2. Verificar que la definición está activa (activo=true).
    3. Validar el valor según el tipo:
       - texto: debe ser string.
       - numero: debe ser parseable a number.
       - booleano: debe ser true/false.
       - fecha: debe ser ISO date string parseable.
       - opciones: debe estar incluido en el array "opciones" de la definición.
    4. Si la definición tiene requerido=true, el valor NO puede estar vacío.
    5. Repoblar code y nombre desde la definición (no confiar en lo que mandó el cliente).
  
  Si algún item falla validación:
    throw BadRequestError(`Extra '${nombre}' inválido: ${motivo}`)

Adicionalmente:
  Para extras requeridos de esta entidad que NO vienen en el array:
    throw BadRequestError(`Falta el extra requerido: ${nombre}`)
```

### Hook 6 — Validación de estado al guardar

Sobre `onRecordBeforeCreateRequest` y `onRecordBeforeUpdateRequest` para `unidades` e `interesados`:

```
Si viene el campo "estado":
  Verificar que el code existe en estados_definiciones para esta entidad.
  Verificar que está activo.
  Si no: throw BadRequestError(`Estado '${estado}' no existe o está inactivo.`)
```

### Hook 7 — Snapshot al crear comparativa

Sobre `onRecordBeforeCreateRequest` para `comparativas`:

```
Antes de guardar, generar contenido_snapshot:
  Para cada unidad_id en unidades_ids:
    - Cargar la unidad.
    - Cargar el barrio si tiene barrio_id.
    - Filtrar extras donde la definición tiene visible_en_comparativa=true.
    - Construir el objeto del snapshot.
  Guardar el JSON completo en contenido_snapshot.
```

---

## Seed de estados core

En la migración de creación de `estados_definiciones`, hacer seed de los estados core:

**Unidades:**
- `disponible` — verde — orden 1
- `bloqueado` — gris — orden 2
- `reservado` — amarillo — orden 3
- `sena` — naranja — orden 4
- `vendido` — rojo — orden 5
- `escriturado` — púrpura — orden 6

**Interesados:**
- `nuevo` — azul — orden 1
- `contactado` — celeste — orden 2
- `reunion` — violeta — orden 3
- `oferta` — naranja — orden 4
- `cerrado_ganado` — verde — orden 5
- `cerrado_perdido` — gris — orden 6

Todos con `es_core = true`.

---

## Migración de datos existentes

Crear migración `1700000020_migrate_old_extras_format.js`:

```
Leer todos los registros de barrios donde extras no esté vacío.
Si extras tiene el formato viejo (objeto JSON sin estructura específica):
  Loguear y dejarlos como están (no se pueden migrar automáticamente sin info).
  Generar un archivo /tmp/pb_extras_migration_report.json con la lista de IDs afectados.

Para los registros recién creados con el nuevo sistema, no hacer nada.
```

Esto NO migra automáticamente datos legados — solo los identifica. La migración real la hace el admin manualmente desde la UI nueva o se descarta si son datos de prueba.

---

## Capa de servicios Angular nuevos

### `ExtrasDefinicionesService`

Extiende `BaseCollectionService<ExtraDefinicion>`. Métodos especiales:

- `listByEntidad(entidad: 'barrios' | 'unidades' | 'interesados'): Signal<ExtraDefinicion[]>`
  Filtra `entidad = X AND activo = true ORDER BY orden_display`.
- `getRequeridos(entidad): Signal<ExtraDefinicion[]>`
  Para validación de forms al crear entidad.

### `EstadosDefinicionesService`

Extiende `BaseCollectionService<EstadoDefinicion>`. Métodos:

- `listByEntidad(entidad): Signal<EstadoDefinicion[]>`.
- `replaceAndDelete(idABorrar, idReemplazo): Promise<{registros_actualizados: number}>`
  Llama al endpoint custom de PocketBase.

### `DefinicionesCacheService` (global)

Servicio singleton que carga TODAS las definiciones (extras + estados) al login y las mantiene en memoria.

```typescript
@Injectable({ providedIn: 'root' })
export class DefinicionesCacheService {
  readonly extras = signal<ExtraDefinicion[]>([]);
  readonly estados = signal<EstadoDefinicion[]>([]);
  
  readonly extrasByEntidad = computed(() => {
    const byEntidad = new Map<Entidad, ExtraDefinicion[]>();
    for (const e of this.extras()) {
      if (!byEntidad.has(e.entidad)) byEntidad.set(e.entidad, []);
      byEntidad.get(e.entidad)!.push(e);
    }
    return byEntidad;
  });
  
  readonly estadosByEntidad = computed(() => { /* similar */ });
  
  async load(): Promise<void> {
    // Cargar ambas colecciones en paralelo
  }
  
  async refresh(): Promise<void> {
    // Recargar después de cambios en ABMs
  }
}
```

**Inyectar en `AppComponent`** y llamar a `load()` después del login exitoso.

**Refrescar automáticamente** después de crear/editar/eliminar en los ABMs.

---

## Componentes Angular nuevos

### ABM de extras: `features/admin/extras/`

- `extras-list.component.ts` — p-table con filtro por entidad, columnas: nombre, tipo, requerido, activo. Acciones: editar, activar/desactivar.
- `extra-form.component.ts` — form para crear/editar:
  - Entidad (select).
  - Code (text, **disabled en edición**).
  - Nombre, descripción.
  - Tipo (select). Si tipo = "opciones", aparece editor de opciones (chips o input dinámico).
  - Flags: requerido, visible_en_lista, visible_en_landing, visible_en_comparativa.
  - Grupo, orden_display.
- Al guardar, refrescar el cache global.

### ABM de estados: `features/admin/estados/`

- `estados-list.component.ts` — p-table agrupada por entidad. Badge con color de cada estado. Indicador visual de core vs custom.
- `estado-form.component.ts`:
  - Si es core: solo permite editar nombre, color, icono, orden_display, activo.
  - Si es custom: todos los campos editables.
- `estado-delete-dialog.component.ts` — modal que aparece si el estado está en uso, fuerza al admin a elegir un estado de reemplazo. Llama al endpoint custom `/api/admin/estados/replace-and-delete`.

### Componente dinámico: `ExtraValueEditorComponent`

Componente reutilizable que recibe `definicion: ExtraDefinicion` y `valor` (con two-way binding via model). Renderiza el control adecuado según el tipo:

- `texto` → `<input pInputText>`
- `numero` → `<p-inputNumber>`
- `opciones` → `<p-select>` con `definicion.opciones`
- `booleano` → `<p-toggleSwitch>`
- `fecha` → `<p-datepicker>`

Validación visual (asterisco rojo si `requerido`, error si vacío y requerido).

### Componente: `ExtrasEditorComponent`

Wrapper que toma `entidad: 'barrios' | 'unidades' | 'interesados'` y `extras: Signal<ExtraValue[]>`. 

- Consulta `definicionesCache.extrasByEntidad()[entidad]`.
- Renderiza un `ExtraValueEditorComponent` por cada definición activa.
- Agrupa por `grupo` si el campo viene.
- Maneja el merge bidireccional: lo que existe en `extras` muestra valor, lo que no existe queda vacío.
- Al guardar la entidad padre, serializa el array completo respetando el formato `{extra_id, code, nombre, valor}`.

### Componente: `EstadoBadgeComponent`

Recibe `code: string` y `entidad: 'unidades' | 'interesados'`. Consulta el cache, renderiza badge con color, nombre, icono opcional. Si el estado no existe en el cache, fallback a badge gris con el code crudo.

### Integración en CRUDs existentes

**Refactorear:**
- `features/barrios/barrio-form.component.ts` — reemplazar editor JSON libre por `<app-extras-editor entidad="barrios" [(extras)]="form.extras">`.
- `features/unidades/unidad-form.component.ts` — agregar `ExtrasEditorComponent`. Reemplazar selector de estado por uno alimentado del cache.
- `features/interesados/interesado-form.component.ts` — agregar ambos.
- Todos los listados que muestran estado → usar `EstadoBadgeComponent`.

---

## Estructura de archivos final

```
apps/admin/src/app/features/
├── admin/                                # NUEVO — sección de configuración del sistema
│   ├── extras/
│   │   ├── extras-list.component.ts
│   │   ├── extra-form.component.ts
│   │   └── extras.routes.ts
│   └── estados/
│       ├── estados-list.component.ts
│       ├── estado-form.component.ts
│       ├── estado-delete-dialog.component.ts
│       └── estados.routes.ts
├── barrios/ (refactor)
├── unidades/ (refactor)
├── interesados/ (refactor)
└── ...

libs/shared-ui/src/lib/
├── extra-value-editor/
│   └── extra-value-editor.component.ts   # NUEVO
├── extras-editor/
│   └── extras-editor.component.ts        # NUEVO
└── estado-badge/
    └── estado-badge.component.ts         # NUEVO

libs/shared-pb-client/src/lib/
├── services/
│   ├── extras-definiciones.service.ts    # NUEVO
│   ├── estados-definiciones.service.ts   # NUEVO
│   └── definiciones-cache.service.ts     # NUEVO
└── ...

apps/admin/src/app/layout/component/app.menu.ts
  → agregar item "Configuración" con submenús "Extras" y "Estados" (solo visible si role = admin)
```

---

## Plan de ejecución con subagentes

### FASE 0 — Preparación (vos directamente)

1. Verificar que el commit base está limpio (`git status`).
2. Crear branch `feat/extras-y-estados-configurables`.
3. Backup de `pb_data/` actual por si algo sale mal en la migración.

### FASE 1 — Backend (2 subagentes en paralelo)

**Subagente A: Migraciones**
- Crear migración para `extras_definiciones` (schema + API rules).
- Crear migración para `estados_definiciones` (schema + API rules + seed de estados core).
- Crear migración para agregar `contenido_snapshot` a `comparativas`.
- Crear migración de identificación de datos legados.

**Subagente B: Hooks**
- Implementar todos los hooks (1 a 7).
- Implementar endpoint custom `/api/admin/estados/replace-and-delete`.
- Escribir tests en `pb_hooks/_tests/` para hooks críticos: sincronización de nombre, validación de valores, protección de core, replace-and-delete.

**Verificación después de Fase 1:** levantar PocketBase, correr migraciones, verificar admin UI de PocketBase muestra colecciones nuevas, ejecutar tests de hooks.

### FASE 2 — Servicios + Cache (1 subagente)

**Subagente C:**
- `ExtrasDefinicionesService`, `EstadosDefinicionesService`.
- `DefinicionesCacheService` con la lógica de carga y refresco.
- Integrar carga en `AuthService` después de login exitoso.
- Regenerar tipos con `pocketbase-typegen` (`npm run pb:types`).

### FASE 3 — Componentes reutilizables (2 subagentes en paralelo)

**Subagente D: Componentes atómicos**
- `ExtraValueEditorComponent` (renderiza según tipo).
- `EstadoBadgeComponent`.
- Tests unitarios de cada uno.

**Subagente E: Componente compuesto**
- `ExtrasEditorComponent` (wrapper que usa el cache + ExtraValueEditor).
- Tests del flujo completo.

### FASE 4 — ABMs nuevos (1 subagente)

**Subagente F:**
- ABM de extras (list + form).
- ABM de estados (list + form + dialog de borrado con reemplazo).
- Agregar rutas y entrada en menú lateral (solo admin).

### FASE 5 — Refactor de CRUDs existentes (1 subagente)

**Subagente G:**
- Refactor `barrio-form` para usar `ExtrasEditorComponent`.
- Refactor `unidad-form` para usar `ExtrasEditorComponent` + selector dinámico de estado.
- Refactor `interesado-form` idem.
- Reemplazar badges de estado hardcoded por `EstadoBadgeComponent` en todos los listados.

### FASE 6 — Verificación integral (vos directamente)

Smoke tests manuales:

1. Login como admin.
2. Crear extra de tipo "opciones" para barrios (ej: "Piscina" con valores "Incluida/Socios/No tiene").
3. Crear barrio nuevo y asignarle el valor "Incluida" en el extra Piscina.
4. Editar el extra: renombrar "Piscina" → "Pileta". Verificar que el barrio muestra "Pileta".
5. Marcar el extra como inactivo. Verificar que en crear barrio nuevo no aparece.
6. Crear estado custom para unidades (ej: "En negociación", color naranja).
7. Asignar el estado nuevo a una unidad.
8. Intentar borrar el estado custom desde el ABM. Verificar que aparece dialog pidiendo reemplazo.
9. Confirmar reemplazo. Verificar que la unidad pasó al nuevo estado.
10. Intentar borrar un estado core. Verificar que está bloqueado.
11. Generar una comparativa con unidades. Verificar que `contenido_snapshot` se generó correctamente.
12. Cambiar precio de una unidad después de generar la comparativa. Verificar que la comparativa muestra el precio viejo (snapshot).

---

## Reglas de implementación

- TypeScript strict en todo.
- Angular Signals para reactividad del cache (no Observables salvo HTTP).
- **No usar `any`**, especialmente en los valores polimórficos de extras. Definir uniones de tipos:
  ```typescript
  type ExtraValor = string | number | boolean | null;  // fecha = ISO string
  ```
- Validación de tipos de extras DEBE estar tanto en frontend (UX) como en backend (seguridad).
- Los `code` son inmutables y siempre en snake_case. Validar con regex `/^[a-z][a-z0-9_]*$/`.
- Auto-generar `code` desde el `nombre` con la utility `slugify` ya existente, pero permitir override manual.
- Los componentes nuevos van en `libs/shared-ui` si son reutilizables, en `apps/admin/.../features/` si son específicos del admin.
- **Documentar en `docs/configuracion-dinamica.md`** el modelo completo, ejemplos de uso y limitaciones conocidas.

---

## Coordinación entre subagentes

- Antes de cada fase, mostrame el plan de delegación.
- Después de cada fase, mostrame el reporte consolidado.
- Si un subagente encuentra un blocker técnico (especialmente con filtros JSON de PocketBase v0.23), reportarlo, NO improvisar.
- **Cuidado con el Subagente A y B en paralelo:** ambos tocan `pb_migrations/` y `pb_hooks/`. Que A trabaje solo en `pb_migrations/` y B solo en `pb_hooks/`, sin tocarse.
- En Fase 3, los subagentes D y E pueden trabajar en paralelo porque D crea los atómicos que E luego importa, pero ambos pueden definir sus interfaces TS primero y trabajar contra esas interfaces.

## Preguntas previas

Si al leer este prompt tenés dudas sobre algún punto específico, hacelas antes de empezar la Fase 0. Especialmente:
- ¿La API de filtros JSON de PocketBase v0.23 soporta lo que necesitamos para el Hook 1 (buscar registros donde extras contenga cierto extra_id)?
- ¿Las rutas HTTP custom en `pb_hooks` funcionan como se asume?

Si alguna respuesta es no, proponé alternativas antes de implementar.

¿Listo para arrancar la Fase 0?

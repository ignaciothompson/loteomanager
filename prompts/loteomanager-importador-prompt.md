# Tarea: Importador de barrios y unidades desde Excel — LoteoManager

Sos el agente principal encargado de implementar el **módulo Importador** del sistema. El sistema base ya está funcionando con CRUDs, sistema de extras configurables, estados, permisos y usuarios.

## Contexto del estado actual

- **Stack:** Angular 21 + PrimeNG 21 + Sakai-NG + PocketBase v0.23.
- **Convención del repo:** todo bajo `apps/admin/src/app/features/`.
- **Lo que ya existe:**
  - Tablas en PocketBase: `importaciones`, `importacion_filas` (creadas en migraciones previas).
  - Carpeta vacía o con código mínimo en `apps/admin/src/app/features/importador/`.
  - Sistema de extras configurables con `extras_definiciones` (cada extra tiene `entidad`, `code`, `nombre`, `tipo`, `opciones`, etc.).
  - `DefinicionesCacheService` con los extras en memoria.
- **Permisos:** solo admin tiene `importador.use` por ahora.

## Alcance de esta tarea

### Incluye

1. Revisar tablas `importaciones` e `importacion_filas` existentes; ajustar schema si falta algo.
2. **Plantilla Excel descargable** generada dinámicamente con columnas según los extras activos.
3. **Parser de Excel** (subida + parseo + validación) con flujo de 2 pasos:
   - Paso 1: análisis y staging de filas con estados (`ok`, `duplicado`, `error`, `advertencia`).
   - Paso 2: revisión con UI para decidir caso por caso, mapeo manual de columnas no reconocidas, mapeo manual de extras no matcheados, y commit final.
4. **UI completa del importador:**
   - Listado de importaciones previas.
   - Pantalla de upload + análisis.
   - Pantalla de revisión con tablas filtrables por estado.
   - Pantalla de mapeo manual de columnas no reconocidas.
   - Pantalla de mapeo manual de extras no matcheados.
   - Pantalla de confirmación con resumen final.
5. **Commit de la importación:** crear/actualizar registros reales en `barrios` y `unidades` según las decisiones del usuario.
6. **Logs y trazabilidad:** auditar cada importación en `audit_log`.
7. Tests del parser (casos: válido, duplicados, errores de tipo, columnas faltantes, extras no matcheados).

### NO incluye

- API endpoint para n8n (queda para fase posterior, pero estructurar el código para que sea fácil agregar después).
- Importación de interesados o arquitectos (queda para etapas siguientes).
- Importación masiva de imágenes (la galería de unidades se carga por separado).
- Rollback de importaciones ya confirmadas (queda para etapa siguiente si se necesita).

---

## Modelo de datos

### Revisar/ajustar tabla `importaciones`

Schema esperado (verificar y ajustar si falta algún campo):

```
- id (autogen)
- tipo (Select: barrios | unidades | barrios_y_unidades, required)
- origen (Select: excel | api, default excel)
- estado (Select: analizando | listo_para_confirmar | confirmada | descartada | con_errores, default analizando)
- archivo_origen (File, single, .xlsx | .xls, nullable)
- nombre_archivo (Text, nullable)
- total_filas (Number, default 0)
- filas_ok (Number, default 0)
- filas_duplicado (Number, default 0)
- filas_error (Number, default 0)
- filas_advertencia (Number, default 0)
- mapeo_columnas (JSON, nullable)
  // Para guardar el mapeo manual del admin cuando hay columnas no reconocidas
  // Estructura: { "columna_excel": "campo_destino", ... }
- mapeo_extras (JSON, nullable)
  // Para guardar el mapeo manual de extras no matcheados
  // Estructura: { "Extra: Texto Excel": "extra_id_definicion", ... }
- creado_por (Relation → users, required)
- confirmada_en (Date, nullable)
- created / updated
```

### Revisar/ajustar tabla `importacion_filas`

```
- id (autogen)
- importacion_id (Relation → importaciones, required)
- numero_fila (Number, required)
- tipo_fila (Select: barrio | unidad, required)
  // Determinado por la columna 'tipo' del Excel
- datos_originales (JSON)
  // Raw row data del Excel: { "tipo": "unidad", "codigo_interno": "L-042", ... }
- datos_normalizados (JSON)
  // Listo para crear el registro en PocketBase
  // Para unidades incluye 'extras' como array de {extra_id, code, nombre, valor}
- estado_fila (Select: ok | duplicado | error | advertencia, required)
- mensajes (JSON, default [])
  // Array de strings con problemas detectados (puede haber múltiples por fila)
- registro_existente_id (Text, nullable)
  // ID del registro duplicado encontrado
- decision_usuario (Select: pendiente | omitir | crear | actualizar, default pendiente)
- aplicada (Bool, default false)
- registro_creado_id (Text, nullable)
  // ID del registro creado al hacer commit, para trazabilidad
- error_aplicacion (Text, nullable)
- created / updated
```

Crear migración nueva si falta algún campo: `pb_migrations/1700000070_extend_importacion_tables.js`.

### API Rules

```
importaciones, importacion_filas:
  List/View:    @request.auth.role = "admin" || creado_por = @request.auth.id
  Create:       @request.auth.id != ""
  Update:       @request.auth.id != "" && creado_por = @request.auth.id
  Delete:       @request.auth.role = "admin"
```

---

## Formato del Excel

### Columnas obligatorias

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `tipo` | texto | sí | Valor: `barrio` o `unidad`. Otros valores → error. |
| `codigo_interno` | texto | sí | Identificador único. En barrios es el código del barrio. En unidades es el código de la unidad. |

### Columnas para filas tipo `barrio`

| Columna | Tipo | Obligatoria | Notas |
|---|---|---|---|
| `nombre` | texto | sí | Nombre legible del barrio |
| `slug` | texto | no | Si no viene, se genera del nombre |
| `descripcion` | texto | no | |
| `ubicacion_texto` | texto | no | |
| `lat` | número | no | |
| `lng` | número | no | |
| `zona` | texto | no | Zona para asignación de vendedores |
| `Extra: <nombre>` | varía | no | Una columna por cada extra que se quiera setear |

### Columnas para filas tipo `unidad`

| Columna | Tipo | Obligatoria | Notas |
|---|---|---|---|
| `barrio_codigo_interno` | texto | no | Código del barrio al que pertenece. Si vacío, unidad independiente. |
| `tipo_unidad` | texto | sí | Valor: `lote`, `casa`, `departamento` |
| `numero_unidad` | texto | no | |
| `direccion_propia` | texto | condicional | Required si `barrio_codigo_interno` está vacío |
| `metros_cuadrados` | número | sí | |
| `metros_construidos` | número | no | Solo aplica a casa/departamento |
| `ambientes` | número | no | Solo aplica a casa/departamento |
| `antiguedad_anios` | número | no | |
| `cocheras` | número | no | Default 0 |
| `precio` | número | sí | |
| `moneda` | texto | no | `USD` o `ARS`. Default `USD` |
| `estado` | texto | no | Code del estado (ej: `disponible`). Default `disponible`. Debe existir en `estados_definiciones`. |
| `oferta` | booleano | no | `si`/`no`/`true`/`false`/`1`/`0` |
| `precio_oferta` | número | no | |
| `destacado` | booleano | no | |
| `responsable_email` | texto | no | Email del vendedor responsable. Se matchea contra users. Si vacío, queda sin asignar. |
| `descripcion` | texto | no | |
| `Extra: <nombre>` | varía | no | Una columna por cada extra de unidades |

---

## Plantilla descargable

### Endpoint para generar plantilla

Crear ruta server-side (puede ser un servicio Angular que arme el archivo directamente, no requiere endpoint backend, lo arma en memoria con `xlsx`).

### Comportamiento

- Botón "Descargar plantilla Excel" en la pantalla principal del importador.
- Al hacer click, genera y descarga un xlsx con:
  - **Hoja 1: "Datos"** con las columnas obligatorias + todas las columnas dinámicas de extras activos.
  - **Hoja 2: "Instrucciones"** con texto explicativo de cada columna, formato esperado, ejemplos.
  - **Fila 2 de "Datos":** una fila de ejemplo con un barrio.
  - **Fila 3 de "Datos":** una fila de ejemplo con una unidad.
- Las columnas de extras se generan dinámicamente: una columna por cada extra activo (de `extras_definiciones` donde `activo=true` y entidad sea `barrios` o `unidades`).

### Librería

Usar **`exceljs`** (no `xlsx` plano, está deprecated y tiene security issues). Instalar:

```bash
npm install exceljs
```

Ventajas de exceljs:
- TypeScript first-class.
- Mantenimiento activo.
- Soporta estilos, dropdowns, validaciones en celdas.

### Bonus: validaciones en la plantilla

Agregar a las celdas:
- Columna `tipo`: dropdown con opciones `barrio` y `unidad`.
- Columna `tipo_unidad`: dropdown con `lote`, `casa`, `departamento`.
- Columna `estado`: dropdown con los codes de `estados_definiciones` para `unidades`.
- Columna `moneda`: dropdown con `USD`, `ARS`.
- Columnas booleanas: dropdown con `si`, `no`.
- Columnas de extras tipo `opciones`: dropdown con las opciones de la definición.

Esto previene errores antes de subir.

---

## Parser: lógica de validación

### Paso 1: análisis y staging

Cuando el admin sube el Excel:

1. Crear registro en `importaciones` con `estado='analizando'`.
2. Leer el archivo con exceljs.
3. Detectar encabezados de la primera hoja (asumir hoja "Datos" o la primera).
4. **Validar columnas obligatorias:** si falta `tipo` o `codigo_interno`, abortar con error global.
5. **Detectar columnas no reconocidas:** si hay columnas que no matchean el formato conocido ni el patrón `Extra: <algo>`, guardarlas en `mapeo_columnas` con valor `null` y marcar la importación como "necesita mapeo manual de columnas".
6. **Detectar columnas de extras (`Extra: <nombre>`):**
   - Intentar match automático contra `extras_definiciones.nombre` (case-insensitive, normalizado sin acentos).
   - Si hay match único → guardarlo en `mapeo_extras` con el `extra_id`.
   - Si no hay match o hay ambigüedad → guardarlo en `mapeo_extras` con valor `null` y marcar como "necesita mapeo manual de extras".
7. **Procesar filas en dos pasadas:**

#### Pasada 1: filas tipo `barrio`

Por cada fila con `tipo = barrio`:
- Validar campos obligatorios (`codigo_interno`, `nombre`).
- Verificar si ya existe un barrio con ese `codigo_interno` (o `slug` si se generó):
  - Si existe → `estado_fila = duplicado`, guardar `registro_existente_id`.
  - Si no existe → `estado_fila = ok`.
- Validar tipos de datos en cada campo.
- Construir `datos_normalizados` con la estructura final para crear el barrio.
- Procesar extras: por cada columna `Extra: X`, si el extra está mapeado (`mapeo_extras` tiene el id), validar el valor contra el tipo del extra y agregarlo al array `extras` del barrio. Si no está mapeado, marcar advertencia "Extras pendientes de mapeo".
- Guardar en `importacion_filas`.

#### Pasada 2: filas tipo `unidad`

Por cada fila con `tipo = unidad`:
- Validar campos obligatorios.
- Si tiene `barrio_codigo_interno`:
  - Buscar el barrio:
    - Primero en `barrios` (DB).
    - Si no existe en DB, buscar en las filas tipo `barrio` ya procesadas en esta misma importación (que se crearán en commit).
    - Si no se encuentra en ninguno → `estado_fila = error`, mensaje: "Barrio '${codigo}' no existe ni se está creando en este Excel".
- Si NO tiene `barrio_codigo_interno`:
  - Requerir `direccion_propia`. Si vacío → error.
- Validar `tipo_unidad` esté en valores válidos.
- Validar `estado` exista en `estados_definiciones` o esté vacío (default `disponible`).
- Si tiene `responsable_email`, buscar user con ese email. Si no existe → advertencia: "Vendedor con email X no existe, unidad se importa sin responsable".
- Validar tipos de datos numéricos y booleanos.
- Verificar duplicado por `codigo_interno`.
- Procesar extras igual que en barrios.
- Construir `datos_normalizados`.
- Guardar en `importacion_filas`.

8. **Contar totales** y actualizar la importación:
   - `total_filas`, `filas_ok`, `filas_duplicado`, `filas_error`, `filas_advertencia`.
   - `estado = 'listo_para_confirmar'` o `'con_errores'` si hay errores críticos que impiden continuar.

### Paso 2: revisión y commit

#### UI de revisión

Tres tabs/secciones:

**Tab 1 — Resumen:**
- Tarjetas con conteos: OK (verde), Duplicados (amarillo), Errores (rojo), Advertencias (naranja).
- Botón "Mapear columnas no reconocidas" si hay alguna sin mapear.
- Botón "Mapear extras no matcheados" si hay alguno sin mapear.
- Botón "Confirmar importación" (deshabilitado mientras haya errores no resueltos).
- Botón "Descartar importación".

**Tab 2 — Filas:**
- p-table con todas las filas, filtrable por `estado_fila`.
- Columnas: número fila, tipo, código, nombre, estado, mensajes, decisión.
- Por cada fila con problema (duplicado/error/advertencia), un dropdown de decisión:
  - `omitir`: no se importa.
  - `crear`: forzar creación (solo si no es duplicado puro).
  - `actualizar`: aplicar los datos del Excel sobre el registro existente (solo en duplicados).
- Acción masiva: "Omitir todos los duplicados", "Aceptar todos los OK".

**Tab 3 — Detalle de fila (modal o drawer):**
- Click en una fila → muestra `datos_originales` y `datos_normalizados` lado a lado.
- Permite editar `datos_normalizados` manualmente antes del commit (corregir errores).
- Botón "Guardar cambios en esta fila" → actualiza el `importacion_filas` y re-valida.

#### Mapeo manual de columnas (modal)

Si hay columnas no reconocidas:
- Tabla con cada columna no reconocida.
- Dropdown con opciones: "Ignorar", o cualquiera de los campos válidos según el tipo.
- Al guardar, re-procesar las filas afectadas con el mapeo aplicado.

#### Mapeo manual de extras (modal)

Si hay extras tipo `Extra: X` sin match automático:
- Lista de extras no matcheados.
- Por cada uno, dropdown con todos los `extras_definiciones` activos de la entidad correspondiente.
- Opción "Crear nueva definición de extra" (lleva al ABM de extras).
- Opción "Ignorar este extra".
- Al guardar, re-procesar las filas afectadas.

#### Commit

Al confirmar:
1. Marcar `importaciones.estado = 'confirmando'`.
2. Procesar filas en orden:
   - **Primero todos los barrios:** crear (si OK) o actualizar (si decisión = actualizar). Guardar el ID creado en `registro_creado_id`.
   - **Después todas las unidades:** resolver `barrio_id` real (puede ser un barrio recién creado en este mismo commit) y crear/actualizar.
3. Por cada fila exitosa: `aplicada = true`, `registro_creado_id = <nuevo_id>`.
4. Por cada fila fallida en aplicación: `error_aplicacion = <mensaje>`, mantener `aplicada = false`.
5. Si hay errores parciales, mostrar al admin el resumen final con qué se aplicó y qué falló.
6. Marcar `importaciones.estado = 'confirmada'`, `confirmada_en = now`.
7. Disparar `audit_log` con resumen de la importación.

---

## Estructura de archivos

```
apps/admin/src/app/features/importador/
├── importador.routes.ts
├── pages/
│   ├── importador-list.component.ts          # listado de importaciones previas
│   ├── importador-upload.component.ts        # paso 1: descargar plantilla + subir
│   └── importador-review.component.ts        # paso 2: revisar y confirmar
├── components/
│   ├── importador-resumen-tab.component.ts
│   ├── importador-filas-tab.component.ts
│   ├── importador-fila-detail.component.ts   # modal/drawer
│   ├── mapeo-columnas-dialog.component.ts
│   └── mapeo-extras-dialog.component.ts
├── services/
│   ├── importador.service.ts                 # orquestador, llama a parser + service
│   └── plantilla-generator.service.ts        # genera Excel descargable
├── parser/
│   ├── excel-parser.ts                       # lee xlsx con exceljs
│   ├── row-validator.ts                      # valida cada fila
│   ├── duplicate-detector.ts                 # checa duplicados contra DB y dentro del lote
│   ├── normalizer.ts                         # transforma raw → datos_normalizados
│   └── types.ts                              # interfaces compartidas
└── README.md                                  # cómo funciona el módulo
```

### Componente router

En `app.routes.ts` agregar (con guard `permisoGuard('importador.use')`):

```typescript
{
  path: 'importador',
  canActivate: [authGuard, mustNotChangePasswordGuard, permisoGuard('importador.use')],
  loadChildren: () => import('./features/importador/importador.routes')
}
```

Y entrada en `app.menu.ts` (solo admin):

```typescript
{
  label: 'Importador',
  icon: 'pi pi-upload',
  routerLink: ['/importador'],
  visible: () => permisos.can('importador.use')
}
```

---

## Reglas de implementación

- **TypeScript strict.** Sin `any` salvo casos justificados con comentario.
- **No usar la librería `xlsx`**, usar `exceljs`.
- **Performance:** archivos hasta 5.000 filas deben procesarse en menos de 30 segundos. Si tarda más, agregar progress indicator visible.
- **Manejo de archivos grandes:** rechazar archivos >10MB con mensaje claro. La UI debe mostrar tamaño antes de subir.
- **Limpieza:** archivos de importaciones más viejas que 30 días deberían poder eliminarse (no implementar el cron, pero dejar comentario `// TODO`).
- **Logs:** todas las operaciones críticas (parseo, commit) deben loguearse con `console.info` (no `console.log`), errores con `console.error`.
- **Mensajes de error al usuario** específicos: "Fila 47: el valor 'XYZ' de la columna 'precio' no es un número válido" mejor que "Error de tipo".
- **Idempotencia del commit:** si el usuario hace click dos veces en "Confirmar", no debe duplicar registros. Usar el campo `aplicada` para skipear filas ya procesadas.
- **Transaccionalidad:** PocketBase no tiene transacciones JS-level robustas, pero al menos procesar las filas en orden e ir actualizando `aplicada=true` por fila. Si falla, el admin puede ver exactamente hasta qué fila se llegó.

---

## Plan de ejecución con subagentes

### FASE 0 — Preparación (vos directamente)

1. Branch `feat/importador`.
2. Verificar que las tablas `importaciones` e `importacion_filas` existen con el schema correcto.
3. Si falta algún campo, crear migración antes de empezar.
4. `npm install exceljs` (verificar que se agrega al package.json).

### FASE 1 — Backend de soporte (1 subagente)

**Subagente A:**
- Crear migración `1700000070_extend_importacion_tables.js` con los campos que falten.
- Verificar API Rules de las tablas.
- No requiere hooks complejos en esta fase.

### FASE 2 — Parser + lógica core (1 subagente)

**Subagente B:**
- Implementar `excel-parser.ts`, `row-validator.ts`, `duplicate-detector.ts`, `normalizer.ts`.
- Crear `importador.service.ts` con métodos:
  - `analizarExcel(file: File): Promise<ImportacionId>`
  - `obtenerEstadoImportacion(id): Signal<EstadoImportacion>`
  - `guardarMapeoColumnas(id, mapeo): Promise<void>`
  - `guardarMapeoExtras(id, mapeo): Promise<void>`
  - `editarFila(filaId, datos): Promise<void>`
  - `commitImportacion(id): Promise<ResultadoCommit>`
  - `descartarImportacion(id): Promise<void>`
- Tests unitarios en `parser/__tests__/`.

### FASE 3 — Plantilla generator (1 subagente)

**Subagente C:**
- Crear `plantilla-generator.service.ts` con exceljs.
- Genera xlsx con hojas "Datos" e "Instrucciones".
- Incluye dropdowns y validaciones de celda.
- Incluye filas de ejemplo.
- Botón de descarga conectado al `importador-upload.component.ts`.

### FASE 4 — UI (1 subagente)

**Subagente D:**
- `importador-list.component.ts`: tabla de importaciones previas con estado y fecha.
- `importador-upload.component.ts`: drag&drop de archivo + botón de descarga de plantilla + barra de progreso del análisis.
- `importador-review.component.ts`: tabs de resumen + filas, modals de mapeo.
- Componentes auxiliares según estructura definida.

### FASE 5 — Verificación integral (vos directamente)

Smoke tests:

1. Click en "Descargar plantilla" → se descarga xlsx con columnas correctas, incluyendo dropdowns.
2. Llenar plantilla con 2 barrios y 5 unidades (algunas válidas, una con error de tipo, una duplicada respecto a un barrio existente).
3. Subir el archivo → ver pantalla de revisión.
4. Verificar conteos correctos en el resumen.
5. Verificar que la fila con error muestra mensaje específico.
6. Decidir: "omitir" para errores, "actualizar" para duplicado.
7. Click en "Confirmar importación".
8. Verificar que los barrios y unidades fueron creados/actualizados correctamente.
9. Verificar que el audit_log registró la importación.
10. **Edge case:** subir Excel con columna "Extra: Piscina" cuando existe extra "Piscina" en el ABM → match automático.
11. **Edge case:** subir Excel con columna "Extra: Pileta" cuando existe extra "Piscina" en el ABM → no match, ofrece mapeo manual.
12. **Edge case:** subir Excel con unidad referenciando un barrio que se crea en el mismo Excel → debe funcionar (orden de procesamiento).
13. **Edge case:** subir Excel con unidad referenciando un barrio inexistente → debe quedar como error.
14. **Edge case:** subir archivo de 11MB → debe rechazarse.
15. **Edge case:** subir archivo no-xlsx (ej: txt renombrado) → debe rechazarse con mensaje claro.

## Coordinación entre subagentes

- Antes de cada fase, mostrame el plan de delegación.
- Después de cada fase, reporte consolidado.
- **Las fases 2, 3 y 4 son SECUENCIALES** porque dependen entre sí (la UI necesita el service, el service necesita el parser, etc.).
- Si un subagente encuentra un blocker técnico con exceljs (especialmente con dropdowns o validaciones de celda en xlsx), reportarlo. Hay workarounds.

## Preguntas previas

Si al leer el prompt hay algo ambiguo, hacelo antes de empezar la Fase 0. Especialmente:
- ¿La versión actual de PocketBase v0.23 soporta upload de archivos >5MB en `importaciones.archivo_origen`? Verificar `maxSize` del field.
- ¿exceljs corre bien en el browser o requiere setup especial? (Sí corre, pero hay que importarlo bien).

¿Listo para arrancar la Fase 0?

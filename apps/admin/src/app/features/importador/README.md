# Módulo Importador

Permite importar barrios y unidades desde un archivo Excel (.xlsx) con un flujo de 2 pasos: análisis/staging y revisión/commit.

## Flujo

```
/importador          → listado de importaciones previas
/importador/nueva    → paso 1: descargar plantilla + subir archivo
/importador/:id/revision → paso 2: revisar filas, mapear columnas/extras, confirmar
```

## Permiso requerido

`importador.use` — solo usuarios con rol `admin` por defecto.

## Estructura de archivos

```
importador/
├── importador.routes.ts
├── pages/
│   ├── importador-list.component        # listado histórico
│   ├── importador-upload.component      # paso 1: upload + descarga plantilla
│   └── importador-review.component      # paso 2: revisión y commit
├── components/
│   ├── importador-resumen-tab           # tarjetas de conteos (OK/dup/err/adv)
│   ├── importador-filas-tab             # tabla filtrable de filas
│   ├── importador-fila-detail           # modal detalle + edición manual
│   ├── mapeo-columnas-dialog            # mapeo manual de columnas no reconocidas
│   └── mapeo-extras-dialog              # mapeo manual de extras no matcheados
├── parser/
│   ├── types.ts                         # interfaces compartidas
│   ├── excel-parser.ts                  # lectura xlsx con exceljs
│   ├── row-validator.ts                 # validación por fila
│   ├── normalizer.ts                    # raw → datos_normalizados
│   └── duplicate-detector.ts           # detección de duplicados en memoria
└── services/
    ├── importador.service.ts            # orquestador principal
    └── plantilla-generator.service.ts  # genera xlsx descargable
```

## Modelo de datos (PocketBase)

### `importaciones`
- `tipo`: `barrios | unidades | barrios_con_unidades`
- `estado`: `analizando → listo_para_confirmar | con_errores → confirmada | descartada`
- `mapeo_columnas` (JSON): `{ "Columna Excel": "campo_destino" | null }`
- `mapeo_extras` (JSON): `{ "Extra: X": "extra_definicion_id" | null }`

### `importacion_filas`
- `tipo_fila`: `barrio | unidad`
- `estado_fila`: `ok | duplicado | error | advertencia`
- `decision_usuario`: `pendiente | omitir | crear | actualizar`
- `mensajes` (JSON): array de strings con problemas detectados
- `datos_originales` (JSON): fila cruda del Excel
- `datos_normalizados` (JSON): payload listo para PocketBase
- `aplicada` (bool): true una vez commiteada exitosamente
- `registro_creado_id`: ID del registro creado al hacer commit

## Formato del Excel

Ver plantilla descargable desde `/importador/nueva`. Columnas clave:
- `tipo` (obligatorio): `barrio` o `unidad`
- `codigo_interno` (obligatorio): identificador único
- Para barrios: `nombre`, `slug`, `descripcion`, `lat`, `lng`, `zona`, `Extra: <nombre>`
- Para unidades: `barrio_codigo_interno`, `tipo_unidad`, `metros_cuadrados`, `precio`, `moneda`, `estado`, `responsable_email`, `Extra: <nombre>`

## Límites

- Archivo máximo: **10 MB**
- Formatos aceptados: `.xlsx`, `.xls`
- Filas recomendadas: hasta 5.000 (>5.000 puede tardar más de 30s)

## Extras

Las columnas `Extra: <nombre>` se auto-matchean contra `extras_definiciones.nombre` (case-insensitive, sin acentos). Si no hay match único → se requiere mapeo manual desde la UI de revisión.

## Commit

El commit procesa primero todos los barrios, luego las unidades (para resolver referencias `barrio_codigo_interno` a IDs reales). Es idempotente: filas con `aplicada=true` se saltean en re-runs.

El commit registra en `audit_log` un resumen con `filas_aplicadas`, `filas_fallidas`.

## Notas de desarrollo

- Librería Excel: `exceljs` ^4.4.0 (no usar `xlsx`, deprecated).
- `AuditLogService` es read-only desde Angular; el audit entry se escribe directo via `pb.collection('audit_log').create(...)`.
- `unidades.estado` es campo `text` (no select) desde migración `1700000016`.
- `unidades.extras` y `barrios.extras` son campos JSON con estructura `ExtraPersistido[]`.

<!-- TODO: agregar cron/tarea manual para limpiar importaciones >30 días de antigüedad -->

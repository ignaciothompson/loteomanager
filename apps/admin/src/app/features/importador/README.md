# Módulo Importador

Carga masiva de **barrios + lotes vacíos** desde Excel (`.xlsx`/`.xls`). Flujo: analizar (staging) → revisar → commit.

Documentación curada (plantilla, columnas, qué simplificar): vault `AppLotes/docs/Componentes/importador-excel.md`.

## Flujo

```
/importador              → historial
/importador/nueva        → descargar plantilla + subir archivo
/importador/:id/revision → revisar filas y confirmar
```

Permiso: `importador.use`.

## Excel v2 (el que usa el código)

Hoja `Datos`. Headers en `parser/types.ts` → `COLUMNAS_EXCEL`:

`tipo, codigo, nombre, slug, zona, descripcion, codigo_barrio, numero_lote, metros_cuadrados, precio, moneda, estado, orientacion`

- Filas `tipo=barrio`: `codigo` = clave **dentro del archivo**; `nombre` obligatorio.
- Filas `tipo=unidad`: `codigo_barrio` = ese `codigo`; `numero_lote` → `unidades.codigo`.
- Unidades siempre `lote_vacio`. No hay extras, mapeo de columnas, casa/prefab, CSV parser.

Generador: `PlantillaService.generarYDescargar()` → `plantilla-importacion-barrios-lotes.xlsx`.

## Archivos

```
importador/
├── importador.routes.ts
├── pages/          list, upload, review
├── components/     resumen-tab, filas-tab, detalle-drawer
├── parser/         excel-parser, normalizer, row-validator, duplicate-detector, types
└── services/       importador.service, plantilla.service
```

## Límites

- Máx 10 MB. Recomendado ≤ 5.000 filas.
- Commit: barrios primero, después unidades. Filas `aplicada=true` se saltean.
- Duplicado barrio (slug) → reusa el existente. Duplicado lote → omitir por defecto. **No hay update.**

## PocketBase

- `importaciones`: `tipo` típico `barrios_con_unidades`; estados `analizando` → `listo_para_confirmar` → `confirmada` | `con_errores` | `descartada`.
- `importacion_filas`: `tipo_fila` barrio|unidad; `estado_fila` ok|duplicado|error; `decision_usuario` pendiente|omitir|crear|actualizar (`actualizar` no se aplica en commit).

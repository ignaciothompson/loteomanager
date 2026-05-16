# Configuración dinámica: extras y estados (LoteoManager)

Este documento describe el módulo que permite definir **campos custom (extras)** y **estados** desde el panel admin, sin cambiar código ni desplegar migraciones por cada variación de negocio.

## Resumen

| Pieza | Ubicación / responsabilidad |
|-------|------------------------------|
| Esquema y datos | PocketBase: colecciones `extras_definiciones`, `estados_definiciones`; campos `extras` (JSON) en `barrios`, `unidades`, `interesados`; `contenido_snapshot` en `comparativas` |
| Reglas y lógica | `pb_hooks/main.pb.js` + [`pb_hooks/lm_extras_estados_shared.js`](../pb_hooks/lm_extras_estados_shared.js) (validación, sync de nombres, borrados, snapshot de comparativas, endpoint `POST /api/admin/estados/replace-and-delete`) |
| Cliente Angular | `shared-pb-client`: servicios + `DefinicionesCacheService`; `shared-ui`: editores y badge; admin: ABM en `/config/extras` y `/config/estados` |

## Modelo de datos

### Colección `extras_definiciones`

Define un campo configurable por entidad (`barrios`, `unidades`, `interesados`).

- **`code`**: identificador estable en `snake_case` (inmutable en la práctica de negocio; en el ABM no se edita al modificar).
- **`nombre`**: etiqueta visible; al cambiarlo, un hook actualiza el `nombre` denormalizado en los `extras[]` de los registros que usan ese extra.
- **`tipo`**: `texto` \| `numero` \| `opciones` \| `booleano` \| `fecha`.
- **`opciones`**: JSON array de strings (solo si `tipo = opciones`).
- **Flags**: `requerido`, `visible_en_lista`, `visible_en_landing`, `visible_en_comparativa`, `activo`, `orden_display`, `grupo`.

### Colección `estados_definiciones`

Estados para **`unidades`** e **`interesados`** (no aplica a barrios).

- **`code`**: estable; los **core** vienen sembrados por migración (`es_core = true`) y no se borran.
- **`nombre`**, **`color`**, **`icono`** (opcional), **`orden_display`**, **`activo`**.

### Formato `extras` en registros

Array JSON de objetos:

```json
[
  {
    "extra_id": "<id de extras_definiciones>",
    "code": "slug_snake",
    "nombre": "Texto visible",
    "valor": "…"
  }
]
```

El backend **repuebla** `code` y `nombre` desde la definición al guardar; no conviene confiar solo en lo que envía el cliente.

### `comparativas.contenido_snapshot`

JSON generado al **crear** la comparativa: copia de datos de unidades (y extras marcados `visible_en_comparativa`) en ese momento. Las vistas públicas / PDF deben preferir el snapshot frente a datos en vivo (tarea de producto en la landing).

## PocketBase: migraciones y Docker

Las migraciones viven en [`pb_migrations/`](../pb_migrations/) y se aplican al **arrancar** PocketBase (o con `pocketbase migrate`).

### Por qué no veías las colecciones nuevas

En [`docker/docker-compose.yml`](../docker/docker-compose.yml) el servicio `pocketbase` **solo montaba** `./pb_data`. Las carpetas `pb_migrations` y `pb_hooks` se **copian en la imagen** al hacer `docker build`. Si **reiniciás** el contenedor pero **no reconstruís** la imagen después de agregar migraciones, el contenedor sigue con archivos viejos.

**Opciones:**

1. **Reconstruir** (siempre válido): desde `loteomanager/docker`:
   ```bash
   docker compose build pocketbase --no-cache
   docker compose up -d pocketbase
   ```
2. **Volúmenes** (recomendado en desarrollo): el compose ahora monta también `../pb_migrations` y `../pb_hooks` sobre las rutas del contenedor. Tras un `git pull` con migraciones nuevas, al **reiniciar** el servicio PocketBase deberían aplicarse los archivos actuales del repo.

### Comprobar que corrieron

- En el admin de PocketBase (`/_/`) revisá las colecciones.
- En SQLite (`pb_data/data.db`) la tabla `_migrations` lista los archivos aplicados.

### Si una migración falló a mitad

Resolvé el error en el `.js`, restaurá un backup de `pb_data` si hace falta, y volvé a levantar PocketBase. No edites a mano el esquema en producción sin backup.

## Hooks y API custom

Implementados en [`pb_hooks/main.pb.js`](../pb_hooks/main.pb.js) (ver comentarios “HOOK 8”):

- Validación de `extras` y `estado` al crear/actualizar `barrios`, `unidades`, `interesados`.
- Sync de `nombre` denormalizado al editar `extras_definiciones`.
- Protección de borrado de extras en uso y de estados core / estados en uso.
- **`POST /api/admin/estados/replace-and-delete`**: body JSON `{ "estado_id_a_borrar", "estado_id_reemplazo" }`; requiere usuario **admin** autenticado (`users` + `Authorization: Bearer …`).

### JSVM: handlers aislados

PocketBase **serializa** cada callback de hook y lo ejecuta como programa aparte: **no** puede usar funciones declaradas en el scope global de `main.pb.js` (por eso podía aparecer `ReferenceError` al llamar helpers sueltos). La lógica reutilizable vive en [`pb_hooks/lm_extras_estados_shared.js`](../pb_hooks/lm_extras_estados_shared.js) y cada handler la carga con `require(__hooks + "/lm_extras_estados_shared.js")`. En los `onRecordUpdateRequest` filtrados por colección, además, la comprobación de si el body trae `extras` / `estado` se hace **inline** con `Object.prototype.hasOwnProperty.call(body, ...)` para no depender de ninguna función externa en el fragmento serializado (ver [documentación oficial](https://pocketbase.io/docs/js-overview/#handlers-scope)).

## Angular

### Caché

`DefinicionesCacheService` carga todas las definiciones tras login (y si ya había sesión al iniciar). Refrescá con `refresh()` después de cambios en los ABM de extras/estados.

### Rutas admin

- `/config/extras` — ABM de definiciones de extras.
- `/config/estados` — ABM de estados; si un estado custom está en uso, el flujo ofrece **reemplazar y borrar** (llama al endpoint anterior).

### Componentes compartidos (`@loteomanager/shared-ui`)

- `lib-extras-editor` — edición por definiciones activas de la entidad.
- `lib-extra-value-editor` — control según tipo.
- `lib-estado-badge` — badge con color/nombre desde la caché.

## Tipos TypeScript

Tras cambiar el esquema en PocketBase:

```bash
cd loteomanager
npm run pb:types
```

Eso regenera `shared-types/src/lib/pocketbase-types.ts` desde `docker/pb_data/data.db` (ruta configurable en `tools/pb-typegen.mjs`).

## Limitaciones conocidas

- Filtros avanzados por extras en listados y render en **landing pública** pueden quedar para una iteración posterior (los flags `visible_en_landing` ya se persisten).
- El **down** de la migración que pasa `estado` de select a texto no puede mapear estados **custom** inventados después a los valores fijos del select antiguo.
- Reporte de extras legados en barrios: [`pb_migrations/1700000017_report_legacy_barrios_extras.js`](../pb_migrations/1700000017_report_legacy_barrios_extras.js) y archivo opcional `pb_data/extras_migration_report.json`.

## Referencia de prompt

Especificación detallada y checklist de pruebas: [`loteomanager-extras-estados-prompt.md`](../../loteomanager-extras-estados-prompt.md) (en la raíz del workspace AppBarrios).

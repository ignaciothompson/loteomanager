/// <reference path="../pb_data/types.d.ts" />

/**
 * pb_hooks/main.pb.js — LoteoManager — PocketBase v0.23
 *
 * CAMBIOS API v0.23:
 *   - onRecordBeforeUpdateRequest → onRecordUpdateRequest (+ e.next())
 *   - onRecordBeforeCreateRequest → onRecordCreateRequest (+ e.next())
 *   - onRecordAfterCreateSuccess / onRecordAfterUpdateSuccess / onRecordAfterDeleteSuccess sin cambios
 *
 * Hooks implementados:
 *   1. Auditoría (unidades, barrios, interesados, comparativas, users)
 *   2. Permisos por campo en unidades (vendedor vs admin)
 *   3. Fechas comerciales automáticas al cambiar estado
 *   4. Duplicados en interesados (misma unidad+email en 5 min)
 *   5. Cierre interesado ganado → actualiza unidad a vendido
 *   6. Token público para comparativas
 *   7. Singleton config
 */

// ─── HOOK 1 — AUDITORÍA ───────────────────────────────────────────────────────

onRecordAfterCreateSuccess((e) => {
  const AUDITED = ["unidades", "barrios", "interesados", "comparativas", "users"];
  if (!AUDITED.includes(e.record.collection().name)) return;
  
  var authId = null;
  try { if (e.auth) authId = e.auth.id; } catch (_) {}

  try {
    var col = $app.findCollectionByNameOrId("audit_log");
    var log = new Record(col);
    if (authId) log.set("user_id", authId);
    log.set("collection_name", e.record.collection().name);
    log.set("record_id", e.record.id);
    log.set("action", "create");
    log.set("after", e.record.publicExport());
    $app.save(log);
  } catch (err) {
    console.error("[audit_log] Error:", err);
  }
});

onRecordAfterUpdateSuccess((e) => {
  const AUDITED = ["unidades", "barrios", "interesados", "comparativas", "users"];
  if (!AUDITED.includes(e.record.collection().name)) return;
  
  var authId = null;
  try { if (e.auth) authId = e.auth.id; } catch (_) {}
  
  var before = null;
  try { 
    before = e.record.original().publicExport(); 
  } catch (_) {}

  try {
    var col = $app.findCollectionByNameOrId("audit_log");
    var log = new Record(col);
    if (authId) log.set("user_id", authId);
    log.set("collection_name", e.record.collection().name);
    log.set("record_id", e.record.id);
    log.set("action", "update");
    if (before !== null) log.set("before", before);
    log.set("after", e.record.publicExport());
    $app.save(log);
  } catch (err) {
    console.error("[audit_log] Error:", err);
  }
});

onRecordAfterDeleteSuccess((e) => {
  const AUDITED = ["unidades", "barrios", "interesados", "comparativas", "users"];
  if (!AUDITED.includes(e.record.collection().name)) return;
  
  var authId = null;
  try { if (e.auth) authId = e.auth.id; } catch (_) {}

  try {
    var col = $app.findCollectionByNameOrId("audit_log");
    var log = new Record(col);
    if (authId) log.set("user_id", authId);
    log.set("collection_name", e.record.collection().name);
    log.set("record_id", e.record.id);
    log.set("action", "delete");
    log.set("before", e.record.publicExport());
    $app.save(log);
  } catch (err) {
    console.error("[audit_log] Error:", err);
  }
});

// ─── HOOK 2 — PERMISOS POR CAMPO EN UNIDADES ─────────────────────────────────

onRecordUpdateRequest((e) => {
  const CAMPOS_VENDEDOR = new Set([
    "estado","fecha_reserva","fecha_sena","fecha_venta","fecha_escritura",
    "fecha_bloqueo","interesado_comprador_id","oferta","precio_oferta","destacado",
  ]);

  if (!e.auth) { e.next(); return; }

  const role = e.auth.get("role");
  if (role !== "vendedor") { e.next(); return; }

  const vendedorId = e.auth.id;
  const barrioId   = e.record.get("barrio_id");

  if (!barrioId) {
    throw new BadRequestError("Esta unidad no pertenece a ningún barrio y no podés editarla.");
  }

  let asignaciones = [];
  try {
    asignaciones = $app.findRecordsByFilter(
      "vendedor_barrios",
      `vendedor_id = '${vendedorId}' && barrio_id = '${barrioId}'`,
      "-created", 1, 0,
    );
  } catch (_e) {}

  if (!asignaciones || asignaciones.length === 0) {
    throw new ForbiddenError("No tenés permiso sobre el barrio de esta unidad.");
  }

  const body = e.requestInfo().body || {};
  for (const campo of Object.keys(body)) {
    if (!CAMPOS_VENDEDOR.has(campo)) {
      throw new BadRequestError(
        `Solo podés modificar estados y fechas. El campo '${campo}' requiere permisos de administrador.`
      );
    }
  }

  e.next();
}, "unidades");

// ─── HOOK 3 — FECHAS COMERCIALES AUTOMÁTICAS ─────────────────────────────────

onRecordUpdateRequest((e) => {
  const ESTADO_FECHA = {
    bloqueado:   "fecha_bloqueo",
    reservado:   "fecha_reserva",
    sena:        "fecha_sena",
    vendido:     "fecha_venta",
    escriturado: "fecha_escritura",
  };

  const nuevo = e.record.get("estado");
  let anterior = "";
  try {
    const orig = $app.findRecordById(e.record.collection().id, e.record.id);
    anterior = orig.get("estado");
  } catch (_) {}

  if (nuevo !== anterior) {
    const campo = ESTADO_FECHA[nuevo];
    if (campo) {
      const fechaActual = e.record.get(campo);
      const body = e.requestInfo().body || {};
      if (!fechaActual && !body[campo]) {
        e.record.set(campo, new Date().toISOString());
      }
    }
  }

  e.next();
}, "unidades");

// ─── HOOK 4 — DUPLICADOS EN INTERESADOS ──────────────────────────────────────

onRecordCreateRequest((e) => {
  const email    = e.record.get("email");
  const unidadId = e.record.get("unidad_id");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestError("El email ingresado no tiene un formato válido.");
  }

  if (unidadId) {
    const hace5Min = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    let duplicados = [];
    try {
      duplicados = $app.findRecordsByFilter(
        "interesados",
        `email = '${email}' && unidad_id = '${unidadId}' && created >= '${hace5Min}'`,
        "-created", 1, 0,
      );
    } catch (_e) {}

    if (duplicados && duplicados.length > 0) {
      throw new BadRequestError(
        "Ya enviaste una consulta sobre esta unidad recientemente. Esperá unos minutos."
      );
    }
  }

  e.next();
}, "interesados");

// ─── HOOK 5 — CIERRE DE INTERESADO GANADO → ACTUALIZA UNIDAD ─────────────────

onRecordUpdateRequest((e) => {
  const nuevo = e.record.get("estado");
  let anterior = "";
  try {
    const orig = $app.findRecordById(e.record.collection().id, e.record.id);
    anterior = orig.get("estado");
  } catch (_) {}

  if (nuevo !== "cerrado_ganado" || anterior === "cerrado_ganado") {
    e.next();
    return;
  }

  const unidadId = e.record.get("unidad_id");
  if (!unidadId) { e.next(); return; }

  let unidad;
  try {
    unidad = $app.findRecordById("unidades", unidadId);
  } catch (_e) {
    throw new BadRequestError(`No se encontró la unidad '${unidadId}'.`);
  }

  const estadoUnidad = unidad.get("estado");
  if (estadoUnidad === "vendido" || estadoUnidad === "escriturado") {
    throw new BadRequestError(
      `La unidad ya está en estado '${estadoUnidad}' y no puede marcarse como vendida nuevamente.`
    );
  }

  unidad.set("estado", "vendido");
  unidad.set("interesado_comprador_id", e.record.id);
  unidad.set("fecha_venta", new Date().toISOString());

  try {
    $app.save(unidad);
  } catch (err) {
    throw new BadRequestError(`Error al actualizar la unidad: ${err.message || err}`);
  }

  e.next();
}, "interesados");

// ─── HOOK 6 — TOKEN PÚBLICO PARA COMPARATIVAS ────────────────────────────────

onRecordCreateRequest((e) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const MAX = 5;
  let token = "";
  for (let i = 0; i < MAX; i++) {
    token = "";
    for (let j = 0; j < 16; j++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    let existe = [];
    try {
      existe = $app.findRecordsByFilter(
        "comparativas",
        `token_publico = '${token}'`,
        "-created", 1, 0,
      );
    } catch (_e) {}
    if (!existe || existe.length === 0) break;
    if (i === MAX - 1) throw new Error("No se pudo generar un token único. Intentá de nuevo.");
  }

  e.record.set("token_publico", token);
  if (!e.record.get("vistas_count")) e.record.set("vistas_count", 0);

  e.next();
}, "comparativas");

// ─── HOOK 7 — SINGLETON CONFIG ────────────────────────────────────────────────

onRecordCreateRequest((e) => {
  let total = 0;
  try {
    const existing = $app.findAllRecords("config");
    total = existing ? existing.length : 0;
  } catch (_e) {}

  if (total > 0) {
    throw new BadRequestError(
      "Config es singleton: solo puede existir un registro. Usá UPDATE para modificarlo."
    );
  }

  e.next();
}, "config");

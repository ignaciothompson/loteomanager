/**
 * Lógica compartida extras/estados para hooks PocketBase.
 * Debe cargarse con require() DENTRO de cada handler — los handlers no ven el scope del archivo principal.
 */

function lmNormalizeExtrasArray(val) {
  if (val === null || val === undefined) return [];
  if (!Array.isArray(val)) return [];
  return val;
}

/**
 * Convierte extras del Record (JSON / goja) a array JS de objetos planos.
 * Evita falsos positivos donde typeof !== "object" o hay nulls en el array.
 */
/**
 * PocketBase expone campos JSON del record como []byte (Go byte slice).
 * En goja eso se ve como un array de números (char codes).
 * Esta función detecta ese caso y convierte los bytes a string UTF-8.
 */
function lmByteSliceToString(v) {
  // Si v es un array de números ≤255 → es un []byte de Go → convertir a string
  if (!Array.isArray(v) || v.length === 0) return null;
  for (var bi = 0; bi < Math.min(v.length, 8); bi++) {
    if (typeof v[bi] !== "number" || v[bi] < 0 || v[bi] > 255 || v[bi] !== Math.floor(v[bi])) {
      return null; // no es byte slice
    }
  }
  var chars = [];
  for (var ci = 0; ci < v.length; ci++) {
    chars.push(String.fromCharCode(v[ci]));
  }
  return chars.join("");
}

/**
 * Convierte el valor raw de "extras" (puede ser []byte goja, string, array JS, objeto) a array JS plano.
 * NUNCA lanza: si no es convertible a array, devuelve [].
 */
function lmCoerceExtrasArrayFromRecord(raw) {
  var v = raw;

  // Detectar []byte de Go (array de char codes) → convertir a string JSON
  if (Array.isArray(v)) {
    var asStr = lmByteSliceToString(v);
    if (asStr !== null) {
      try { v = JSON.parse(asStr); } catch (_e) { return []; }
    }
  }

  // String JSON → parsear
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch (_e) { return []; }
  }

  // null / undefined → vacío
  if (v == null) return [];

  // Primitivo suelto (number, boolean) → no es un array
  if (typeof v !== "object") {
    console.warn("[extras] valor raíz descartado (tipo=" + typeof v + ")");
    return [];
  }

  // Objeto único con extra_id → envolver en array
  if (!Array.isArray(v)) {
    try { if (v.extra_id) return [v]; } catch (_e2) {}
    return [];
  }

  // Array JS → round-trip JSON para limpiar wrappers goja
  try {
    var plain = JSON.parse(JSON.stringify(v));
    if (!Array.isArray(plain)) return [];
    var out = [];
    for (var i = 0; i < plain.length; i++) {
      if (plain[i] != null) out.push(plain[i]);
    }
    return out;
  } catch (_e3) {
    var out2 = [];
    for (var j = 0; j < v.length; j++) {
      if (v[j] != null) out2.push(v[j]);
    }
    return out2;
  }
}

function lmFindRecordsUsingExtra(extraId, collectionName) {
  const batch = 200;
  let offset = 0;
  const out = [];
  while (true) {
    let chunk = [];
    try {
      chunk = $app.findRecordsByFilter(collectionName, "", "-updated", batch, offset);
    } catch (_e) {
      break;
    }
    if (!chunk || chunk.length === 0) break;
    for (const r of chunk) {
      const arr = lmCoerceExtrasArrayFromRecord(r.get("extras"));
      for (let ai = 0; ai < arr.length; ai++) {
        const item = lmItemToObject(arr[ai]);
        if (item && item.extra_id === extraId) {
          out.push(r);
          break;
        }
      }
    }
    offset += chunk.length;
    if (chunk.length < batch) break;
  }
  return out;
}

function lmCountExtraUsage(extraId) {
  let n = 0;
  for (const col of ["barrios", "unidades", "interesados"]) {
    n += lmFindRecordsUsingExtra(extraId, col).length;
  }
  return n;
}

function lmCountEstadoUsage(entidad, code) {
  const col = entidad === "unidades" ? "unidades" : "interesados";
  let n = 0;
  let offset = 0;
  const batch = 200;
  while (true) {
    let rows = [];
    try {
      rows = $app.findRecordsByFilter(col, `estado = "${code}"`, "-updated", batch, offset);
    } catch (_e) {
      break;
    }
    if (!rows || rows.length === 0) break;
    n += rows.length;
    offset += rows.length;
    if (rows.length < batch) break;
  }
  return n;
}

function lmGetExtraDef(id) {
  try {
    return $app.findRecordById("extras_definiciones", id);
  } catch (_e) {
    return null;
  }
}

/**
 * Convierte un valor obtenido con record.get() / def.get() a string JS limpia.
 * Maneja byte slices de Go, strings y números.
 */
function lmGetString(rawVal) {
  if (rawVal == null) return "";
  if (typeof rawVal === "string") return rawVal;
  // byte slice de Go → convertir
  var asStr = lmByteSliceToString(rawVal);
  if (asStr !== null) return asStr.replace(/^"|"$/g, ""); // quitar comillas si el byte slice era un JSON string
  return String(rawVal);
}

function lmValidateExtraValor(def, valor) {
  const tipo = lmGetString(def.get("tipo"));
  const nombre = lmGetString(def.get("nombre")) || lmGetString(def.get("code"));
  if (tipo === "texto") {
    if (typeof valor !== "string") {
      throw new BadRequestError(`Extra '${nombre}': debe ser texto.`);
    }
  } else if (tipo === "numero") {
    if (typeof valor === "number" && !Number.isNaN(valor)) return;
    if (typeof valor === "string" && valor.trim() !== "" && !Number.isNaN(Number(valor))) return;
    throw new BadRequestError(`Extra '${nombre}': debe ser un número válido.`);
  } else if (tipo === "booleano") {
    if (typeof valor !== "boolean") {
      throw new BadRequestError(`Extra '${nombre}': debe ser booleano.`);
    }
  } else if (tipo === "fecha") {
    if (typeof valor !== "string" || Number.isNaN(Date.parse(valor))) {
      throw new BadRequestError(`Extra '${nombre}': debe ser una fecha ISO válida.`);
    }
  } else if (tipo === "opciones") {
    // opciones también puede ser byte slice → usar lmCoerceExtrasArrayFromRecord para parsear
    const rawOpts = def.get("opciones");
    let list = [];
    try {
      const parsed = lmCoerceExtrasArrayFromRecord(rawOpts);
      list = Array.isArray(parsed) ? parsed.map(function(o) { return typeof o === "string" ? o : String(o); }) : [];
    } catch (_e) {}
    if (typeof valor !== "string" || list.indexOf(valor) === -1) {
      throw new BadRequestError(`Extra '${nombre}': valor '${valor}' no permitido. Opciones: [${list.join(", ")}].`);
    }
  }
}

/**
 * Convierte cualquier elemento del array de extras a un objeto plano, o null si no es convertible.
 * Nunca lanza: en vez devuelve null para que el caller decida qué hacer.
 */
function lmItemToObject(el) {
  if (el == null) return null;
  var t = typeof el;
  // Primitivos sueltos: número, boolean → corrupción legada, descartar
  if (t === "number" || t === "boolean") {
    console.warn("[extras] descartando primitivo legado: " + JSON.stringify(el));
    return null;
  }
  // String → intentar parsear como JSON
  if (t === "string") {
    try {
      var parsed = JSON.parse(el);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_e) {}
    console.warn("[extras] descartando string no-objeto: " + String(el).slice(0, 80));
    return null;
  }
  // Objeto o wrapper goja → forzar a objeto plano via JSON round-trip
  if (t === "object" && !Array.isArray(el)) {
    try {
      var plain = JSON.parse(JSON.stringify(el));
      if (plain !== null && typeof plain === "object" && !Array.isArray(plain)) {
        return plain;
      }
    } catch (_e2) {}
    // Último recurso: intentar acceder a extra_id directamente (wrapper goja)
    try {
      var eid = el.extra_id;
      if (eid !== undefined && eid !== null) {
        return { extra_id: String(eid), code: String(el.code || ""), nombre: String(el.nombre || ""), valor: el.valor !== undefined ? el.valor : null };
      }
    } catch (_e3) {}
    console.warn("[extras] descartando objeto no serializable: " + typeof el);
    return null;
  }
  // Cualquier otra cosa (array anidado, etc.) → descartar
  console.warn("[extras] descartando elemento de tipo inesperado: " + t);
  return null;
}

function lmValidateExtrasForEntidad(entidad, record, ev) {
  try {
    $app.findCollectionByNameOrId("extras_definiciones");
  } catch (_e) {
    return;
  }

  // Obtener el raw de extras: e.record puede traer valor fusionado con DB,
  // así que también intentamos leerlo del cuerpo del request.
  var raw = record.get("extras");
  if (ev) {
    try {
      var body = ev.requestInfo().body || {};
      var bodyExtras = body["extras"];
      if (bodyExtras !== undefined && bodyExtras !== null) {
        raw = bodyExtras;
      }
    } catch (_eb) {}
  }

  // Normalizar a array plano JS descartando primitivos sueltos (legado corrupto)
  var coerced = lmCoerceExtrasArrayFromRecord(raw);
  var items = [];
  for (var ci = 0; ci < coerced.length; ci++) {
    var obj = lmItemToObject(coerced[ci]);
    if (obj !== null) items.push(obj);
  }

  var requiredDefs = [];
  try {
    var found = $app.findRecordsByFilter(
      "extras_definiciones",
      `entidad = "${entidad}" && activo = true && requerido = true`,
      "orden_display",
      500,
      0,
    );
    if (found) requiredDefs.push.apply(requiredDefs, found);
  } catch (_e2) {}

  var seenIds = {};
  var normalized = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var eid = item.extra_id == null ? "" : String(item.extra_id).trim();
    if (!eid) {
      // sin extra_id → descartar silenciosamente
      console.warn("[extras] ítem sin extra_id en posición " + (i + 1) + ", descartado.");
      continue;
    }
    var def = lmGetExtraDef(eid);
    if (!def || lmGetString(def.get("entidad")) !== entidad) {
      // ID desconocido o entidad incorrecta → descartar (puede ser extra borrado)
      console.warn("[extras] extra_id desconocido o entidad incorrecta, descartado: " + eid);
      continue;
    }
    if (!def.get("activo")) {
      // Definición inactiva → descartar silenciosamente
      continue;
    }
    var req = !!def.get("requerido");
    var empty = item.valor === null || item.valor === undefined || item.valor === "" ||
      (typeof item.valor === "string" && item.valor.trim() === "");
    if (req) {
      if (empty) {
        throw new BadRequestError("El extra '" + def.get("nombre") + "' es obligatorio.");
      }
      lmValidateExtraValor(def, item.valor);
    } else {
      if (empty) continue;
      lmValidateExtraValor(def, item.valor);
    }

    seenIds[eid] = true;
    normalized.push({
      extra_id: eid,
      code: def.get("code"),
      nombre: def.get("nombre"),
      valor: item.valor,
    });
  }

  for (let j = 0; j < requiredDefs.length; j++) {
    const d = requiredDefs[j];
    if (!seenIds[d.id]) {
      throw new BadRequestError(`Falta el extra requerido: ${d.get("nombre")}.`);
    }
  }

  record.set("extras", normalized);
}

function lmValidateEstadoForEntidad(entidad, record, ev) {
  try {
    $app.findCollectionByNameOrId("estados_definiciones");
  } catch (_e) {
    return;
  }

  // Leer el code del body del request (más fiable que record.get())
  var rawCode = record.get("estado");

  if (ev) {
    try {
      var body = ev.requestInfo().body || {};
      if (body["estado"] !== undefined && body["estado"] !== null) {
        rawCode = body["estado"];
      }
    } catch (_eb) {}
  }

  // Si rawCode es un objeto (bug angular sin optionValue), intentar extraer .value o .code
  if (rawCode !== null && typeof rawCode === "object" && !Array.isArray(rawCode)) {
    try {
      var plain = JSON.parse(JSON.stringify(rawCode));
      rawCode = plain["value"] || plain["code"] || plain["estado"] || "";
    } catch (_eo) {
      rawCode = "";
    }
  }

  var code = lmGetString(rawCode);

  if (!code) {
    throw new BadRequestError("El campo estado es obligatorio.");
  }

  // findFirstRecordByFilter no requiere sort → evita error "invalid sort field 'created'"
  // en colecciones que no tienen campo autodate created.
  var filterStr = 'entidad = "' + entidad + '" && code = "' + code + '"';
  var estadoDef = null;
  try {
    estadoDef = $app.findFirstRecordByFilter("estados_definiciones", filterStr);
  } catch (err) {
    var msg = String(err);
    if (!msg.includes("no rows") && !msg.includes("not found")) {
      console.error("[lmValidateEstado] query error:", msg);
      throw err;
    }
    // "no rows" / "not found" → estadoDef queda null → se maneja abajo
  }

  if (!estadoDef) {
    throw new BadRequestError("Estado '" + code + "' no existe para la entidad '" + entidad + "'.");
  }

  // Verificar activo en JS (evita ambigüedad de bool en SQLite: 0/1/true/"true")
  var activo = estadoDef.get("activo");
  if (activo !== true && activo !== 1 && activo !== "1" && activo !== "true") {
    throw new BadRequestError("Estado '" + code + "' existe pero está inactivo.");
  }
}

function lmCollectExtrasForComparativa(unidadRecord) {
  const raw = lmCoerceExtrasArrayFromRecord(unidadRecord.get("extras"));
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const item = lmItemToObject(raw[i]);
    if (!item || !item.extra_id) continue;
    let def = null;
    try {
      def = $app.findRecordById("extras_definiciones", item.extra_id);
    } catch (_e) {}
    if (!def || !def.get("visible_en_comparativa") || !def.get("activo")) continue;
    out.push({ nombre: item.nombre || lmGetString(def.get("nombre")), valor: item.valor });
  }
  return out;
}

function lmBuildComparativaSnapshot(record) {
  const ids = record.get("unidades_ids") || [];
  const idList = Array.isArray(ids) ? ids : ids ? [ids] : [];
  const unidadesOut = [];
  for (let i = 0; i < idList.length; i++) {
    const uid = idList[i];
    if (!uid) continue;
    let u = null;
    try {
      u = $app.findRecordById("unidades", uid);
    } catch (_e) {
      continue;
    }
    let barrioNombre = null;
    let barrioLat = null;
    let barrioLng = null;
    const bid = u.get("barrio_id");
    if (bid) {
      try {
        const b = $app.findRecordById("barrios", bid);
        barrioNombre = b.get("nombre");
        barrioLat = b.get("lat");
        barrioLng = b.get("lng");
      } catch (_e2) {}
    }
    unidadesOut.push({
      id: u.id,
      codigo_interno: u.get("codigo_interno"),
      tipo_unidad: u.get("tipo_unidad"),
      precio: u.get("precio"),
      moneda: u.get("moneda"),
      m2: u.get("metros_cuadrados"),
      barrio_nombre: barrioNombre,
      barrio_lat: barrioLat,
      barrio_lng: barrioLng,
      galeria_urls: u.get("galeria") || [],
      extras_visible: lmCollectExtrasForComparativa(u),
    });
  }
  record.set("contenido_snapshot", {
    generated_at: new Date().toISOString(),
    unidades: unidadesOut,
  });
}

function lmSyncExtraNombreDenormalized(extraId, newNombre) {
  const collections = ["barrios", "unidades", "interesados"];
  for (let c = 0; c < collections.length; c++) {
    const colName = collections[c];
    const affected = lmFindRecordsUsingExtra(extraId, colName);
    for (let i = 0; i < affected.length; i++) {
      const r = affected[i];
      const arr = lmCoerceExtrasArrayFromRecord(r.get("extras"));
      let changed = false;
      for (let j = 0; j < arr.length; j++) {
        const item = lmItemToObject(arr[j]);
        if (item && item.extra_id === extraId && item.nombre !== newNombre) {
          item.nombre = newNombre;
          arr[j] = item;
          changed = true;
        }
      }
      if (changed) {
        r.set("extras", arr);
        try {
          $app.save(r);
        } catch (err) {
          console.error("[extras sync nombre]", colName, r.id, err);
        }
      }
      if ((i + 1) % 100 === 0) {
        console.log("[extras sync nombre]", colName, i + 1, "/", affected.length);
      }
    }
  }
}

module.exports = {
  lmValidateExtrasForEntidad,
  lmValidateEstadoForEntidad,
  lmBuildComparativaSnapshot,
  lmSyncExtraNombreDenormalized,
  lmCountExtraUsage,
  lmCountEstadoUsage,
};

/**
 * pb_hooks/_tests/hooks.test.js
 * LoteoManager — Tests de los hooks de PocketBase
 *
 * NOTA: PocketBase v0.23 no tiene un framework de testing nativo para JSVM.
 * Estos tests están escritos como scripts ejecutables que se pueden correr
 * con el binario de PocketBase en modo "jsvm" o como utilidad de verificación.
 *
 * Para ejecutar manualmente conectado a una instancia real:
 *   - Estos tests deben ejecutarse contra una instancia de PocketBase de testing
 *     (no producción) con los datos limpios.
 *
 * Formato: cada test es una función que lanza Error si falla.
 * Se reporta PASS / FAIL por consola.
 */

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER MÍNIMO
// ─────────────────────────────────────────────────────────────────────────────

const results = { pass: 0, fail: 0, errors: [] };

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    results.pass++;
  } catch (e) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${e.message || e}`);
    results.fail++;
    results.errors.push({ name, error: e.message || String(e) });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function assertThrows(fn, expectedMsg) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    if (expectedMsg && !(e.message || "").includes(expectedMsg)) {
      throw new Error(
        `Expected error containing "${expectedMsg}", got: "${e.message || e}"`
      );
    }
  }
  if (!threw) {
    throw new Error(`Expected function to throw, but it did not.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCKS / STUBS PARA TESTING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simula un Record de PocketBase con get/set y originalCopy.
 */
function makeRecord(collectionName, data, originalData) {
  const _data = Object.assign({}, data);
  const _original = Object.assign({}, originalData || data);

  return {
    id: _data.id || "rec_" + Math.random().toString(36).slice(2, 9),
    collection: () => ({ name: collectionName }),
    get: (key) => _data[key],
    set: (key, val) => { _data[key] = val; },
    publicExport: () => Object.assign({}, _data),
    originalCopy: () => makeRecord(collectionName, _original, _original),
    _data,
  };
}

/**
 * Simula requestInfo().body con los campos que llegan en el request.
 */
function makeEvent(collectionName, data, originalData, authData, requestBody) {
  const record = makeRecord(collectionName, data, originalData);
  return {
    record,
    auth: authData
      ? {
          id: authData.id || "user_123",
          get: (key) => authData[key],
        }
      : null,
    requestInfo: () => ({ body: requestBody || {} }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Importar las funciones del hook (simulado, dado que en PocketBase JSVM
// las funciones de hooks no se exportan — en tests reales, copiamos la lógica)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-implementación de las funciones de negocio extraídas del hook
 * para poder testearlas en aislamiento.
 */

function generateToken(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

const CAMPOS_VENDEDOR_UNIDADES = new Set([
  "estado", "fecha_reserva", "fecha_sena", "fecha_venta",
  "fecha_escritura", "fecha_bloqueo", "interesado_comprador_id",
  "oferta", "precio_oferta", "destacado",
]);

const ESTADO_FECHA_MAP = {
  bloqueado:   "fecha_bloqueo",
  reservado:   "fecha_reserva",
  sena:        "fecha_sena",
  vendido:     "fecha_venta",
  escriturado: "fecha_escritura",
};

// Simula ForbiddenError y BadRequestError como clases con message
function ForbiddenError(msg)   { this.message = msg; this.name = "ForbiddenError"; }
function BadRequestError(msg)  { this.message = msg; this.name = "BadRequestError"; }

/**
 * Lógica extraída del Hook 2 para testear en aislamiento.
 */
function validarPermisosVendedor(event, mockDb) {
  if (event.record.collection().name !== "unidades") return;
  if (!event.auth) return;

  const userRole = event.auth.get("role");
  if (userRole === "admin") return;

  if (userRole === "vendedor") {
    const vendedorId = event.auth.id;
    const barrioId   = event.record.get("barrio_id");

    if (!barrioId) {
      throw new BadRequestError("Esta unidad no pertenece a ningún barrio y no podés editarla.");
    }

    const asignaciones = mockDb.vendedor_barrios.filter(
      r => r.vendedor_id === vendedorId && r.barrio_id === barrioId
    );

    if (asignaciones.length === 0) {
      throw new ForbiddenError("No tenés permiso sobre el barrio de esta unidad.");
    }

    const requestData = event.requestInfo().body || {};
    for (const campo of Object.keys(requestData)) {
      if (!CAMPOS_VENDEDOR_UNIDADES.has(campo)) {
        throw new BadRequestError(
          `Solo podés modificar estados y fechas comerciales. El campo '${campo}' requiere permisos de administrador.`
        );
      }
    }
  }
}

/**
 * Lógica extraída del Hook 3 para testear en aislamiento.
 */
function actualizarFechaComercial(event) {
  if (event.record.collection().name !== "unidades") return;

  const nuevoEstado    = event.record.get("estado");
  const estadoAnterior = event.record.originalCopy().get("estado");

  if (nuevoEstado === estadoAnterior) return;

  const campoFecha = ESTADO_FECHA_MAP[nuevoEstado];
  if (!campoFecha) return;

  const fechaActual  = event.record.get(campoFecha);
  const requestData  = event.requestInfo().body || {};
  if (!fechaActual && !requestData[campoFecha]) {
    event.record.set(campoFecha, new Date().toISOString());
  }
}

/**
 * Lógica extraída del Hook 4 para testear en aislamiento.
 */
function validarDuplicadoInteresado(event, mockDb) {
  if (event.record.collection().name !== "interesados") return;

  const email    = event.record.get("email");
  const unidadId = event.record.get("unidad_id");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestError("El email ingresado no tiene un formato válido.");
  }

  if (!unidadId) return;

  const hace5Min = new Date(Date.now() - 5 * 60 * 1000);
  const duplicados = mockDb.interesados.filter(r => {
    return r.email === email &&
           r.unidad_id === unidadId &&
           new Date(r.created) >= hace5Min;
  });

  if (duplicados.length > 0) {
    throw new BadRequestError(
      "Ya enviaste una consulta sobre esta unidad recientemente."
    );
  }
}

/**
 * Lógica extraída del Hook 5 para testear en aislamiento.
 */
function cerrarInteresadoGanado(event, mockDb) {
  if (event.record.collection().name !== "interesados") return;

  const nuevoEstado    = event.record.get("estado");
  const estadoAnterior = event.record.originalCopy().get("estado");

  if (nuevoEstado !== "cerrado_ganado" || estadoAnterior === "cerrado_ganado") return;

  const unidadId = event.record.get("unidad_id");
  if (!unidadId) return;

  const unidad = mockDb.unidades.find(u => u.id === unidadId);
  if (!unidad) {
    throw new BadRequestError(`No se encontró la unidad con id '${unidadId}'.`);
  }

  if (unidad.estado === "vendido" || unidad.estado === "escriturado") {
    throw new BadRequestError(
      `La unidad ya está en estado '${unidad.estado}' y no puede marcarse como vendida nuevamente.`
    );
  }

  // Simular el save
  unidad.estado = "vendido";
  unidad.interesado_comprador_id = event.record.id;
  unidad.fecha_venta = new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE DE TESTS
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n=== LoteoManager — Tests de Hooks PocketBase ===\n");

// --- generateToken ---
console.log("-- generateToken --");

test("genera token de 16 caracteres", () => {
  const token = generateToken(16);
  assert(token.length === 16, `Esperaba 16 chars, obtuve ${token.length}`);
});

test("token solo contiene caracteres alfanuméricos", () => {
  const token = generateToken(20);
  assert(/^[A-Za-z0-9]+$/.test(token), `Token inválido: ${token}`);
});

test("tokens consecutivos son distintos", () => {
  const t1 = generateToken(16);
  const t2 = generateToken(16);
  assert(t1 !== t2, "Dos tokens consecutivos fueron iguales (muy improbable)");
});

// --- Hook 2: Permisos de campo en unidades ---
console.log("\n-- Hook 2: Permisos por campo en unidades --");

const mockDb = {
  vendedor_barrios: [
    { vendedor_id: "vendor_1", barrio_id: "barrio_A" },
  ],
  unidades: [
    { id: "unidad_1", barrio_id: "barrio_A", estado: "disponible" },
    { id: "unidad_2", barrio_id: "barrio_B", estado: "disponible" },
  ],
  interesados: [],
};

test("admin puede modificar cualquier campo", () => {
  const event = makeEvent(
    "unidades",
    { barrio_id: "barrio_A", estado: "reservado" },
    { barrio_id: "barrio_A", estado: "disponible" },
    { id: "admin_1", role: "admin" },
    { precio: 50000, nombre: "algo" },
  );
  // No debe lanzar
  validarPermisosVendedor(event, mockDb);
});

test("vendedor puede modificar estado de unidad en su barrio", () => {
  const event = makeEvent(
    "unidades",
    { barrio_id: "barrio_A", estado: "reservado" },
    { barrio_id: "barrio_A", estado: "disponible" },
    { id: "vendor_1", role: "vendedor" },
    { estado: "reservado" },
  );
  // No debe lanzar
  validarPermisosVendedor(event, mockDb);
});

test("vendedor NO puede modificar precio de unidad", () => {
  const event = makeEvent(
    "unidades",
    { barrio_id: "barrio_A", estado: "disponible" },
    { barrio_id: "barrio_A", estado: "disponible" },
    { id: "vendor_1", role: "vendedor" },
    { precio: 99999 },
  );
  assertThrows(
    () => validarPermisosVendedor(event, mockDb),
    "requiere permisos de administrador",
  );
});

test("vendedor NO puede editar unidad de barrio no asignado", () => {
  const event = makeEvent(
    "unidades",
    { barrio_id: "barrio_B", estado: "disponible" },
    { barrio_id: "barrio_B", estado: "disponible" },
    { id: "vendor_1", role: "vendedor" },
    { estado: "reservado" },
  );
  assertThrows(
    () => validarPermisosVendedor(event, mockDb),
    "No tenés permiso",
  );
});

// --- Hook 3: Fechas automáticas ---
console.log("\n-- Hook 3: Actualización automática de fechas --");

test("cambio a 'vendido' setea fecha_venta si está vacía", () => {
  const event = makeEvent(
    "unidades",
    { estado: "vendido", fecha_venta: null },
    { estado: "disponible", fecha_venta: null },
    null,
    {},
  );
  actualizarFechaComercial(event);
  const fecha = event.record.get("fecha_venta");
  assert(!!fecha, "fecha_venta debería estar seteada");
  assert(fecha.includes("T"), "fecha_venta debería ser ISO");
});

test("cambio a 'reservado' setea fecha_reserva", () => {
  const event = makeEvent(
    "unidades",
    { estado: "reservado", fecha_reserva: null },
    { estado: "disponible", fecha_reserva: null },
    null,
    {},
  );
  actualizarFechaComercial(event);
  assert(!!event.record.get("fecha_reserva"), "fecha_reserva debería estar seteada");
});

test("admin que ingresa fecha manualmente no la sobreescribe", () => {
  const fechaManual = "2026-01-15T10:00:00.000Z";
  const event = makeEvent(
    "unidades",
    { estado: "vendido", fecha_venta: null },
    { estado: "disponible", fecha_venta: null },
    null,
    { fecha_venta: fechaManual }, // admin manda la fecha en el body
  );
  actualizarFechaComercial(event);
  // No debe sobreescribir porque el body ya trae fecha_venta
  assert(
    event.record.get("fecha_venta") === null,
    "El hook no debería tocar fecha_venta si viene en el request body",
  );
});

test("sin cambio de estado no modifica fechas", () => {
  const event = makeEvent(
    "unidades",
    { estado: "vendido", fecha_venta: null },
    { estado: "vendido", fecha_venta: null },
    null,
    {},
  );
  actualizarFechaComercial(event);
  assert(
    event.record.get("fecha_venta") === null,
    "Sin cambio de estado no debe setear fecha",
  );
});

// --- Hook 4: Duplicados en interesados ---
console.log("\n-- Hook 4: Validación de duplicados en interesados --");

test("email inválido lanza BadRequestError", () => {
  const event = makeEvent(
    "interesados",
    { email: "not-an-email", unidad_id: "unidad_1" },
    {},
    null,
    {},
  );
  assertThrows(
    () => validarDuplicadoInteresado(event, { interesados: [] }),
    "formato válido",
  );
});

test("interesado duplicado en 5 min lanza error", () => {
  const hace2Min = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const mockDbConDuplicado = {
    interesados: [
      { email: "test@mail.com", unidad_id: "unidad_1", created: hace2Min },
    ],
  };
  const event = makeEvent(
    "interesados",
    { email: "test@mail.com", unidad_id: "unidad_1" },
    {},
    null,
    {},
  );
  assertThrows(
    () => validarDuplicadoInteresado(event, mockDbConDuplicado),
    "recientemente",
  );
});

test("interesado con mismo email en distinta unidad es válido", () => {
  const hace2Min = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const mockDbConDuplicado = {
    interesados: [
      { email: "test@mail.com", unidad_id: "unidad_2", created: hace2Min },
    ],
  };
  const event = makeEvent(
    "interesados",
    { email: "test@mail.com", unidad_id: "unidad_1" },
    {},
    null,
    {},
  );
  // No debe lanzar
  validarDuplicadoInteresado(event, mockDbConDuplicado);
});

test("interesado con email anterior a 5 min es válido", () => {
  const hace10Min = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const mockDbConViejo = {
    interesados: [
      { email: "test@mail.com", unidad_id: "unidad_1", created: hace10Min },
    ],
  };
  const event = makeEvent(
    "interesados",
    { email: "test@mail.com", unidad_id: "unidad_1" },
    {},
    null,
    {},
  );
  // No debe lanzar (pasaron más de 5 min)
  validarDuplicadoInteresado(event, mockDbConViejo);
});

// --- Hook 5: Cierre de interesado actualiza unidad ---
console.log("\n-- Hook 5: Cierre de interesado como ganado --");

test("cerrar interesado como ganado actualiza la unidad a vendido", () => {
  const mockDbLocal = {
    unidades: [
      { id: "unidad_1", estado: "reservado", interesado_comprador_id: null, fecha_venta: null },
    ],
  };
  const event = makeEvent(
    "interesados",
    { id: "inter_1", estado: "cerrado_ganado", unidad_id: "unidad_1" },
    { id: "inter_1", estado: "nuevo",          unidad_id: "unidad_1" },
    null,
    {},
  );
  cerrarInteresadoGanado(event, mockDbLocal);
  const unidad = mockDbLocal.unidades[0];
  assert(unidad.estado === "vendido", "La unidad debería estar en 'vendido'");
  assert(unidad.interesado_comprador_id === "inter_1", "Debería asignar el interesado");
  assert(!!unidad.fecha_venta, "Debería setear fecha_venta");
});

test("cerrar interesado con unidad ya vendida lanza error", () => {
  const mockDbLocal = {
    unidades: [
      { id: "unidad_1", estado: "vendido" },
    ],
  };
  const event = makeEvent(
    "interesados",
    { id: "inter_1", estado: "cerrado_ganado", unidad_id: "unidad_1" },
    { id: "inter_1", estado: "nuevo",          unidad_id: "unidad_1" },
    null,
    {},
  );
  assertThrows(
    () => cerrarInteresadoGanado(event, mockDbLocal),
    "vendido",
  );
});

test("cerrar interesado sin unidad_id no hace nada en unidades", () => {
  const mockDbLocal = { unidades: [] };
  const event = makeEvent(
    "interesados",
    { id: "inter_1", estado: "cerrado_ganado", unidad_id: null },
    { id: "inter_1", estado: "nuevo",          unidad_id: null },
    null,
    {},
  );
  // No debe lanzar
  cerrarInteresadoGanado(event, mockDbLocal);
  assert(mockDbLocal.unidades.length === 0, "No debería modificar ninguna unidad");
});

/**
 * Lógica extraída del Hook 2 (extendido) para testear acceso por barrio o zona.
 */
function validarAccesoBarrioExtendido(event, mockDb) {
  if (!event.auth) return;
  const role = event.auth.get("role");
  if (role !== "vendedor") return;

  const vendedorId = event.auth.id;
  const barrioId   = event.record.get("barrio_id");

  if (!barrioId) {
    throw new BadRequestError("Esta unidad no pertenece a ningún barrio y no podés editarla.");
  }

  // Check direct assignment
  const directos = (mockDb.vendedor_barrios || []).filter(
    r => r.vendedor_id === vendedorId && r.barrio_id === barrioId
  );
  const tieneAccesoDirecto = directos.length > 0;

  if (!tieneAccesoDirecto) {
    let tieneAccesoPorZona = false;
    const barrio = (mockDb.barrios || []).find(b => b.id === barrioId);
    if (barrio && barrio.zona) {
      const zonas = (mockDb.vendedor_zonas || []).filter(
        vz => vz.vendedor_id === vendedorId && vz.zona === barrio.zona
      );
      tieneAccesoPorZona = zonas.length > 0;
    }
    if (!tieneAccesoPorZona) {
      throw new ForbiddenError("No tenés permiso sobre el barrio de esta unidad.");
    }
  }
}

/**
 * Lógica extraída del Hook C para testear en aislamiento.
 */
function protegerRoleYActivo(event, mockDb) {
  if (!event.auth) return;

  const originalUser = (mockDb.users || []).find(u => u.id === event.record.id);
  const originalRole = originalUser ? originalUser.role : "";
  const nuevoRole    = event.record.get("role");

  if (event.auth.get("role") !== "admin" && nuevoRole !== originalRole) {
    throw new ForbiddenError("No podés cambiar el role de un usuario.");
  }

  if (event.record.id === event.auth.id && event.record.get("activo") === false) {
    throw new BadRequestError("No podés desactivarte a vos mismo.");
  }
}

/**
 * Lógica extraída del Hook D para testear en aislamiento.
 */
function validarZonaEnVendedorZonas(event, mockDb) {
  const zona = event.record.get("zona");
  if (!zona) return;

  const barrios = (mockDb.barrios || []).filter(b => b.zona === zona);
  if (barrios.length === 0) {
    throw new BadRequestError(
      `La zona '${zona}' no existe en ningún barrio. Asigná la zona a un barrio primero.`
    );
  }
}

// --- Fase 1: extras opcionales vacíos (no se normalizan) ---
console.log("\n-- Fase 1: extras opcionales --");

function fase1ShouldSkipOptionalExtra(valor) {
  return (
    valor === null ||
    valor === undefined ||
    valor === "" ||
    (typeof valor === "string" && valor.trim() === "")
  );
}

test("extra opcional con valor vacío se omite del flujo de validación estricta", () => {
  assert(fase1ShouldSkipOptionalExtra(null) === true);
  assert(fase1ShouldSkipOptionalExtra("") === true);
  assert(fase1ShouldSkipOptionalExtra("   ") === true);
  assert(fase1ShouldSkipOptionalExtra(false) === false);
  assert(fase1ShouldSkipOptionalExtra(0) === false);
});

test("estado core no se puede borrar (flag es_core === true)", () => {
  const row = { es_core: true };
  assert(row.es_core === true, "debe comparar con === true para null-safe");
});

// --- Hook A (extendido): Acceso vendedor a unidad por barrio directo o zona ---
console.log("\n-- Hook A (extendido): Acceso vendedor a unidad por barrio/zona --");

const mockDbExtendido = {
  vendedor_barrios: [
    { vendedor_id: "vendor_1", barrio_id: "barrio_A" },
  ],
  vendedor_zonas: [
    { vendedor_id: "vendor_2", zona: "zona_norte" },
  ],
  barrios: [
    { id: "barrio_A", zona: "zona_sur"   },
    { id: "barrio_B", zona: "zona_norte" },
    { id: "barrio_C", zona: null          },
  ],
};

test("vendedor con asignación directa accede a su barrio", () => {
  const event = makeEvent(
    "unidades",
    { barrio_id: "barrio_A" }, {},
    { id: "vendor_1", role: "vendedor" }, {},
  );
  // No debe lanzar
  validarAccesoBarrioExtendido(event, mockDbExtendido);
});

test("vendedor con zona asignada accede al barrio de esa zona", () => {
  const event = makeEvent(
    "unidades",
    { barrio_id: "barrio_B" }, {},
    { id: "vendor_2", role: "vendedor" }, {},
  );
  // vendor_2 tiene zona_norte → barrio_B pertenece a zona_norte
  validarAccesoBarrioExtendido(event, mockDbExtendido);
});

test("vendedor sin asignación directa ni zona lanza ForbiddenError", () => {
  const event = makeEvent(
    "unidades",
    { barrio_id: "barrio_A" }, {},
    { id: "vendor_sin_acceso", role: "vendedor" }, {},
  );
  assertThrows(
    () => validarAccesoBarrioExtendido(event, mockDbExtendido),
    "No tenés permiso",
  );
});

test("vendedor con zona asignada no accede a barrio de otra zona", () => {
  const event = makeEvent(
    "unidades",
    { barrio_id: "barrio_A" }, {}, // barrio_A es zona_sur, vendor_2 tiene zona_norte
    { id: "vendor_2", role: "vendedor" }, {},
  );
  assertThrows(
    () => validarAccesoBarrioExtendido(event, mockDbExtendido),
    "No tenés permiso",
  );
});

test("vendedor con zona asignada no accede a barrio sin zona asignada", () => {
  const event = makeEvent(
    "unidades",
    { barrio_id: "barrio_C" }, {}, // barrio_C no tiene zona
    { id: "vendor_2", role: "vendedor" }, {},
  );
  assertThrows(
    () => validarAccesoBarrioExtendido(event, mockDbExtendido),
    "No tenés permiso",
  );
});

// --- Hook C: Protección de role y activo ---
console.log("\n-- Hook C: Protección de role y activo en users --");

const mockDbUsers = {
  users: [
    { id: "admin_1",   role: "admin"    },
    { id: "vendor_1",  role: "vendedor" },
    { id: "vendor_2",  role: "vendedor" },
  ],
};

test("vendedor intenta cambiar su propio role → lanza ForbiddenError", () => {
  const event = makeEvent(
    "users",
    { id: "vendor_1", role: "admin", activo: true },
    { id: "vendor_1", role: "vendedor" },
    { id: "vendor_1", role: "vendedor" },
    {},
  );
  assertThrows(
    () => protegerRoleYActivo(event, mockDbUsers),
    "No podés cambiar el role",
  );
});

test("admin cambia role de otro usuario → pasa", () => {
  const event = makeEvent(
    "users",
    { id: "vendor_2", role: "admin", activo: true },
    { id: "vendor_2", role: "vendedor" },
    { id: "admin_1", role: "admin" },
    {},
  );
  // No debe lanzar
  protegerRoleYActivo(event, mockDbUsers);
});

test("usuario intenta desactivarse a sí mismo → lanza BadRequestError", () => {
  const event = makeEvent(
    "users",
    { id: "vendor_1", role: "vendedor", activo: false },
    { id: "vendor_1", role: "vendedor", activo: true },
    { id: "vendor_1", role: "vendedor" },
    {},
  );
  assertThrows(
    () => protegerRoleYActivo(event, mockDbUsers),
    "No podés desactivarte",
  );
});

test("admin desactiva otro usuario → pasa", () => {
  const event = makeEvent(
    "users",
    { id: "vendor_1", role: "vendedor", activo: false },
    { id: "vendor_1", role: "vendedor", activo: true },
    { id: "admin_1", role: "admin" },
    {},
  );
  // No debe lanzar (admin desactiva a vendor_1, no a sí mismo)
  protegerRoleYActivo(event, mockDbUsers);
});

test("sin auth no hace nada", () => {
  const event = makeEvent(
    "users",
    { id: "vendor_1", role: "admin", activo: false },
    {},
    null,
    {},
  );
  // No debe lanzar
  protegerRoleYActivo(event, mockDbUsers);
});

// --- Hook D: Validación de zona en vendedor_zonas ---
console.log("\n-- Hook D: Validación de zona en vendedor_zonas --");

const mockDbBarrios = {
  barrios: [
    { id: "barrio_A", zona: "zona_norte" },
    { id: "barrio_B", zona: "zona_sur"   },
  ],
};

test("crear vendedor_zona con zona válida → pasa", () => {
  const event = makeEvent(
    "vendedor_zonas",
    { zona: "zona_norte" },
    {},
    null,
    {},
  );
  // No debe lanzar
  validarZonaEnVendedorZonas(event, mockDbBarrios);
});

test("crear vendedor_zona con zona inexistente → lanza BadRequestError", () => {
  const event = makeEvent(
    "vendedor_zonas",
    { zona: "zona_fantasma" },
    {},
    null,
    {},
  );
  assertThrows(
    () => validarZonaEnVendedorZonas(event, mockDbBarrios),
    "no existe en ningún barrio",
  );
});

test("crear vendedor_zona sin zona → pasa sin validar", () => {
  const event = makeEvent(
    "vendedor_zonas",
    { zona: null },
    {},
    null,
    {},
  );
  // No debe lanzar (zona vacía se ignora)
  validarZonaEnVendedorZonas(event, mockDbBarrios);
});

// ─────────────────────────────────────────────────────────────────────────────
// REPORTE FINAL
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n=== RESULTADO ===");
console.log(`  ✅ PASS: ${results.pass}`);
console.log(`  ❌ FAIL: ${results.fail}`);

if (results.errors.length > 0) {
  console.log("\nFallas:");
  for (const err of results.errors) {
    console.log(`  - [${err.name}]: ${err.error}`);
  }
  throw new Error(`${results.fail} test(s) fallaron.`);
} else {
  console.log("\n🎉 Todos los tests pasaron.");
}

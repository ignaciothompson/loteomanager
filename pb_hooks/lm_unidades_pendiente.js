/**
 * Marca pendiente_publicar=true en create/update de unidades,
 * salvo cuando el update solo limpia el flag (publicación).
 */

function lmShouldForcePendiente(body) {
  if (!body || typeof body !== "object") return true;
  const keys = Object.keys(body);
  if (keys.length === 1 && keys[0] === "pendiente_publicar" && body.pendiente_publicar === false) {
    return false;
  }
  if (
    Object.prototype.hasOwnProperty.call(body, "pendiente_publicar") &&
    body.pendiente_publicar === false &&
    keys.every((k) => k === "pendiente_publicar")
  ) {
    return false;
  }
  return true;
}

function lmForcePendientePublicar(e, isCreate) {
  const body = e.requestInfo().body || {};
  if (!isCreate && !lmShouldForcePendiente(body)) {
    return;
  }
  e.record.set("pendiente_publicar", true);
}

module.exports = {
  lmForcePendientePublicar,
  lmShouldForcePendiente,
};

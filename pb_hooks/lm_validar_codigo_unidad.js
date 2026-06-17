/**
 * Validación código único por barrio en unidades.
 * require() dentro de cada handler — los callbacks no ven el scope de main.pb.js.
 */

function lmValidarCodigoUnicoUnidad(record, excludeId) {
  const codigo = String(record.get("codigo") || "").trim();
  const barrioId = record.get("barrio_id");
  if (!codigo) {
    throw new BadRequestError("El código de la unidad es obligatorio.");
  }
  if (!barrioId) return;

  let filtro = `barrio_id = '${barrioId}' && codigo = '${codigo.replace(/'/g, "''")}'`;
  if (excludeId) filtro += ` && id != '${excludeId}'`;

  let duplicados = [];
  try {
    duplicados = $app.findRecordsByFilter("unidades", filtro, "-created", 1, 0);
  } catch (_e) {}

  if (duplicados && duplicados.length > 0) {
    throw new BadRequestError(
      `Ya existe una unidad con código '${codigo}' en este barrio. Elegí otro código.`,
    );
  }
}

module.exports = {
  lmValidarCodigoUnicoUnidad,
};

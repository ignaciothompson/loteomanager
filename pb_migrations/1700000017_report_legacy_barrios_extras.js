/// <reference path="../pb_data/types.d.ts" />

/**
 * Identifica barrios con `extras` en formato legado (no es un array del nuevo sistema).
 * No transforma datos: solo reporte (consola + archivo en pb_data si $os está disponible).
 */
migrate((app) => {
  const report = {
    generated_at: new Date().toISOString(),
    legacy_barrio_ids: [],
    notes:
      "Formato nuevo: extras = [{ extra_id, code, nombre, valor }, ...]. Objetos sueltos u otros shapes quedan listados aquí.",
  };

  let barrios = [];
  try {
    barrios = app.findAllRecords("barrios");
  } catch (_e) {
    return;
  }

  function isNewExtrasShape(val) {
    if (!Array.isArray(val)) return false;
    if (val.length === 0) return true;
    const first = val[0];
    return (
      first &&
      typeof first === "object" &&
      typeof first.extra_id === "string" &&
      typeof first.code === "string"
    );
  }

  for (const r of barrios) {
    const raw = r.get("extras");
    if (raw === null || raw === undefined) continue;
    if (typeof raw === "string" && raw.trim() === "") continue;
    if (Array.isArray(raw) && raw.length === 0) continue;
    if (isNewExtrasShape(raw)) continue;
    report.legacy_barrio_ids.push(r.id);
  }

  if (report.legacy_barrio_ids.length > 0) {
    console.warn(
      "[1700000017] barrios con extras legados:",
      JSON.stringify(report.legacy_barrio_ids),
    );
  }

  try {
    if (typeof $os !== "undefined" && $os.writeFile) {
      $os.writeFile(
        "pb_data/extras_migration_report.json",
        JSON.stringify(report, null, 2),
        420,
      );
    }
  } catch (err) {
    console.warn("[1700000017] no se pudo escribir pb_data/extras_migration_report.json:", err);
  }
}, (_app) => {
  /* reporte opcional: no revertir archivo en down */
});

/// <reference path="../pb_data/types.d.ts" />

/**
 * Importador v3 — correcciones_sugeridas, mapeo_geografia;
 * decision_usuario sin "actualizar".
 */
migrate((app) => {
  const filas = app.findCollectionByNameOrId("importacion_filas");

  if (!filas.fields.getByName("correcciones_sugeridas")) {
    filas.fields.addAt(filas.fields.length, new JSONField({
      name: "correcciones_sugeridas",
      required: false,
    }));
  }

  const decision = filas.fields.getByName("decision_usuario");
  if (decision && decision.type === "select") {
    decision.values = ["pendiente", "omitir", "crear"];
  }

  app.save(filas);

  const records = app.findAllRecords("importacion_filas");
  for (const rec of records) {
    if (rec.get("decision_usuario") === "actualizar") {
      rec.set("decision_usuario", "omitir");
      app.save(rec);
    }
  }

  const imp = app.findCollectionByNameOrId("importaciones");
  if (!imp.fields.getByName("mapeo_geografia")) {
    imp.fields.addAt(imp.fields.length, new JSONField({
      name: "mapeo_geografia",
      required: false,
    }));
  }
  app.save(imp);
}, (app) => {
  const filas = app.findCollectionByNameOrId("importacion_filas");
  const c = filas.fields.getByName("correcciones_sugeridas");
  if (c) filas.fields.remove(c);
  const decision = filas.fields.getByName("decision_usuario");
  if (decision && decision.type === "select") {
    decision.values = ["pendiente", "omitir", "crear", "actualizar"];
  }
  app.save(filas);

  const imp = app.findCollectionByNameOrId("importaciones");
  const m = imp.fields.getByName("mapeo_geografia");
  if (m) imp.fields.remove(m);
  app.save(imp);
});

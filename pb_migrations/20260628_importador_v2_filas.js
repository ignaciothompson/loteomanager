/// <reference path="../pb_data/types.d.ts" />

/**
 * Importador v2 — ref_barrio / barrio_resuelto_id en filas;
 * tipo barrios_y_unidades y estado confirmando en importaciones.
 */
migrate((app) => {
  const filas = app.findCollectionByNameOrId("importacion_filas");

  filas.fields.addAt(filas.fields.length, new TextField({
    name: "ref_barrio",
    required: false,
  }));

  filas.fields.addAt(filas.fields.length, new TextField({
    name: "barrio_resuelto_id",
    required: false,
  }));

  app.save(filas);

  const imp = app.findCollectionByNameOrId("importaciones");
  const tipoField = imp.fields.getByName("tipo");
  if (tipoField && tipoField.type === "select") {
    const values = new Set(tipoField.values ?? []);
    values.add("barrios_y_unidades");
    tipoField.values = [...values];
  }

  const estadoField = imp.fields.getByName("estado");
  if (estadoField && estadoField.type === "select") {
    const values = new Set(estadoField.values ?? []);
    values.add("confirmando");
    estadoField.values = [...values];
  }

  app.save(imp);
}, (app) => {
  const filas = app.findCollectionByNameOrId("importacion_filas");
  for (const name of ["ref_barrio", "barrio_resuelto_id"]) {
    const f = filas.fields.getByName(name);
    if (f) filas.fields.remove(f);
  }
  app.save(filas);
});

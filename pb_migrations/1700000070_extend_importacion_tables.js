/// <reference path="../pb_data/types.d.ts" />

/**
 * Extiende importaciones e importacion_filas con campos requeridos por el módulo importador.
 *
 * importaciones: agrega nombre_archivo, mapeo_columnas, mapeo_extras
 * importacion_filas: agrega tipo_fila, mensajes (json array), registro_creado_id, error_aplicacion
 */
migrate((app) => {
  // --- importaciones ---
  const imp = app.findCollectionByNameOrId("importaciones");

  imp.fields.addAt(imp.fields.length, new TextField({
    name: "nombre_archivo",
    required: false,
  }));

  imp.fields.addAt(imp.fields.length, new JSONField({
    name: "mapeo_columnas",
    required: false,
  }));

  imp.fields.addAt(imp.fields.length, new JSONField({
    name: "mapeo_extras",
    required: false,
  }));

  app.save(imp);

  // --- importacion_filas ---
  const filas = app.findCollectionByNameOrId("importacion_filas");

  filas.fields.addAt(filas.fields.length, new SelectField({
    name: "tipo_fila",
    values: ["barrio", "unidad"],
    required: true,
    maxSelect: 1,
  }));

  filas.fields.addAt(filas.fields.length, new JSONField({
    name: "mensajes",
    required: false,
  }));

  filas.fields.addAt(filas.fields.length, new TextField({
    name: "registro_creado_id",
    required: false,
  }));

  filas.fields.addAt(filas.fields.length, new TextField({
    name: "error_aplicacion",
    required: false,
  }));

  app.save(filas);

}, (app) => {
  // --- rollback importacion_filas ---
  const filas = app.findCollectionByNameOrId("importacion_filas");
  for (const name of ["tipo_fila", "mensajes", "registro_creado_id", "error_aplicacion"]) {
    const f = filas.fields.getByName(name);
    if (f) filas.fields.remove(f);
  }
  app.save(filas);

  // --- rollback importaciones ---
  const imp = app.findCollectionByNameOrId("importaciones");
  for (const name of ["nombre_archivo", "mapeo_columnas", "mapeo_extras"]) {
    const f = imp.fields.getByName(name);
    if (f) imp.fields.remove(f);
  }
  app.save(imp);
});

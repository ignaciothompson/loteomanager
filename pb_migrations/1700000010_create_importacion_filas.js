/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const importacionesCol = app.findCollectionByNameOrId("importaciones");

  const collection = new Collection({
    name: "importacion_filas",
    type: "base",
    fields: [
      { name: "importacion_id", type: "relation", collectionId: importacionesCol.id, required: true, maxSelect: 1 },
      { name: "numero_fila",        type: "number", required: true },
      { name: "datos_originales",   type: "json" },
      { name: "datos_normalizados", type: "json" },
      { name: "estado_fila", type: "select", values: ["ok","duplicado","error","advertencia"], required: true, maxSelect: 1 },
      { name: "mensaje",               type: "text" },
      { name: "registro_existente_id", type: "text" },
      { name: "decision_usuario", type: "select", values: ["pendiente","omitir","crear","actualizar"], maxSelect: 1 },
      { name: "aplicada", type: "bool" },
    ],
  });

  collection.listRule   = "@request.auth.role = 'admin' || importacion_id.creado_por = @request.auth.id";
  collection.viewRule   = "@request.auth.role = 'admin' || importacion_id.creado_por = @request.auth.id";
  collection.createRule = "@request.auth.id != ''";
  collection.updateRule = "@request.auth.id != '' && importacion_id.creado_por = @request.auth.id";
  collection.deleteRule = "@request.auth.role = 'admin'";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("importacion_filas");
  app.delete(collection);
});

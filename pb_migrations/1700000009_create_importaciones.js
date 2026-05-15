/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");

  const collection = new Collection({
    name: "importaciones",
    type: "base",
    fields: [
      { name: "tipo",    type: "select", values: ["barrios","unidades","barrios_con_unidades"], required: true, maxSelect: 1 },
      { name: "origen",  type: "select", values: ["excel","api"], required: true, maxSelect: 1 },
      { name: "estado",  type: "select", values: ["analizando","listo_para_confirmar","confirmada","descartada","con_errores"], required: true, maxSelect: 1 },
      { name: "archivo_origen", type: "file", maxSelect: 1, maxSize: 52428800, mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-excel","text/csv"] },
      { name: "total_filas",       type: "number" },
      { name: "filas_ok",          type: "number" },
      { name: "filas_duplicado",   type: "number" },
      { name: "filas_error",       type: "number" },
      { name: "filas_advertencia", type: "number" },
      { name: "creado_por",    type: "relation", collectionId: usersCol.id, required: true, maxSelect: 1 },
      { name: "confirmada_en", type: "date" },
    ],
  });

  collection.listRule   = "@request.auth.role = 'admin' || creado_por = @request.auth.id";
  collection.viewRule   = "@request.auth.role = 'admin' || creado_por = @request.auth.id";
  collection.createRule = "@request.auth.id != ''";
  collection.updateRule = "@request.auth.id != '' && creado_por = @request.auth.id";
  collection.deleteRule = "@request.auth.role = 'admin'";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("importaciones");
  app.delete(collection);
});

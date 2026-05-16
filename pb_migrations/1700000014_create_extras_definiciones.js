/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    name: "extras_definiciones",
    type: "base",
    fields: [
      { name: "code", type: "text", required: true },
      {
        name: "entidad",
        type: "select",
        values: ["barrios", "unidades", "interesados"],
        required: true,
        maxSelect: 1,
      },
      { name: "nombre", type: "text", required: true },
      { name: "descripcion", type: "text" },
      {
        name: "tipo",
        type: "select",
        values: ["texto", "numero", "opciones", "booleano", "fecha"],
        required: true,
        maxSelect: 1,
      },
      { name: "opciones", type: "json" },
      { name: "requerido", type: "bool", required: false },
      { name: "visible_en_lista", type: "bool", required: false },
      { name: "visible_en_landing", type: "bool", required: false },
      { name: "visible_en_comparativa", type: "bool", required: false },
      { name: "orden_display", type: "number", required: false },
      { name: "grupo", type: "text" },
      { name: "activo", type: "bool", required: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_extras_def_entidad_code ON extras_definiciones (entidad, code)",
      "CREATE INDEX idx_extras_def_entidad_activo_orden ON extras_definiciones (entidad, activo, orden_display)",
    ],
  });

  collection.listRule = '@request.auth.id != ""';
  collection.viewRule = '@request.auth.id != ""';
  collection.createRule = '@request.auth.role = "admin"';
  collection.updateRule = '@request.auth.role = "admin"';
  collection.deleteRule = '@request.auth.role = "admin"';

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("extras_definiciones");
  app.delete(collection);
});

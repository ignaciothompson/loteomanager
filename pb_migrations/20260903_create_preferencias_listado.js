/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");

  const collection = new Collection({
    name: "preferencias_listado",
    type: "base",
    fields: [
      { name: "user_id", type: "relation", collectionId: usersCol.id, required: true, maxSelect: 1 },
      {
        name: "listado",
        type: "select",
        values: ["barrios", "interesados"],
        required: true,
        maxSelect: 1,
      },
      { name: "columnas", type: "json" },
      { name: "orden", type: "json" },
      { name: "filtros", type: "json" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_preferencias_listado_user_listado ON preferencias_listado (user_id, listado)",
    ],
  });

  collection.listRule = "user_id = @request.auth.id";
  collection.viewRule = "user_id = @request.auth.id";
  collection.createRule = "user_id = @request.auth.id";
  collection.updateRule = "user_id = @request.auth.id";
  collection.deleteRule = "user_id = @request.auth.id";

  app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("preferencias_listado");
    app.delete(collection);
  } catch (_e) {}
});

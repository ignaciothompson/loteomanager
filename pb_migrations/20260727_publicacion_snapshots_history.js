/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const barriosCol = app.findCollectionByNameOrId("barrios");
  const usersCol = app.findCollectionByNameOrId("users");

  const collection = new Collection({
    name: "publicacion_historial",
    type: "base",
    fields: [
      { name: "barrio_id", type: "relation", collectionId: barriosCol.id, required: true, maxSelect: 1 },
      { name: "snapshot", type: "json", required: true },
      { name: "publicado_at", type: "date", required: false },
      { name: "publicado_por", type: "relation", collectionId: usersCol.id, required: false, maxSelect: 1 },
    ],
  });

  collection.listRule   = "@request.auth.role = 'admin'";
  collection.viewRule   = "@request.auth.role = 'admin'";
  collection.createRule = "@request.auth.role = 'admin'";
  collection.updateRule = "";
  collection.deleteRule = "";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("publicacion_historial");
  app.delete(collection);
});

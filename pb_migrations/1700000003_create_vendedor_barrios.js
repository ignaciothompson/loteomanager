/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersCol  = app.findCollectionByNameOrId("users");
  const barriosCol = app.findCollectionByNameOrId("barrios");

  const collection = new Collection({
    name: "vendedor_barrios",
    type: "base",
    fields: [
      {
        name: "vendedor_id",
        type: "relation",
        collectionId: usersCol.id,
        required: true,
        maxSelect: 1,
      },
      {
        name: "barrio_id",
        type: "relation",
        collectionId: barriosCol.id,
        required: true,
        maxSelect: 1,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_vendedor_barrio ON vendedor_barrios (vendedor_id, barrio_id)",
    ],
  });

  collection.listRule   = "@request.auth.id != '' && (@request.auth.role = 'admin' || vendedor_id = @request.auth.id)";
  collection.viewRule   = "@request.auth.id != '' && (@request.auth.role = 'admin' || vendedor_id = @request.auth.id)";
  collection.createRule = "@request.auth.role = 'admin'";
  collection.updateRule = "@request.auth.role = 'admin'";
  collection.deleteRule = "@request.auth.role = 'admin'";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("vendedor_barrios");
  app.delete(collection);
});

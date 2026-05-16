/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    name: "vendedor_zonas",
    type: "base",
    listRule: `@request.auth.id != "" && (@request.auth.role = "admin" || vendedor_id = @request.auth.id)`,
    viewRule: `@request.auth.id != "" && (@request.auth.role = "admin" || vendedor_id = @request.auth.id)`,
    createRule: `@request.auth.role = "admin"`,
    updateRule: `@request.auth.role = "admin"`,
    deleteRule: `@request.auth.role = "admin"`,
  });

  collection.fields.add(new RelationField({
    name: "vendedor_id",
    collectionId: app.findCollectionByNameOrId("users").id,
    required: true,
    maxSelect: 1,
    cascadeDelete: false,
  }));

  collection.fields.add(new TextField({
    name: "zona",
    required: true,
  }));

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("vendedor_zonas");

  app.delete(collection);
});

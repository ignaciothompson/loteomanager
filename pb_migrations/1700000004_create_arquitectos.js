/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    name: "arquitectos",
    type: "base",
    fields: [
      { name: "nombre",    type: "text",  required: true },
      { name: "matricula", type: "text" },
      { name: "email",     type: "email" },
      { name: "telefono",  type: "text" },
      { name: "notas",     type: "editor" },
    ],
  });

  collection.listRule   = "@request.auth.id != ''";
  collection.viewRule   = "@request.auth.id != ''";
  collection.createRule = "@request.auth.role = 'admin'";
  collection.updateRule = "@request.auth.role = 'admin'";
  collection.deleteRule = "@request.auth.role = 'admin'";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("arquitectos");
  app.delete(collection);
});

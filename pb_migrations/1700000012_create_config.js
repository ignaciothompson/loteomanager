/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");

  const collection = new Collection({
    name: "config",
    type: "base",
    fields: [
      { name: "responsable_default_id", type: "relation", collectionId: usersCol.id, required: true, maxSelect: 1 },
      { name: "whatsapp_notif_enabled", type: "bool" },
      { name: "email_notif_enabled",    type: "bool" },
      { name: "mensaje_bienvenida_landing",              type: "editor" },
      { name: "comparativa_expiracion_default_dias",     type: "number" },
    ],
  });

  collection.listRule   = "@request.auth.id != ''";
  collection.viewRule   = "@request.auth.id != ''";
  collection.createRule = "";
  collection.updateRule = "@request.auth.role = 'admin'";
  collection.deleteRule = "";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("config");
  app.delete(collection);
});

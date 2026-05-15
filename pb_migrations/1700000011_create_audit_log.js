/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");

  const collection = new Collection({
    name: "audit_log",
    type: "base",
    fields: [
      { name: "user_id",         type: "relation", collectionId: usersCol.id, required: false, maxSelect: 1 },
      { name: "collection_name", type: "text",   required: true },
      { name: "record_id",       type: "text",   required: true },
      { name: "action", type: "select", values: ["create","update","delete"], required: true, maxSelect: 1 },
      { name: "before", type: "json" },
      { name: "after",  type: "json" },
    ],
  });

  collection.listRule   = "@request.auth.role = 'admin'";
  collection.viewRule   = "@request.auth.role = 'admin'";
  collection.createRule = "";
  collection.updateRule = "";
  collection.deleteRule = "";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("audit_log");
  app.delete(collection);
});

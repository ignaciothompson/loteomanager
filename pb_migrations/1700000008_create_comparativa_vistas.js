/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const comparativasCol = app.findCollectionByNameOrId("comparativas");

  const collection = new Collection({
    name: "comparativa_vistas",
    type: "base",
    fields: [
      { name: "comparativa_id", type: "relation", collectionId: comparativasCol.id, required: true, maxSelect: 1 },
      { name: "accessed_at", type: "date" },
      { name: "ip_hash",     type: "text" },
      { name: "user_agent",  type: "text" },
    ],
  });

  collection.listRule   = "@request.auth.role = 'admin' || (@request.auth.id != '' && comparativa_id.creado_por = @request.auth.id)";
  collection.viewRule   = "@request.auth.role = 'admin' || (@request.auth.id != '' && comparativa_id.creado_por = @request.auth.id)";
  collection.createRule = "@request.auth.id != ''";
  collection.updateRule = "";
  collection.deleteRule = "";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("comparativa_vistas");
  app.delete(collection);
});

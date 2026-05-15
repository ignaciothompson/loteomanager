/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const unidadesCol = app.findCollectionByNameOrId("unidades");
  const usersCol    = app.findCollectionByNameOrId("users");

  const collection = new Collection({
    name: "interesados",
    type: "base",
    fields: [
      { name: "unidad_id",    type: "relation", collectionId: unidadesCol.id, required: false, maxSelect: 1 },
      { name: "nombre",   type: "text",  required: true },
      { name: "email",    type: "email", required: true },
      { name: "telefono", type: "text" },
      { name: "mensaje",  type: "text" },
      { name: "origen", type: "select", values: ["web","manual"], required: true, maxSelect: 1 },
      { name: "estado", type: "select", values: ["nuevo","contactado","reunion","oferta","cerrado_ganado","cerrado_perdido"], required: true, maxSelect: 1 },
      { name: "responsable_id", type: "relation", collectionId: usersCol.id, required: false, maxSelect: 1 },
      { name: "hubspot_contact_id", type: "text" },
      { name: "hubspot_deal_id",    type: "text" },
      { name: "sync_status", type: "select", values: ["pending","synced","error"], maxSelect: 1 },
      { name: "sync_error",  type: "text" },
      { name: "synced_at",   type: "date" },
      { name: "notas_internas", type: "editor" },
    ],
  });

  collection.listRule   = "@request.auth.id != ''";
  collection.viewRule   = "@request.auth.id != ''";
  collection.createRule = "@request.auth.id != ''";
  collection.updateRule = "@request.auth.id != ''";
  collection.deleteRule = "@request.auth.role = 'admin'";

  app.save(collection);

  // Backfill unidades with interesado_comprador_id relation
  unidadesCol.fields.add(new RelationField({
    name: "interesado_comprador_id",
    collectionId: collection.id,
    required: false,
    maxSelect: 1,
  }));
  app.save(unidadesCol);
}, (app) => {
  try {
    const unidades = app.findCollectionByNameOrId("unidades");
    unidades.fields.removeByName("interesado_comprador_id");
    app.save(unidades);
  } catch (_e) {}

  const collection = app.findCollectionByNameOrId("interesados");
  app.delete(collection);
});

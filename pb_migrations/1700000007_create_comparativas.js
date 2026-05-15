/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const unidadesCol    = app.findCollectionByNameOrId("unidades");
  const usersCol       = app.findCollectionByNameOrId("users");
  const interesadosCol = app.findCollectionByNameOrId("interesados");

  const collection = new Collection({
    name: "comparativas",
    type: "base",
    fields: [
      { name: "tipo",         type: "select", values: ["propuesta_individual","comparacion_multiple"], required: true, maxSelect: 1 },
      { name: "token_publico", type: "text",  required: true },
      { name: "titulo",        type: "text",  required: true },
      { name: "mensaje_personalizado", type: "editor" },
      { name: "unidades_ids", type: "relation", collectionId: unidadesCol.id, required: true, maxSelect: 5 },
      { name: "cliente_destinatario_nombre", type: "text" },
      { name: "cliente_destinatario_email",  type: "email" },
      { name: "creado_por", type: "relation", collectionId: usersCol.id, required: true, maxSelect: 1 },
      { name: "expira_en",    type: "date" },
      { name: "vistas_count", type: "number" },
      { name: "pdf_generado", type: "file", maxSelect: 1, maxSize: 20971520, mimeTypes: ["application/pdf"] },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_comparativas_token ON comparativas (token_publico)",
    ],
  });

  collection.listRule   = "@request.auth.id != ''";
  collection.viewRule   = "@request.auth.id != ''";
  collection.createRule = "@request.auth.id != ''";
  collection.updateRule = "@request.auth.id != '' && creado_por = @request.auth.id";
  collection.deleteRule = "@request.auth.role = 'admin' || creado_por = @request.auth.id";

  app.save(collection);

  // Add comparativa_id relation to interesados
  interesadosCol.fields.add(new RelationField({
    name: "comparativa_id",
    collectionId: collection.id,
    required: false,
    maxSelect: 1,
  }));
  app.save(interesadosCol);
}, (app) => {
  try {
    const interesados = app.findCollectionByNameOrId("interesados");
    interesados.fields.removeByName("comparativa_id");
    app.save(interesados);
  } catch (_e) {}

  const collection = app.findCollectionByNameOrId("comparativas");
  app.delete(collection);
});

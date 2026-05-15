/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    name: "barrios",
    type: "base",
    fields: [
      { name: "slug",            type: "text",   required: true },
      { name: "nombre",          type: "text",   required: true },
      { name: "descripcion",     type: "editor" },
      { name: "ubicacion_texto", type: "text" },
      { name: "lat",             type: "number" },
      { name: "lng",             type: "number" },
      {
        name: "plano_general",
        type: "file",
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/svg+xml", "image/jpeg", "image/png", "image/webp"],
      },
      {
        name: "imagen_portada",
        type: "file",
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      },
      {
        name: "estado",
        type: "select",
        values: ["activo", "en_desarrollo", "pausado"],
        required: true,
        maxSelect: 1,
      },
      { name: "destacado", type: "bool" },
    ],
  });

  collection.listRule   = "@request.auth.id != ''";
  collection.viewRule   = "@request.auth.id != ''";
  collection.createRule = "@request.auth.role = 'admin'";
  collection.updateRule = "@request.auth.role = 'admin'";
  collection.deleteRule = "@request.auth.role = 'admin'";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("barrios");
  app.delete(collection);
});

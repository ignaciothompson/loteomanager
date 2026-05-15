/// <reference path="../pb_data/types.d.ts" />

// NOTE: interesado_comprador_id is added in migration 1700000006 after interesados exists.

migrate((app) => {
  const barriosCol     = app.findCollectionByNameOrId("barrios");
  const usersCol       = app.findCollectionByNameOrId("users");
  const arquitectosCol = app.findCollectionByNameOrId("arquitectos");

  const collection = new Collection({
    name: "unidades",
    type: "base",
    fields: [
      { name: "tipo_unidad",  type: "select", values: ["lote","casa","departamento"], required: true, maxSelect: 1 },
      { name: "codigo_interno", type: "text", required: true },
      { name: "barrio_id",    type: "relation", collectionId: barriosCol.id, required: false, maxSelect: 1 },
      { name: "numero_unidad",   type: "text" },
      { name: "direccion_propia", type: "text" },
      { name: "metros_cuadrados",   type: "number", required: true, min: 0 },
      { name: "metros_construidos", type: "number" },
      { name: "ambientes",          type: "number" },
      { name: "antiguedad_anios",   type: "number" },
      { name: "cocheras",           type: "number" },
      { name: "precio",   type: "number", required: true, min: 0 },
      { name: "moneda",   type: "select", values: ["USD","ARS"], required: true, maxSelect: 1 },
      { name: "oferta",        type: "bool" },
      { name: "precio_oferta", type: "number" },
      { name: "destacado",     type: "bool" },
      { name: "estado", type: "select", values: ["disponible","bloqueado","reservado","sena","vendido","escriturado"], required: true, maxSelect: 1 },
      { name: "fecha_ingreso",   type: "date" },
      { name: "fecha_bloqueo",   type: "date" },
      { name: "fecha_reserva",   type: "date" },
      { name: "fecha_sena",      type: "date" },
      { name: "fecha_venta",     type: "date" },
      { name: "fecha_escritura", type: "date" },
      { name: "responsable_id", type: "relation", collectionId: usersCol.id,       required: true,  maxSelect: 1 },
      { name: "arquitecto_id",  type: "relation", collectionId: arquitectosCol.id, required: false, maxSelect: 1 },
      { name: "descripcion", type: "editor" },
      { name: "galeria",     type: "file", maxSelect: 10, maxSize: 5242880,  mimeTypes: ["image/jpeg","image/png","image/webp","image/gif"] },
      { name: "plano_unidad",type: "file", maxSelect: 1,  maxSize: 10485760, mimeTypes: ["image/jpeg","image/png","image/webp","application/pdf"] },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_unidades_codigo_interno ON unidades (codigo_interno)",
    ],
  });

  collection.listRule   = "@request.auth.id != ''";
  collection.viewRule   = "@request.auth.id != ''";
  collection.createRule = "@request.auth.role = 'admin'";
  collection.updateRule = "@request.auth.id != ''";
  collection.deleteRule = "@request.auth.role = 'admin'";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("unidades");
  app.delete(collection);
});

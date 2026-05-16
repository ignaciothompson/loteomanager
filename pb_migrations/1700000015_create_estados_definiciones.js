/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    name: "estados_definiciones",
    type: "base",
    fields: [
      { name: "code", type: "text", required: true },
      {
        name: "entidad",
        type: "select",
        values: ["unidades", "interesados"],
        required: true,
        maxSelect: 1,
      },
      { name: "nombre", type: "text", required: true },
      { name: "color", type: "text", required: false },
      { name: "icono", type: "text" },
      { name: "es_core", type: "bool", required: false },
      { name: "orden_display", type: "number", required: false },
      { name: "activo", type: "bool", required: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_estados_def_entidad_code ON estados_definiciones (entidad, code)",
      "CREATE INDEX idx_estados_def_entidad_activo_orden ON estados_definiciones (entidad, activo, orden_display)",
    ],
  });

  collection.listRule = '@request.auth.id != ""';
  collection.viewRule = '@request.auth.id != ""';
  collection.createRule = '@request.auth.role = "admin"';
  collection.updateRule = '@request.auth.role = "admin"';
  collection.deleteRule = '@request.auth.role = "admin"';

  app.save(collection);

  const col = app.findCollectionByNameOrId("estados_definiciones");

  const seedUnidades = [
    { code: "disponible", nombre: "Disponible", color: "#22c55e", orden: 1 },
    { code: "bloqueado", nombre: "Bloqueado", color: "#94a3b8", orden: 2 },
    { code: "reservado", nombre: "Reservado", color: "#eab308", orden: 3 },
    { code: "sena", nombre: "Seña", color: "#f97316", orden: 4 },
    { code: "vendido", nombre: "Vendido", color: "#ef4444", orden: 5 },
    { code: "escriturado", nombre: "Escriturado", color: "#a855f7", orden: 6 },
  ];
  for (const s of seedUnidades) {
    const r = new Record(col);
    r.set("entidad", "unidades");
    r.set("code", s.code);
    r.set("nombre", s.nombre);
    r.set("color", s.color);
    r.set("orden_display", s.orden);
    r.set("es_core", true);
    r.set("activo", true);
    app.save(r);
  }

  const seedInteresados = [
    { code: "nuevo", nombre: "Nuevo", color: "#3b82f6", orden: 1 },
    { code: "contactado", nombre: "Contactado", color: "#38bdf8", orden: 2 },
    { code: "reunion", nombre: "Reunión", color: "#8b5cf6", orden: 3 },
    { code: "oferta", nombre: "Oferta", color: "#f97316", orden: 4 },
    { code: "cerrado_ganado", nombre: "Cerrado / Ganado", color: "#22c55e", orden: 5 },
    { code: "cerrado_perdido", nombre: "Cerrado / Perdido", color: "#94a3b8", orden: 6 },
  ];
  for (const s of seedInteresados) {
    const r = new Record(col);
    r.set("entidad", "interesados");
    r.set("code", s.code);
    r.set("nombre", s.nombre);
    r.set("color", s.color);
    r.set("orden_display", s.orden);
    r.set("es_core", true);
    r.set("activo", true);
    app.save(r);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("estados_definiciones");
  app.delete(collection);
});

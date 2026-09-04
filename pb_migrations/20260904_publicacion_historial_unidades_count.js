/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const col = app.findCollectionByNameOrId("publicacion_historial");
  col.fields.add(new Field({
    name: "unidades_count",
    type: "number",
    required: false,
  }));
  app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("publicacion_historial");
  const field = col.fields.getByName("unidades_count");
  if (field) {
    col.fields.removeById(field.id);
    app.save(col);
  }
});

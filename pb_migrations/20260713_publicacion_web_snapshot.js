/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const barrios = app.findCollectionByNameOrId("barrios");
  if (!barrios.fields.getByName("snapshot")) {
    barrios.fields.add(new Field({ name: "snapshot", type: "json", required: false }));
  }
  app.save(barrios);
}, (app) => {
  const barrios = app.findCollectionByNameOrId("barrios");
  if (barrios.fields.getByName("snapshot")) {
    barrios.fields.removeByName("snapshot");
  }
  app.save(barrios);
});

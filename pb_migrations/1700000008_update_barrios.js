/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("barrios");

  // Remove 'estado'
  collection.fields.removeByName("estado");

  // Add 'extras' (JSON)
  collection.fields.add(new Field({
    name: "extras",
    type: "json",
    required: false
  }));

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("barrios");

  // Re-add 'estado'
  collection.fields.add(new Field({
    name: "estado",
    type: "select",
    values: ["activo", "en_desarrollo", "pausado"],
    required: true,
    maxSelect: 1,
  }));

  // Remove 'extras'
  collection.fields.removeByName("extras");

  app.save(collection);
});

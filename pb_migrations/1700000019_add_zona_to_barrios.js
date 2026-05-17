/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("barrios");

  collection.fields.add(new TextField({
    name: "zona",
    required: false,
  }));

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("barrios");

  collection.fields.removeByName("zona");

  app.save(collection);
});

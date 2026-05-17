/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");

  collection.fields.add(new DateField({
    name: "ultimo_acceso",
    required: false,
  }));

  collection.fields.add(new TextField({
    name: "reset_token",
    required: false,
  }));

  collection.fields.add(new DateField({
    name: "reset_token_expires",
    required: false,
  }));

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("users");

  collection.fields.removeByName("ultimo_acceso");
  collection.fields.removeByName("reset_token");
  collection.fields.removeByName("reset_token_expires");

  app.save(collection);
});

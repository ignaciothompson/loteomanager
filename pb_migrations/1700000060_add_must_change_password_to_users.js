/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");

  if (!collection.fields.getByName("must_change_password")) {
    collection.fields.add(new BoolField({
      name: "must_change_password",
      required: false,
    }));
  }

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("users");
  collection.fields.removeByName("must_change_password");
  app.save(collection);
});

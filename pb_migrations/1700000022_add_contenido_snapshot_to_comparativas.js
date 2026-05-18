/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("comparativas");

  collection.fields.add(new Field({
    name: "contenido_snapshot",
    type: "json",
    required: false,
  }));

  // Open read access for public token-based lookups (SSR server uses service token)
  // viewRule remains auth-gated; public access goes via server route with service token
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("comparativas");
  collection.fields.removeByName("contenido_snapshot");
  app.save(collection);
});

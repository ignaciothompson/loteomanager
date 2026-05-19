/// <reference path="../pb_data/types.d.ts" />

/**
 * Opens comparativas viewRule for unauthenticated reads.
 * The token_publico field is the access-control mechanism (shared links).
 * Create/update/delete still require authentication.
 */
migrate((app) => {
  const collection = app.findCollectionByNameOrId("comparativas");

  // Public read — the unique token IS the access control
  // listRule must also be open because getFirstListItem uses the list endpoint
  collection.viewRule  = "";
  collection.listRule  = "";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("comparativas");

  collection.viewRule  = "@request.auth.id != ''";
  collection.listRule  = "@request.auth.id != ''";

  app.save(collection);
});

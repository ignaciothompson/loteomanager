/// <reference path="../pb_data/types.d.ts" />

/**
 * Also opens the listRule for comparativas — getFirstListItem uses the list endpoint.
 */
migrate((app) => {
  const collection = app.findCollectionByNameOrId("comparativas");
  collection.listRule  = "";
  collection.viewRule  = "";
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("comparativas");
  collection.listRule  = "@request.auth.id != ''";
  collection.viewRule  = "@request.auth.id != ''";
  app.save(collection);
});

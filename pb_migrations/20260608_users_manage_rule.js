/// <reference path="../pb_data/types.d.ts" />

/**
 * Auth collections require manageRule for admins to set verified/password on create/update.
 * Without it, verified + verifiedConfirm returns "Values don't match." for non-superusers.
 */
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");

  collection.manageRule = '@request.auth.role = "admin"';
  collection.createRule = '@request.auth.role = "admin"';
  collection.viewRule =
    '@request.auth.id != "" && (@request.auth.role = "admin" || id = @request.auth.id)';
  collection.updateRule =
    '@request.auth.id != "" && (@request.auth.role = "admin" || id = @request.auth.id)';
  collection.deleteRule = '@request.auth.role = "admin"';

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("users");

  collection.manageRule = null;
  collection.createRule = "";
  collection.viewRule = "id = @request.auth.id";
  collection.updateRule = "id = @request.auth.id";
  collection.deleteRule = "id = @request.auth.id";

  return app.save(collection);
});

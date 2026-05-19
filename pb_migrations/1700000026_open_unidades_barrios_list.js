/// <reference path="../pb_data/types.d.ts" />

/**
 * Opens listRule for unidades and barrios so the landing SSR
 * can use getFullList() (which uses the list endpoint) to build snapshots.
 */
migrate((app) => {
  const unidades = app.findCollectionByNameOrId("unidades");
  unidades.listRule  = "";
  unidades.viewRule  = "";
  app.save(unidades);

  const barrios = app.findCollectionByNameOrId("barrios");
  barrios.listRule  = "";
  barrios.viewRule  = "";
  app.save(barrios);
}, (app) => {
  const unidades = app.findCollectionByNameOrId("unidades");
  unidades.listRule  = "@request.auth.id != ''";
  unidades.viewRule  = "@request.auth.id != ''";
  app.save(unidades);

  const barrios = app.findCollectionByNameOrId("barrios");
  barrios.listRule  = "@request.auth.id != ''";
  barrios.viewRule  = "@request.auth.id != ''";
  app.save(barrios);
});

/// <reference path="../pb_data/types.d.ts" />

/**
 * P3: impedir UPDATE del comodín slug=todo en departamentos/zonas.
 * P7: scope de supervisor sobre zonas se valida en pb_hooks (mismo pivot row).
 */
migrate((app) => {
  const dept = app.findCollectionByNameOrId("departamentos");
  dept.updateRule = '@request.auth.role = "admin" && slug != "todo"';
  app.save(dept);

  const zonas = app.findCollectionByNameOrId("zonas");
  zonas.updateRule =
    'slug != "todo" && (@request.auth.role = "admin" || @request.auth.role = "supervisor")';
  zonas.deleteRule =
    'slug != "todo" && (@request.auth.role = "admin" || @request.auth.role = "supervisor")';
  app.save(zonas);
}, (app) => {
  const dept = app.findCollectionByNameOrId("departamentos");
  dept.updateRule = '@request.auth.role = "admin"';
  app.save(dept);

  const zonas = app.findCollectionByNameOrId("zonas");
  zonas.updateRule = '@request.auth.role = "admin" || @request.auth.role = "supervisor"';
  zonas.deleteRule =
    '@request.auth.id != "" && slug != "todo" && (@request.auth.role = "admin" || @request.auth.role = "supervisor")';
  app.save(zonas);
});

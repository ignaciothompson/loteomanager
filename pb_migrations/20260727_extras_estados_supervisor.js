/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  for (const name of ["extras_definiciones", "estados_definiciones"]) {
    const c = app.findCollectionByNameOrId(name);
    c.createRule = '@request.auth.role = "admin" || @request.auth.role = "supervisor"';
    c.updateRule = '@request.auth.role = "admin" || @request.auth.role = "supervisor"';
    c.deleteRule = '@request.auth.role = "admin" || @request.auth.role = "supervisor"';
    app.save(c);
  }
}, (app) => {
  for (const name of ["extras_definiciones", "estados_definiciones"]) {
    const c = app.findCollectionByNameOrId(name);
    c.createRule = '@request.auth.role = "admin"';
    c.updateRule = '@request.auth.role = "admin"';
    c.deleteRule = '@request.auth.role = "admin"';
    app.save(c);
  }
});

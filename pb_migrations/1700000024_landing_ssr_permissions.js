/// <reference path="../pb_data/types.d.ts" />

/**
 * Adjusts collection rules so the landing SSR can operate without
 * a persistent service token:
 * - comparativa_vistas: allow create from server (no auth needed; IP is hashed)
 * - interesados: allow create from server (validated by Turnstile + honeypot)
 * - barrios/unidades: allow public view for expanding comparativa data server-side
 */
migrate((app) => {
  // comparativa_vistas — allow unauthenticated create (IP is hashed, not stored raw)
  const vistas = app.findCollectionByNameOrId("comparativa_vistas");
  vistas.createRule = "";
  app.save(vistas);

  // interesados — allow unauthenticated create (Turnstile + honeypot on server)
  const interesados = app.findCollectionByNameOrId("interesados");
  interesados.createRule = "";
  app.save(interesados);

  // barrios — allow public view for SSR snapshot building
  const barrios = app.findCollectionByNameOrId("barrios");
  barrios.viewRule = "";
  app.save(barrios);

  // unidades — allow public view for SSR snapshot building
  const unidades = app.findCollectionByNameOrId("unidades");
  unidades.viewRule = "";
  app.save(unidades);
}, (app) => {
  const vistas = app.findCollectionByNameOrId("comparativa_vistas");
  vistas.createRule = "@request.auth.id != ''";
  app.save(vistas);

  const interesados = app.findCollectionByNameOrId("interesados");
  interesados.createRule = "@request.auth.id != ''";
  app.save(interesados);

  const barrios = app.findCollectionByNameOrId("barrios");
  barrios.viewRule = "@request.auth.id != ''";
  app.save(barrios);

  const unidades = app.findCollectionByNameOrId("unidades");
  unidades.viewRule = "@request.auth.id != ''";
  app.save(unidades);
});

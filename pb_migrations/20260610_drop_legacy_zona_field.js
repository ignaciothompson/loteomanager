/// <reference path="../pb_data/types.d.ts" />

/**
 * Reintento: la migración 20260609 quedó aplicada pero el campo text `zona` siguió en schema.
 * Usamos removeById con el id estable del field.
 */
migrate((app) => {
  const vzCol = app.findCollectionByNameOrId("vendedor_zonas");

  const zonaField = vzCol.fields.getByName("zona");
  if (zonaField?.id) {
    vzCol.fields.removeById(zonaField.id);
  } else {
    vzCol.fields.removeByName("zona");
  }

  const vzZonaId = vzCol.fields.getByName("zona_id");
  if (vzZonaId) vzZonaId.required = true;

  app.save(vzCol);

  const barriosCol = app.findCollectionByNameOrId("barrios");
  const barrioZonaField = barriosCol.fields.getByName("zona");
  if (barrioZonaField?.id) {
    barriosCol.fields.removeById(barrioZonaField.id);
  } else {
    barriosCol.fields.removeByName("zona");
  }

  const barrioZonaId = barriosCol.fields.getByName("zona_id");
  if (barrioZonaId) barrioZonaId.required = true;

  app.save(barriosCol);
}, (app) => {
  const vzCol = app.findCollectionByNameOrId("vendedor_zonas");
  if (!vzCol.fields.getByName("zona")) {
    vzCol.fields.addAt(vzCol.fields.length, new TextField({ name: "zona", required: true }));
    app.save(vzCol);
  }

  const barriosCol = app.findCollectionByNameOrId("barrios");
  if (!barriosCol.fields.getByName("zona")) {
    barriosCol.fields.addAt(barriosCol.fields.length, new TextField({ name: "zona", required: false }));
    app.save(barriosCol);
  }
});

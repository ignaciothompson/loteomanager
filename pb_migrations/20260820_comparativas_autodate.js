/// <reference path="../pb_data/types.d.ts" />

/**
 * PB 0.23+: created/updated son autodate opcionales.
 * comparativas se creó sin ellos → sort=-created devolvía 400.
 */
migrate((app) => {
  const AUTODATE_CREATED = { name: "created", type: "autodate", onCreate: true, onUpdate: false };
  const AUTODATE_UPDATED = { name: "updated", type: "autodate", onCreate: true, onUpdate: true };

  const col = app.findCollectionByNameOrId("comparativas");
  if (!col.fields.getByName("created")) {
    col.fields.add(new Field(AUTODATE_CREATED));
  }
  if (!col.fields.getByName("updated")) {
    col.fields.add(new Field(AUTODATE_UPDATED));
  }
  app.save(col);
}, (app) => {
  // Down: no borrar timestamps.
});

/// <reference path="../pb_data/types.d.ts" />

/**
 * PB 0.23+: created/updated son autodate opcionales.
 * importaciones / importacion_filas se crearon sin ellos → sort=-created devolvía 400.
 */
migrate((app) => {
  const AUTODATE_CREATED = { name: "created", type: "autodate", onCreate: true, onUpdate: false };
  const AUTODATE_UPDATED = { name: "updated", type: "autodate", onCreate: true, onUpdate: true };

  for (const name of ["importaciones", "importacion_filas"]) {
    const col = app.findCollectionByNameOrId(name);
    if (!col.fields.getByName("created")) {
      col.fields.add(new Field(AUTODATE_CREATED));
    }
    if (!col.fields.getByName("updated")) {
      col.fields.add(new Field(AUTODATE_UPDATED));
    }
    app.save(col);
  }
}, (app) => {
  // Down: no borrar timestamps (evita romper sort y datos).
});

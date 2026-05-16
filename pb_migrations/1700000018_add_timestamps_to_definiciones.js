/// <reference path="../pb_data/types.d.ts" />

// Agrega campos autodate created/updated a estados_definiciones y extras_definiciones.
// Estas colecciones se crearon sin timestamps, lo que causaba "invalid sort field 'created'"
// en cualquier findRecordsByFilter que ordenara por ese campo.

migrate((app) => {
  const AUTODATE_CREATED = { name: "created", type: "autodate", onCreate: true, onUpdate: false };
  const AUTODATE_UPDATED = { name: "updated", type: "autodate", onCreate: true, onUpdate: true };

  for (const colName of ["estados_definiciones", "extras_definiciones"]) {
    const col = app.findCollectionByNameOrId(colName);

    if (!col.fields.getByName("created")) {
      col.fields.add(new Field(AUTODATE_CREATED));
    }
    if (!col.fields.getByName("updated")) {
      col.fields.add(new Field(AUTODATE_UPDATED));
    }

    app.save(col);
  }
}, (app) => {
  // Down: no eliminar los campos — perder timestamps es peor que tenerlos de más.
});

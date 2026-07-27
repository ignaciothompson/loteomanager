/// <reference path="../pb_data/types.d.ts" />

/**
 * PB 0.23+: created/updated son campos autodate opcionales.
 * interesados se creó sin ellos → sort=-created fallaba.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("interesados");

  if (!col.fields.getByName("created")) {
    col.fields.add(
      new Field({
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      }),
    );
  }
  if (!col.fields.getByName("updated")) {
    col.fields.add(
      new Field({
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      }),
    );
  }

  app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("interesados");
  if (col.fields.getByName("created")) col.fields.removeByName("created");
  if (col.fields.getByName("updated")) col.fields.removeByName("updated");
  app.save(col);
});

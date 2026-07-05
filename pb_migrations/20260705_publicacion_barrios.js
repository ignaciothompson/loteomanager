/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const barrios = app.findCollectionByNameOrId("barrios");

  if (!barrios.fields.getByName("publicado")) {
    barrios.fields.add(new Field({ name: "publicado", type: "bool", required: false }));
  }
  if (!barrios.fields.getByName("publicado_at")) {
    barrios.fields.add(new Field({ name: "publicado_at", type: "date", required: false }));
  }
  app.save(barrios);

  const all = app.findAllRecords("barrios");
  for (const r of all) {
    const rec = app.findRecordById("barrios", r.id);
    if (rec.get("publicado") === null || rec.get("publicado") === undefined) {
      rec.set("publicado", false);
    }
    app.save(rec);
  }
}, (app) => {
  const barrios = app.findCollectionByNameOrId("barrios");
  ["publicado", "publicado_at"].forEach((name) => {
    if (barrios.fields.getByName(name)) {
      barrios.fields.removeByName(name);
    }
  });
  app.save(barrios);
});

/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const comparativasCol = app.findCollectionByNameOrId("comparativas");
  comparativasCol.fields.add(
    new Field({
      name: "contenido_snapshot",
      type: "json",
      required: false,
    }),
  );
  app.save(comparativasCol);

  const unidadesCol = app.findCollectionByNameOrId("unidades");
  const allUnidades = app.findAllRecords("unidades");
  const estadoUnidadBackup = {};
  for (const r of allUnidades) {
    estadoUnidadBackup[r.id] = r.get("estado");
  }
  unidadesCol.fields.removeByName("estado");
  unidadesCol.fields.add(
    new Field({
      name: "estado",
      type: "text",
      required: true,
    }),
  );
  unidadesCol.fields.add(
    new Field({
      name: "extras",
      type: "json",
      required: false,
    }),
  );
  app.save(unidadesCol);
  for (const r of allUnidades) {
    const rec = app.findRecordById("unidades", r.id);
    rec.set("estado", estadoUnidadBackup[r.id]);
    if (!rec.get("extras")) rec.set("extras", []);
    app.save(rec);
  }

  const interesadosCol = app.findCollectionByNameOrId("interesados");
  const allInteresados = app.findAllRecords("interesados");
  const estadoIntBackup = {};
  for (const r of allInteresados) {
    estadoIntBackup[r.id] = r.get("estado");
  }
  interesadosCol.fields.removeByName("estado");
  interesadosCol.fields.add(
    new Field({
      name: "estado",
      type: "text",
      required: true,
    }),
  );
  interesadosCol.fields.add(
    new Field({
      name: "extras",
      type: "json",
      required: false,
    }),
  );
  app.save(interesadosCol);
  for (const r of allInteresados) {
    const rec = app.findRecordById("interesados", r.id);
    rec.set("estado", estadoIntBackup[r.id]);
    if (!rec.get("extras")) rec.set("extras", []);
    app.save(rec);
  }
}, (app) => {
  const comparativasCol = app.findCollectionByNameOrId("comparativas");
  comparativasCol.fields.removeByName("contenido_snapshot");
  app.save(comparativasCol);

  const unidadesCol = app.findCollectionByNameOrId("unidades");
  const allU = app.findAllRecords("unidades");
  const backU = {};
  for (const r of allU) {
    backU[r.id] = r.get("estado");
  }
  unidadesCol.fields.removeByName("extras");
  unidadesCol.fields.removeByName("estado");
  unidadesCol.fields.add(
    new Field({
      name: "estado",
      type: "select",
      values: ["disponible", "bloqueado", "reservado", "sena", "vendido", "escriturado"],
      required: true,
      maxSelect: 1,
    }),
  );
  app.save(unidadesCol);
  for (const r of allU) {
    const rec = app.findRecordById("unidades", r.id);
    rec.set("estado", backU[r.id]);
    app.save(rec);
  }

  const interesadosCol = app.findCollectionByNameOrId("interesados");
  const allI = app.findAllRecords("interesados");
  const backI = {};
  for (const r of allI) {
    backI[r.id] = r.get("estado");
  }
  interesadosCol.fields.removeByName("extras");
  interesadosCol.fields.removeByName("estado");
  interesadosCol.fields.add(
    new Field({
      name: "estado",
      type: "select",
      values: ["nuevo", "contactado", "reunion", "oferta", "cerrado_ganado", "cerrado_perdido"],
      required: true,
      maxSelect: 1,
    }),
  );
  app.save(interesadosCol);
  for (const r of allI) {
    const rec = app.findRecordById("interesados", r.id);
    rec.set("estado", backI[r.id]);
    app.save(rec);
  }
});

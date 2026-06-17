/// <reference path="../pb_data/types.d.ts" />

/**
 * Flujo ingreso unidades:
 * - unidades: nuevos campos + tipo_unidad extendido
 * - barrios.tipos_unidad (JSON)
 * - colección plantillas_unidad
 */

const TIPO_MAP = {
  lote: "lote_vacio",
  casa: "casa_construida",
  departamento: "casa_prefabricada",
};

const ORIENTACION_VALUES = [
  "Norte",
  "Sur",
  "Este",
  "Oeste",
  "Noreste",
  "Noroeste",
  "Sureste",
  "Suroeste",
];

migrate((app) => {
  const barriosCol = app.findCollectionByNameOrId("barrios");
  const unidadesCol = app.findCollectionByNameOrId("unidades");

  // ── barrios.tipos_unidad ───────────────────────────────────────────────────
  if (!barriosCol.fields.getByName("tipos_unidad")) {
    barriosCol.fields.add(
      new Field({
        name: "tipos_unidad",
        type: "json",
        required: false,
      }),
    );
    app.save(barriosCol);
  }

  const allBarrios = app.findAllRecords("barrios");
  for (const b of allBarrios) {
    const rec = app.findRecordById("barrios", b.id);
    if (!rec.get("tipos_unidad")) {
      rec.set("tipos_unidad", ["lote_vacio"]);
      app.save(rec);
    }
  }

  // ── unidades: backup tipo_unidad ───────────────────────────────────────────
  const allUnidades = app.findAllRecords("unidades");
  const tipoBackup = {};
  for (const r of allUnidades) {
    tipoBackup[r.id] = r.get("tipo_unidad");
  }

  const tipoField = unidadesCol.fields.getByName("tipo_unidad");
  if (tipoField?.id) {
    unidadesCol.fields.removeById(tipoField.id);
  } else {
    unidadesCol.fields.removeByName("tipo_unidad");
  }
  unidadesCol.fields.add(
    new Field({
      name: "tipo_unidad",
      type: "select",
      values: ["lote_vacio", "casa_construida", "casa_prefabricada"],
      required: true,
      maxSelect: 1,
    }),
  );

  // codigo (único por barrio vía hook)
  if (!unidadesCol.fields.getByName("codigo")) {
    unidadesCol.fields.add(
      new Field({
        name: "codigo",
        type: "text",
        required: true,
      }),
    );
  }

  if (!unidadesCol.fields.getByName("area_m2")) {
    unidadesCol.fields.add(
      new Field({
        name: "area_m2",
        type: "number",
        required: false,
        min: 0,
      }),
    );
  }

  if (!unidadesCol.fields.getByName("orientacion")) {
    unidadesCol.fields.add(
      new Field({
        name: "orientacion",
        type: "select",
        values: ORIENTACION_VALUES,
        required: false,
        maxSelect: 1,
      }),
    );
  }

  if (!unidadesCol.fields.getByName("web_visible")) {
    unidadesCol.fields.add(
      new Field({
        name: "web_visible",
        type: "bool",
        required: false,
      }),
    );
  }

  if (!unidadesCol.fields.getByName("pendiente_publicar")) {
    unidadesCol.fields.add(
      new Field({
        name: "pendiente_publicar",
        type: "bool",
        required: false,
      }),
    );
  }

  if (!unidadesCol.fields.getByName("en_oferta")) {
    unidadesCol.fields.add(
      new Field({
        name: "en_oferta",
        type: "bool",
        required: false,
      }),
    );
  }

  // moneda: agregar UYU
  const monedaField = unidadesCol.fields.getByName("moneda");
  if (monedaField) {
    monedaField.values = ["USD", "UYU", "ARS"];
    app.save(unidadesCol);
  }

  // precio y metros_cuadrados: permitir null en nuevos ingresos (no forzar required=false si ya hay datos)
  const precioField = unidadesCol.fields.getByName("precio");
  if (precioField) precioField.required = false;
  const m2Field = unidadesCol.fields.getByName("metros_cuadrados");
  if (m2Field) m2Field.required = false;

  app.save(unidadesCol);

  for (const r of allUnidades) {
    const rec = app.findRecordById("unidades", r.id);
    const oldTipo = tipoBackup[r.id] || "lote";
    rec.set("tipo_unidad", TIPO_MAP[oldTipo] || "lote_vacio");
    if (!rec.get("codigo")) {
      rec.set("codigo", rec.get("codigo_interno") || `U-${rec.id.slice(0, 6)}`);
    }
    if (!rec.get("area_m2") && rec.get("metros_cuadrados")) {
      rec.set("area_m2", rec.get("metros_cuadrados"));
    }
    if (rec.get("web_visible") === null || rec.get("web_visible") === undefined) {
      rec.set("web_visible", true);
    }
    if (rec.get("pendiente_publicar") === null || rec.get("pendiente_publicar") === undefined) {
      rec.set("pendiente_publicar", false);
    }
    if (rec.get("en_oferta") === null || rec.get("en_oferta") === undefined) {
      rec.set("en_oferta", !!rec.get("oferta"));
    }
    app.save(rec);
  }

  // ── plantillas_unidad ──────────────────────────────────────────────────────
  let plantillasCol;
  try {
    plantillasCol = app.findCollectionByNameOrId("plantillas_unidad");
  } catch (_e) {
    plantillasCol = null;
  }

  if (!plantillasCol) {
    const collection = new Collection({
      name: "plantillas_unidad",
      type: "base",
      fields: [
        {
          name: "barrio_id",
          type: "relation",
          collectionId: barriosCol.id,
          required: true,
          maxSelect: 1,
        },
        {
          name: "tipo_unidad",
          type: "select",
          values: ["lote_vacio", "casa_construida", "casa_prefabricada"],
          required: true,
          maxSelect: 1,
        },
        { name: "nombre", type: "text", required: true },
        { name: "patron_codigo", type: "text", required: true },
        { name: "cantidad", type: "number", required: true, min: 1 },
        { name: "area_m2", type: "number", required: false, min: 0 },
        {
          name: "orientacion",
          type: "select",
          values: ORIENTACION_VALUES,
          required: false,
          maxSelect: 1,
        },
        { name: "precio", type: "number", required: false, min: 0 },
        {
          name: "moneda",
          type: "select",
          values: ["USD", "UYU"],
          required: false,
          maxSelect: 1,
        },
        {
          name: "estado_inicial",
          type: "select",
          values: ["disponible", "reservado", "bloqueado"],
          required: false,
          maxSelect: 1,
        },
        { name: "web_visible", type: "bool", required: false },
        { name: "modelo", type: "text", required: false },
      ],
    });

    collection.listRule = '@request.auth.id != ""';
    collection.viewRule = '@request.auth.id != ""';
    collection.createRule = '@request.auth.role = "admin"';
    collection.updateRule = '@request.auth.role = "admin"';
    collection.deleteRule = '@request.auth.role = "admin"';

    app.save(collection);
  }
}, (app) => {
  try {
    const plantillasCol = app.findCollectionByNameOrId("plantillas_unidad");
    app.delete(plantillasCol);
  } catch (_e) {}

  const barriosCol = app.findCollectionByNameOrId("barrios");
  if (barriosCol.fields.getByName("tipos_unidad")) {
    barriosCol.fields.removeByName("tipos_unidad");
    app.save(barriosCol);
  }

  const unidadesCol = app.findCollectionByNameOrId("unidades");
  const allU = app.findAllRecords("unidades");
  const backTipo = {};
  for (const r of allU) {
    backTipo[r.id] = r.get("tipo_unidad");
  }

  const REV_MAP = {
    lote_vacio: "lote",
    casa_construida: "casa",
    casa_prefabricada: "departamento",
  };

  ["codigo", "area_m2", "orientacion", "web_visible", "pendiente_publicar", "en_oferta"].forEach(
    (name) => {
      if (unidadesCol.fields.getByName(name)) {
        unidadesCol.fields.removeByName(name);
      }
    },
  );

  if (unidadesCol.fields.getByName("tipo_unidad")) {
    unidadesCol.fields.removeByName("tipo_unidad");
  }
  unidadesCol.fields.add(
    new Field({
      name: "tipo_unidad",
      type: "select",
      values: ["lote", "casa", "departamento"],
      required: true,
      maxSelect: 1,
    }),
  );

  const monedaField = unidadesCol.fields.getByName("moneda");
  if (monedaField) {
    monedaField.values = ["USD", "ARS"];
  }

  const precioField = unidadesCol.fields.getByName("precio");
  if (precioField) precioField.required = true;
  const m2Field = unidadesCol.fields.getByName("metros_cuadrados");
  if (m2Field) m2Field.required = true;

  app.save(unidadesCol);

  for (const r of allU) {
    const rec = app.findRecordById("unidades", r.id);
    const t = backTipo[r.id] || "lote_vacio";
    rec.set("tipo_unidad", REV_MAP[t] || "lote");
    app.save(rec);
  }
});

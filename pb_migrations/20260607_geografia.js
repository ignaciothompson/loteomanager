/// <reference path="../pb_data/types.d.ts" />

/**
 * Geografía jerárquica: Departamento → Zona → Barrio → Unidad
 * - Colecciones departamentos, zonas, supervisor_departamentos
 * - barrios.zona (text) → barrios.zona_id (relation)
 * - vendedor_zonas.zona (text) → vendedor_zonas.zona_id (relation)
 * - users.role + supervisor
 * - Seed "Todo" en departamentos y zonas
 */

function toSlug(nombre) {
  return String(nombre || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

migrate((app) => {
  const usersCol = app.findCollectionByNameOrId("users");
  const barriosCol = app.findCollectionByNameOrId("barrios");

  // ── 1. departamentos ──────────────────────────────────────────────────────
  const deptCol = new Collection({
    name: "departamentos",
    type: "base",
    fields: [
      { name: "nombre", type: "text", required: true },
      { name: "slug", type: "text", required: true },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_departamentos_slug ON departamentos (slug)',
    ],
  });
  deptCol.listRule = '@request.auth.id != ""';
  deptCol.viewRule = '@request.auth.id != ""';
  deptCol.createRule = '@request.auth.role = "admin"';
  deptCol.updateRule = '@request.auth.role = "admin"';
  deptCol.deleteRule = '@request.auth.role = "admin" && slug != "todo"';
  app.save(deptCol);

  const deptTodo = new Record(deptCol);
  deptTodo.set("nombre", "Todo");
  deptTodo.set("slug", "todo");
  app.save(deptTodo);

  // ── 2. zonas ──────────────────────────────────────────────────────────────
  const zonasCol = new Collection({
    name: "zonas",
    type: "base",
    fields: [
      { name: "nombre", type: "text", required: true },
      { name: "slug", type: "text", required: true },
      {
        name: "departamento_id",
        type: "relation",
        collectionId: deptCol.id,
        required: true,
        maxSelect: 1,
      },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_zonas_slug ON zonas (slug)',
    ],
  });
  zonasCol.listRule = '@request.auth.id != ""';
  zonasCol.viewRule = '@request.auth.id != ""';
  zonasCol.createRule = '@request.auth.role = "admin" || @request.auth.role = "supervisor"';
  zonasCol.updateRule = '@request.auth.role = "admin" || @request.auth.role = "supervisor"';
  zonasCol.deleteRule = '@request.auth.id != "" && slug != "todo" && (@request.auth.role = "admin" || @request.auth.role = "supervisor")';
  app.save(zonasCol);

  const zonaTodo = new Record(zonasCol);
  zonaTodo.set("nombre", "Todo");
  zonaTodo.set("slug", "todo");
  zonaTodo.set("departamento_id", deptTodo.id);
  app.save(zonaTodo);

  // Map legacy text zona → zonas record id
  const zonaIdBySlug = { todo: zonaTodo.id };
  const zonaIdByNombre = { todo: zonaTodo.id, Todo: zonaTodo.id };

  try {
    const barriosLegacy = app.findRecordsByFilter("barrios", "id != ''", "nombre", 500, 0);
    const seenSlugs = new Set(["todo"]);
    for (const b of barriosLegacy) {
      const zText = (b.get("zona") || "").trim();
      if (!zText) continue;
      const slug = toSlug(zText);
      if (zonaIdBySlug[slug]) continue;
      if (seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);
      const rec = new Record(zonasCol);
      rec.set("nombre", zText);
      rec.set("slug", slug);
      rec.set("departamento_id", deptTodo.id);
      app.save(rec);
      zonaIdBySlug[slug] = rec.id;
      zonaIdByNombre[zText] = rec.id;
      zonaIdByNombre[zText.toLowerCase()] = rec.id;
    }
  } catch (_e) {}

  // Also seed zonas from vendedor_zonas text values
  try {
    const vzLegacy = app.findRecordsByFilter("vendedor_zonas", "id != ''", "-created", 500, 0);
    for (const vz of vzLegacy) {
      const zText = (vz.get("zona") || "").trim();
      if (!zText) continue;
      const slug = toSlug(zText);
      if (zonaIdBySlug[slug]) continue;
      const rec = new Record(zonasCol);
      rec.set("nombre", zText);
      rec.set("slug", slug);
      rec.set("departamento_id", deptTodo.id);
      app.save(rec);
      zonaIdBySlug[slug] = rec.id;
      zonaIdByNombre[zText] = rec.id;
    }
  } catch (_e) {}

  // ── 3. barrios: add zona_id, migrate, remove text zona ────────────────────
  barriosCol.fields.addAt(barriosCol.fields.length, new RelationField({
    name: "zona_id",
    collectionId: zonasCol.id,
    required: false,
    maxSelect: 1,
  }));
  app.save(barriosCol);

  try {
    const barriosAll = app.findRecordsByFilter("barrios", "id != ''", "nombre", 500, 0);
    for (const b of barriosAll) {
      const zText = (b.get("zona") || "").trim();
      let zonaId = zonaTodo.id;
      if (zText) {
        const slug = toSlug(zText);
        zonaId = zonaIdBySlug[slug] || zonaIdByNombre[zText] || zonaTodo.id;
      }
      b.set("zona_id", zonaId);
      app.save(b);
    }
  } catch (_e) {}

  const zonaTextField = barriosCol.fields.getByName("zona");
  if (zonaTextField?.id) {
    barriosCol.fields.removeById(zonaTextField.id);
  } else if (zonaTextField) {
    barriosCol.fields.removeByName("zona");
  }

  const zonaIdField = barriosCol.fields.getByName("zona_id");
  if (zonaIdField) zonaIdField.required = true;
  app.save(barriosCol);

  // ── 4. vendedor_zonas: add zona_id, migrate, remove text zona ───────────
  const vzCol = app.findCollectionByNameOrId("vendedor_zonas");

  vzCol.fields.addAt(vzCol.fields.length, new RelationField({
    name: "zona_id",
    collectionId: zonasCol.id,
    required: false,
    maxSelect: 1,
  }));
  app.save(vzCol);

  try {
    const vzAll = app.findRecordsByFilter("vendedor_zonas", "id != ''", "-created", 500, 0);
    for (const vz of vzAll) {
      const zText = (vz.get("zona") || "").trim();
      if (!zText) continue;
      const slug = toSlug(zText);
      const zonaId = zonaIdBySlug[slug] || zonaIdByNombre[zText] || zonaTodo.id;
      vz.set("zona_id", zonaId);
      app.save(vz);
    }
  } catch (_e) {}

  const vzZonaTextField = vzCol.fields.getByName("zona");
  if (vzZonaTextField?.id) {
    vzCol.fields.removeById(vzZonaTextField.id);
  } else if (vzZonaTextField) {
    vzCol.fields.removeByName("zona");
  }

  const vzZonaIdField = vzCol.fields.getByName("zona_id");
  if (vzZonaIdField) vzZonaIdField.required = true;

  vzCol.indexes.push('CREATE UNIQUE INDEX idx_vendedor_zona ON vendedor_zonas (vendedor_id, zona_id)');
  app.save(vzCol);

  // ── 5. supervisor_departamentos ───────────────────────────────────────────
  const supDeptCol = new Collection({
    name: "supervisor_departamentos",
    type: "base",
    fields: [
      {
        name: "user_id",
        type: "relation",
        collectionId: usersCol.id,
        required: true,
        maxSelect: 1,
      },
      {
        name: "departamento_id",
        type: "relation",
        collectionId: deptCol.id,
        required: true,
        maxSelect: 1,
      },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_supervisor_departamento ON supervisor_departamentos (user_id, departamento_id)',
    ],
  });
  supDeptCol.listRule = '@request.auth.id != "" && (@request.auth.role = "admin" || user_id = @request.auth.id)';
  supDeptCol.viewRule = '@request.auth.id != "" && (@request.auth.role = "admin" || user_id = @request.auth.id)';
  supDeptCol.createRule = '@request.auth.role = "admin"';
  supDeptCol.updateRule = '@request.auth.role = "admin"';
  supDeptCol.deleteRule = '@request.auth.role = "admin"';
  app.save(supDeptCol);

  // ── 6. users.role + supervisor ────────────────────────────────────────────
  const roleField = usersCol.fields.getByName("role");
  if (roleField) {
    roleField.values = ["admin", "supervisor", "vendedor"];
  }
  app.save(usersCol);

}, (app) => {
  // Rollback simplificado — no restaura datos text zona
  try {
    const sup = app.findCollectionByNameOrId("supervisor_departamentos");
    app.delete(sup);
  } catch (_e) {}

  try {
    const usersCol = app.findCollectionByNameOrId("users");
    const roleField = usersCol.fields.getByName("role");
    if (roleField) roleField.values = ["admin", "vendedor"];
    app.save(usersCol);
  } catch (_e) {}

  try {
    const barriosCol = app.findCollectionByNameOrId("barrios");
    const zid = barriosCol.fields.getByName("zona_id");
    if (zid) barriosCol.fields.remove(zid);
    barriosCol.fields.addAt(barriosCol.fields.length, new TextField({ name: "zona", required: false }));
    app.save(barriosCol);
  } catch (_e) {}

  try {
    const vzCol = app.findCollectionByNameOrId("vendedor_zonas");
    const zid = vzCol.fields.getByName("zona_id");
    if (zid) vzCol.fields.remove(zid);
    vzCol.fields.addAt(vzCol.fields.length, new TextField({ name: "zona", required: true }));
    app.save(vzCol);
  } catch (_e) {}

  try {
    const zonasCol = app.findCollectionByNameOrId("zonas");
    app.delete(zonasCol);
  } catch (_e) {}

  try {
    const deptCol = app.findCollectionByNameOrId("departamentos");
    app.delete(deptCol);
  } catch (_e) {}
});

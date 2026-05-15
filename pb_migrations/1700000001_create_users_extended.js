/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");

  // role: admin | vendedor
  collection.fields.add(new SelectField({
    name: "role",
    values: ["admin", "vendedor"],
    required: true,
    maxSelect: 1,
  }));

  // telefono
  collection.fields.add(new TextField({
    name: "telefono",
    required: false,
  }));

  // whatsapp
  collection.fields.add(new TextField({
    name: "whatsapp",
    required: false,
  }));

  // avatar
  collection.fields.add(new FileField({
    name: "avatar",
    maxSelect: 1,
    maxSize: 2097152, // 2MB
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    required: false,
  }));

  // leads_visibility
  collection.fields.add(new SelectField({
    name: "leads_visibility",
    values: ["solo_mios", "mios_mas_sin_asignar", "todos_mis_barrios", "todos"],
    required: false,
    maxSelect: 1,
  }));

  // activo
  collection.fields.add(new BoolField({
    name: "activo",
    required: false,
  }));

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("users");

  collection.fields.removeByName("role");
  collection.fields.removeByName("telefono");
  collection.fields.removeByName("whatsapp");
  collection.fields.removeByName("avatar");
  collection.fields.removeByName("leads_visibility");
  collection.fields.removeByName("activo");

  app.save(collection);
});

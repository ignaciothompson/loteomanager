/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const config = app.findCollectionByNameOrId("config");
  if (!config.fields.getByName("nombre_inmobiliaria")) {
    config.fields.add(new Field({ name: "nombre_inmobiliaria", type: "text", required: false }));
  }
  if (!config.fields.getByName("logo_url")) {
    config.fields.add(new Field({ name: "logo_url", type: "text", required: false }));
  }
  app.save(config);
}, (app) => {
  const config = app.findCollectionByNameOrId("config");
  ["nombre_inmobiliaria", "logo_url"].forEach((name) => {
    if (config.fields.getByName(name)) {
      config.fields.removeByName(name);
    }
  });
  app.save(config);
});

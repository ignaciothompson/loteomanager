/// <reference path="../pb_data/types.d.ts" />

/**
 * Leads contextuales: barrio_id en interesados + email opcional
 * (form público acepta email O teléfono).
 */
migrate((app) => {
  const interesados = app.findCollectionByNameOrId("interesados");
  const barrios = app.findCollectionByNameOrId("barrios");

  if (!interesados.fields.getByName("barrio_id")) {
    interesados.fields.add(
      new RelationField({
        name: "barrio_id",
        collectionId: barrios.id,
        required: false,
        maxSelect: 1,
      }),
    );
  }

  // Formulario público: nombre + (email | teléfono). Schema original exigía email.
  const emailField = interesados.fields.getByName("email");
  if (emailField) {
    emailField.required = false;
  }

  app.save(interesados);
}, (app) => {
  const interesados = app.findCollectionByNameOrId("interesados");

  if (interesados.fields.getByName("barrio_id")) {
    interesados.fields.removeByName("barrio_id");
  }

  const emailField = interesados.fields.getByName("email");
  if (emailField) {
    emailField.required = true;
  }

  app.save(interesados);
});

/**
 * Aplica deltas de schema post pocketbase-typegen (migración ingreso unidades).
 * Corre automáticamente al final de npm run pb:types.
 *
 * Idempotente: si typegen ya emite plantillas_unidad / TipoUnidadIngreso, no toca nada
 * salvo asegurar el alias TipoUnidadIngreso en BarriosRecord.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "shared-types", "src", "lib", "pocketbase-types.ts");

let src = readFileSync(out, "utf8");

const hasTipoAlias = src.includes("export type TipoUnidadIngreso");
const hasPlantillasInCollections = /\tPlantillasUnidad: "plantillas_unidad",/.test(src);
const plantillasCount = (src.match(/\tPlantillasUnidad: "plantillas_unidad",/g) || []).length;

// Deduplicate Collections key if patch ran twice historically
if (plantillasCount > 1) {
  src = src.replace(
    /(\tPlantillasUnidad: "plantillas_unidad",\n)+/,
    '\tPlantillasUnidad: "plantillas_unidad",\n',
  );
}

// Deduplicate CollectionRecords / Responses entries
src = src.replace(
  /(\tplantillas_unidad: PlantillasUnidadRecord\n)+/g,
  "\tplantillas_unidad: PlantillasUnidadRecord\n",
);
src = src.replace(
  /(\tplantillas_unidad: PlantillasUnidadResponse\n)+/g,
  "\tplantillas_unidad: PlantillasUnidadResponse\n",
);
src = src.replace(
  /(export type PlantillasUnidadResponse<Texpand = unknown> = Required<PlantillasUnidadRecord> & BaseSystemFields<Texpand>\n)+/g,
  "export type PlantillasUnidadResponse<Texpand = unknown> = Required<PlantillasUnidadRecord> & BaseSystemFields<Texpand>\n",
);

// Normalize BarriosRecord tipos_unidad to TipoUnidadIngreso[]
if (!hasTipoAlias) {
  src = src.replace(
    /export type BarriosRecord</,
    `export type TipoUnidadIngreso = 'lote_vacio' | 'casa_construida' | 'casa_prefabricada'\n\nexport type BarriosRecord<`,
  );
}

// Collapse duplicate tipos_unidad lines inside BarriosRecord
src = src.replace(
  /export type BarriosRecord<[^>]+> = \{[\s\S]*?\n\}/,
  (block) => {
    let next = block.replace(/\n\ttipos_unidad\?:[^\n]+\n/g, "\n");
    next = next.replace(
      /(\tslug: string\n)/,
      "$1\ttipos_unidad?: TipoUnidadIngreso[]\n",
    );
    // Drop unused Ttipos_unidad generic if present
    next = next.replace(
      /export type BarriosRecord<Textras = unknown, Tsnapshot = unknown, Ttipos_unidad = unknown>/,
      "export type BarriosRecord<Textras = unknown, Tsnapshot = unknown>",
    );
    return next;
  },
);

src = src.replace(
  /export type BarriosResponse<Textras = unknown, Tsnapshot = unknown, Ttipos_unidad = unknown, Texpand = unknown> = Required<BarriosRecord<Textras, Tsnapshot, Ttipos_unidad>> & BaseSystemFields<Texpand>/,
  "export type BarriosResponse<Textras = unknown, Tsnapshot = unknown, Texpand = unknown> = Required<BarriosRecord<Textras, Tsnapshot>> & BaseSystemFields<Texpand>",
);

// Legacy path: typegen sin plantillas_unidad — insertar (solo si falta)
if (!hasPlantillasInCollections) {
  src = src.replace(
    /(\tInteresados: "interesados",\n)/,
    '$1\tPlantillasUnidad: "plantillas_unidad",\n',
  );
}

if (!src.includes("export type PlantillasUnidadRecord")) {
  // Keep old heavy patch path out — schema ahora viene de typegen.
  console.warn(
    "=> pb-typegen-patch: PlantillasUnidadRecord ausente en typegen; revisar migración plantillas_unidad.",
  );
}

writeFileSync(out, src, "utf8");
console.log("=> pb-typegen-patch: deltas ingreso unidades aplicados.");

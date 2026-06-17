/**
 * Aplica deltas de schema post pocketbase-typegen (migración ingreso unidades).
 * Corre automáticamente al final de npm run pb:types.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "shared-types", "src", "lib", "pocketbase-types.ts");

let src = readFileSync(out, "utf8");

if (src.includes("TipoUnidadIngreso")) {
  console.log("=> pb-typegen-patch: ya aplicado, skip.");
  process.exit(0);
}

// Collections
src = src.replace(
  /(\tInteresados: "interesados",\n)/,
  '$1\tPlantillasUnidad: "plantillas_unidad",\n',
);

// BarriosRecord
src = src.replace(
  /export type BarriosRecord<Textras = unknown> = \{/,
  `export type TipoUnidadIngreso = 'lote_vacio' | 'casa_construida' | 'casa_prefabricada'

export type BarriosRecord<Textras = unknown> = {`,
);
src = src.replace(
  /(\tslug: string\n)/,
  `$1\ttipos_unidad?: TipoUnidadIngreso[]\n`,
);

// Unidades tipo/moneda options + record fields
src = src.replace(
  /export const UnidadesTipoUnidadOptions = \{[\s\S]*?\} as const\nexport type UnidadesTipoUnidadOptions = typeof UnidadesTipoUnidadOptions\[keyof typeof UnidadesTipoUnidadOptions\]\n\nexport const UnidadesMonedaOptions = \{[\s\S]*?\} as const\nexport type UnidadesMonedaOptions = typeof UnidadesMonedaOptions\[keyof typeof UnidadesMonedaOptions\]\nexport type UnidadesRecord<Textras = unknown> = \{[\s\S]*?\ttipo_unidad: UnidadesTipoUnidadOptions\n\}/,
  `export const UnidadesTipoUnidadOptions = {
	"lote_vacio": "lote_vacio",
	"casa_construida": "casa_construida",
	"casa_prefabricada": "casa_prefabricada",
} as const
export type UnidadesTipoUnidadOptions = typeof UnidadesTipoUnidadOptions[keyof typeof UnidadesTipoUnidadOptions]

export const UnidadesMonedaOptions = {
	"USD": "USD",
	"UYU": "UYU",
	"ARS": "ARS",
} as const
export type UnidadesMonedaOptions = typeof UnidadesMonedaOptions[keyof typeof UnidadesMonedaOptions]

export const UnidadesOrientacionOptions = {
	"Norte": "Norte",
	"Sur": "Sur",
	"Este": "Este",
	"Oeste": "Oeste",
	"Noreste": "Noreste",
	"Noroeste": "Noroeste",
	"Sureste": "Sureste",
	"Suroeste": "Suroeste",
} as const
export type UnidadesOrientacionOptions = typeof UnidadesOrientacionOptions[keyof typeof UnidadesOrientacionOptions]

export type UnidadesRecord<Textras = unknown> = {
	ambientes?: number
	antiguedad_anios?: number
	arquitecto_id?: RecordIdString
	area_m2?: number
	barrio_id?: RecordIdString
	cocheras?: number
	codigo: string
	codigo_interno?: string
	descripcion?: HTMLString
	destacado?: boolean
	direccion_propia?: string
	en_oferta?: boolean
	estado: string
	extras?: null | Textras
	fecha_bloqueo?: IsoDateString
	fecha_escritura?: IsoDateString
	fecha_ingreso?: IsoDateString
	fecha_reserva?: IsoDateString
	fecha_sena?: IsoDateString
	fecha_venta?: IsoDateString
	galeria?: FileNameString[]
	id: string
	interesado_comprador_id?: RecordIdString
	metros_construidos?: number
	metros_cuadrados?: number
	moneda: UnidadesMonedaOptions
	numero_unidad?: string
	oferta?: boolean
	orientacion?: UnidadesOrientacionOptions
	pendiente_publicar?: boolean
	plano_unidad?: FileNameString
	precio?: number
	precio_oferta?: number
	responsable_id: RecordIdString
	tipo_unidad: UnidadesTipoUnidadOptions
	web_visible?: boolean
}

export const PlantillasUnidadEstadoInicialOptions = {
	"disponible": "disponible",
	"reservado": "reservado",
	"bloqueado": "bloqueado",
} as const
export type PlantillasUnidadEstadoInicialOptions = typeof PlantillasUnidadEstadoInicialOptions[keyof typeof PlantillasUnidadEstadoInicialOptions]

export type PlantillasUnidadRecord = {
	area_m2?: number
	barrio_id: RecordIdString
	cantidad: number
	estado_inicial?: PlantillasUnidadEstadoInicialOptions
	id: string
	modelo?: string
	moneda?: UnidadesMonedaOptions
	nombre: string
	orientacion?: UnidadesOrientacionOptions
	patron_codigo: string
	precio?: number
	tipo_unidad: UnidadesTipoUnidadOptions
	web_visible?: boolean
}`,
);

// PlantillasUnidadResponse
src = src.replace(
  /(export type UnidadesResponse<Textras = unknown, Texpand = unknown> = Required<UnidadesRecord<Textras>> & BaseSystemFields<Texpand>\n)/,
  `$1export type PlantillasUnidadResponse<Texpand = unknown> = Required<PlantillasUnidadRecord> & BaseSystemFields<Texpand>\n`,
);

// CollectionRecords / CollectionResponses
src = src.replace(
  /(\tinteresados: InteresadosRecord\n)/,
  `$1\tplantillas_unidad: PlantillasUnidadRecord\n`,
);
src = src.replace(
  /(\tinteresados: InteresadosResponse\n)/,
  `$1\tplantillas_unidad: PlantillasUnidadResponse\n`,
);

writeFileSync(out, src, "utf8");
console.log("=> pb-typegen-patch: deltas ingreso unidades aplicados.");

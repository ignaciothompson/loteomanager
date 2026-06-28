/**
 * Snapshot enriquecido de una comparativa para la landing pública y PDF.
 * Lo arma `apps/landing/src/server/snapshot-builder.ts` a partir de registros PB.
 */

export interface ComparativaSnapshotUnidad {
  id: string;
  codigoInterno: string;
  tipoUnidad: string;
  tipoUnidadLabel: string;
  precio: number;
  moneda: string;
  precioFormateado: string;
  enOferta: boolean;
  precioOriginal: number | null;
  precioOriginalFormateado: string | null;
  metrosCuadrados: number;
  metrosConstruidos: number | null;
  ambientes: number | null;
  antiguedadAnios: number | null;
  cocheras: number | null;
  barrioId: string | null;
  barrioNombre: string | null;
  lat: number | null;
  lng: number | null;
  ubicacionTexto: string | null;
  imagenHero: string | null;
  galeria: string[];
  urlPlano: string | null;
}

export interface ComparativaSnapshot {
  titulo: string;
  mensajePersonalizado: string | null;
  unidades: ComparativaSnapshotUnidad[];
  generadoEn: string;
}

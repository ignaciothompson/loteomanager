/**
 * Snapshot fijo de un barrio publicado para la landing pública.
 * Lo arma PublicacionService.publicarBarrio() a partir de datos vivos.
 */

export interface BarrioWebSnapshotBarrio {
  id: string;
  nombre: string;
  slug: string;
  zona: string | null;
  descripcion: string | null;
  ubicacion_texto: string | null;
  imagen_portada: string | null;
  plano_general: string | null;
  lat: number | null;
  lng: number | null;
}

export interface BarrioWebSnapshotUnidad {
  id: string;
  codigo: string;
  tipo: string;
  area: number | null;
  orientacion: string | null;
  precio: number | null;
  moneda: string;
  estado: string;
  en_oferta: boolean;
  precio_oferta: number | null;
  extras: Record<string, unknown>;
  /** Campos enriquecidos para ficha /lote */
  descripcion?: string | null;
  galeria?: string[];
  plano_unidad?: string | null;
  metros_construidos?: number | null;
  numero_unidad?: string | null;
  ambientes?: number | null;
  antiguedad_anios?: number | null;
  cocheras?: number | null;
}

export interface BarrioWebSnapshot {
  barrio: BarrioWebSnapshotBarrio;
  unidades: BarrioWebSnapshotUnidad[];
  generado_at: string;
}

export type UnidadDiffKind = 'nueva' | 'modificada' | 'eliminada' | 'oculta';

export interface UnidadPublicacionDiff {
  unidadId: string;
  codigo: string;
  kind: UnidadDiffKind;
  campo?: string;
  antes?: string;
  despues?: string;
}

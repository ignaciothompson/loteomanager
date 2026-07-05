import type { TipoUnidadIngreso } from '@loteomanager/shared-types';

export type EstadoFila = 'ok' | 'duplicado' | 'error' | 'advertencia';

export type DecisionUsuario = 'pendiente' | 'omitir' | 'crear' | 'actualizar';

/** Columnas mínimas que debe tener la hoja Datos. */
export const COLUMNAS_REQUERIDAS = [
  'tipo',
  'codigo',
  'codigo_barrio',
  'numero_lote',
  'metros_cuadrados',
  'precio',
] as const;

/** Todas las columnas del formato v2 (hoja Datos). */
export const COLUMNAS_EXCEL = [
  'tipo',
  'codigo',
  'nombre',
  'slug',
  'zona',
  'descripcion',
  'codigo_barrio',
  'numero_lote',
  'metros_cuadrados',
  'precio',
  'moneda',
  'estado',
  'orientacion',
] as const;

export interface BarrioNormalizado {
  nombre: string;
  slug: string;
  tipos_unidad: TipoUnidadIngreso[];
  descripcion?: string;
  zona?: string;
}

export interface UnidadNormalizado {
  codigo: string;
  tipo_unidad: 'lote_vacio';
  area_m2: number;
  metros_cuadrados: number;
  precio: number;
  moneda: 'USD' | 'ARS';
  estado: string;
  orientacion?: string;
}

export interface RawRow {
  numero_fila: number;
  data: Record<string, unknown>;
}

export interface ResultadoCommit {
  filas_aplicadas: number;
  filas_fallidas: number;
  filas_omitidas: number;
}

export interface FilaProcesada {
  numero_fila: number;
  tipo_fila: 'barrio' | 'unidad';
  datos_originales: Record<string, unknown>;
  datos_normalizados: BarrioNormalizado | UnidadNormalizado;
  estado_fila: EstadoFila;
  mensajes: string[];
  decision_usuario: DecisionUsuario;
  registro_existente_id?: string;
  ref_barrio?: string;
}

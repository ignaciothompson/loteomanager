import type { TipoUnidadIngreso } from '@loteomanager/shared-types';

export type EstadoFila = 'ok' | 'duplicado' | 'error' | 'advertencia';

export type DecisionUsuario = 'pendiente' | 'omitir' | 'crear';

export type MonedaImportacion = 'USD' | 'UYU';

export const COLUMNAS_LOTES = [
  'numero_lote',
  'metros_cuadrados',
  'precio',
  'moneda',
  'estado',
  'orientacion',
] as const;

export const ORIENTACIONES_CANONICAS = [
  'Norte',
  'Sur',
  'Este',
  'Oeste',
  'Noreste',
  'Noroeste',
  'Sureste',
  'Suroeste',
] as const;

export type OrientacionCanon = (typeof ORIENTACIONES_CANONICAS)[number];

export const TIPOS_UNIDAD_VALIDOS: TipoUnidadIngreso[] = [
  'lote_vacio',
  'casa_construida',
  'casa_prefabricada',
];

export const ETIQUETAS_CABEZAL = {
  nombre_del_barrio: 'nombre',
  departamento: 'departamento',
  zona: 'zona',
  tipos_de_unidad: 'tipos_unidad',
  descripcion: 'descripcion',
  ubicacion_texto: 'ubicacion_texto',
  moneda_por_defecto: 'moneda_default',
  estado_por_defecto: 'estado_default',
} as const;

export type CampoCorreccion =
  | 'precio'
  | 'moneda'
  | 'estado'
  | 'orientacion'
  | 'metros_cuadrados'
  | 'numero_lote'
  | 'departamento'
  | 'zona';

export interface CorreccionSugerida {
  campo: CampoCorreccion;
  valor_original: string;
  valor_sugerido: string;
  motivo: string;
}

export type CodigoProblema =
  | 'CABEZAL_INCOMPLETO'
  | 'GEO_SIN_MAPEAR'
  | 'FALTA_NUMERO_LOTE'
  | 'FALTA_METROS'
  | 'METROS_NO_NUMERICO'
  | 'FALTA_PRECIO'
  | 'PRECIO_NO_NUMERICO'
  | 'ESTADO_DESCONOCIDO'
  | 'MONEDA_INVALIDA'
  | 'ORIENTACION_INVALIDA'
  | 'LOTE_DUPLICADO_ARCHIVO'
  | 'LOTE_DUPLICADO_BD';

export type AccionMasivaCodigo =
  | 'completar_cabezal'
  | 'abrir_mapeo'
  | 'omitir'
  | 'asignar'
  | 'aplicar_sugerencia'
  | 'elegir_estado'
  | 'elegir_moneda'
  | 'elegir_orientacion'
  | 'dejar_vacia'
  | 'quedarse_primera';

export interface AccionMasiva {
  codigo: AccionMasivaCodigo;
  campo?: string;
  label: string;
}

export interface ProblemaAgrupado {
  codigo: CodigoProblema;
  campo: string | null;
  hoja: string | null;
  mensaje: string;
  filas_ids: string[];
  barrios: { nombre: string; count: number }[];
  acciones: AccionMasiva[];
}

export type MapeoEstado = 'confirmado' | 'sugerencia' | 'sin_resolver';

export interface MapeoEntradaDepto {
  valor_excel: string;
  departamento_id: string | null;
  estado: MapeoEstado;
  nombre_sugerido?: string;
  usos?: number;
}

export interface MapeoEntradaZona {
  valor_excel: string;
  departamento_excel: string;
  zona_id: string | null;
  estado: MapeoEstado;
  nombre_sugerido?: string;
  usos?: number;
}

export interface MapeoGeografia {
  barrio_destino_id?: string;
  departamentos: MapeoEntradaDepto[];
  zonas: MapeoEntradaZona[];
  conteo?: { barrios: number; lotes: number };
  resultado?: { lotes_creados: number; omitidos: number; barrios_creados: number };
}

export interface CabezalBarrio {
  nombre: string;
  slug: string;
  departamento_excel: string;
  zona_excel: string;
  tipos_unidad: TipoUnidadIngreso[];
  descripcion?: string;
  ubicacion_texto?: string;
  moneda_default: MonedaImportacion;
  estado_default: string;
  barrio_existente: boolean;
  barrio_resuelto_id?: string | null;
  nombre_hoja: string;
  plantilla_fila_id?: string | null;
  plantilla_nombre?: string;
  advertencia_nombre_destino?: boolean;
}

export interface FilaLote {
  codigo: string;
  tipo_unidad: 'lote_vacio';
  area_m2: number;
  metros_cuadrados: number;
  precio: number;
  moneda: MonedaImportacion;
  estado: string;
  orientacion?: string;
}

export interface RawLoteRow {
  fila_excel: number;
  data: Record<string, unknown>;
}

export interface HojaBarrioRaw {
  nombre_hoja: string;
  fmt_version: number | null;
  cabezal: Record<string, string>;
  lotes: RawLoteRow[];
}

export interface ResultadoCommit {
  filas_aplicadas: number;
  filas_fallidas: number;
  filas_omitidas: number;
  barrios_creados: number;
  lotes_creados: number;
  plantillas_guardadas: number;
  barrios: { id: string; nombre: string }[];
  omisiones: { codigo: string; motivo: string }[];
}

export interface FilaProcesada {
  numero_fila: number;
  tipo_fila: 'barrio' | 'unidad';
  datos_originales: Record<string, unknown>;
  datos_normalizados: CabezalBarrio | FilaLote;
  estado_fila: EstadoFila;
  mensajes: string[];
  decision_usuario: DecisionUsuario;
  registro_existente_id?: string;
  ref_barrio: string;
  correcciones_sugeridas: CorreccionSugerida[];
  nombre_hoja: string;
  fila_excel: number;
}

export interface AnalizarExcelOpts {
  barrioDestinoId?: string;
}

export class ImportadorFormatoError extends Error {
  constructor(
    message: string,
    readonly codigo: 'V2' | 'EXPORTADOR' | 'VACIO' | 'SIZE' | 'ATAJO_MULTIHOJA'
  ) {
    super(message);
    this.name = 'ImportadorFormatoError';
  }
}

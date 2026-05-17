export interface AnalisisColumnas {
  columnasConocidas: Map<string, string>; // excelHeader → targetField
  columnasExtras: Map<string, string | null>; // "Extra: X" → extraId or null if not matched
  columnasDesconocidas: string[]; // excel headers not recognized
  necesitaMapeoColumnas: boolean;
  necesitaMapeoExtras: boolean;
}

export interface FilaProcesada {
  numero_fila: number;
  tipo_fila: 'barrio' | 'unidad';
  datos_originales: Record<string, unknown>;
  datos_normalizados: Record<string, unknown>;
  estado_fila: 'ok' | 'duplicado' | 'error' | 'advertencia';
  mensajes: string[];
  registro_existente_id?: string;
  decision_usuario: 'pendiente' | 'omitir' | 'crear' | 'actualizar';
}

export interface ResultadoAnalisis {
  importacion_id: string;
  analisis_columnas: AnalisisColumnas;
  filas: FilaProcesada[];
  total_filas: number;
  filas_ok: number;
  filas_duplicado: number;
  filas_error: number;
  filas_advertencia: number;
}

export interface ResultadoCommit {
  importacion_id: string;
  filas_aplicadas: number;
  filas_fallidas: number;
  filas_omitidas: number;
  errores: Array<{ numero_fila: number; error: string }>;
}

export type MapeoColumnas = Record<string, string | null>;
export type MapeoExtras = Record<string, string | null>;

export const COLUMNAS_BARRIO: Record<string, string> = {
  codigo_interno: 'codigo_interno',
  nombre: 'nombre',
  slug: 'slug',
  descripcion: 'descripcion',
  ubicacion_texto: 'ubicacion_texto',
  lat: 'lat',
  lng: 'lng',
  zona: 'zona',
};

export const COLUMNAS_UNIDAD: Record<string, string> = {
  codigo_interno: 'codigo_interno',
  barrio_codigo_interno: 'barrio_codigo_interno',
  tipo_unidad: 'tipo_unidad',
  numero_unidad: 'numero_unidad',
  direccion_propia: 'direccion_propia',
  metros_cuadrados: 'metros_cuadrados',
  metros_construidos: 'metros_construidos',
  ambientes: 'ambientes',
  antiguedad_anios: 'antiguedad_anios',
  cocheras: 'cocheras',
  precio: 'precio',
  moneda: 'moneda',
  estado: 'estado',
  oferta: 'oferta',
  precio_oferta: 'precio_oferta',
  destacado: 'destacado',
  responsable_email: 'responsable_email',
  descripcion: 'descripcion',
};

export const COLUMNAS_CONOCIDAS_ALL = new Set([
  'tipo',
  ...Object.keys(COLUMNAS_BARRIO),
  ...Object.keys(COLUMNAS_UNIDAD),
]);

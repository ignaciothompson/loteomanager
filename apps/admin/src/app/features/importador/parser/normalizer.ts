import { ExtrasDefinicion, ExtraPersistido } from '@loteomanager/shared-types';
import { AnalisisColumnas } from './types';

/** Parses a boolean-like Excel value. */
export function parseBoolean(val: unknown): boolean | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = String(val).toLowerCase().trim();
  if (['si', 'sí', 'yes', 'true', '1'].includes(s)) return true;
  if (['no', 'false', '0'].includes(s)) return false;
  return null;
}

/** Parses a numeric value. Returns null if not a valid number. */
export function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const n = Number(String(val).replace(/,/g, '.'));
  return isNaN(n) ? null : n;
}

/** Generates a URL-friendly slug from a string. */
export function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export interface NormalizedBarrio {
  nombre: string;
  slug: string;
  codigo_interno_ref: string; // for cross-referencing, not stored in PB
  descripcion?: string;
  ubicacion_texto?: string;
  lat?: number;
  lng?: number;
  zona?: string;
  extras?: ExtraPersistido[];
}

export interface NormalizedUnidad {
  tipo_unidad: 'lote' | 'casa' | 'departamento';
  codigo_interno: string;
  barrio_codigo_interno_ref?: string; // cross-reference, not stored directly
  barrio_id?: string; // resolved ID after processing
  numero_unidad?: string;
  direccion_propia?: string;
  metros_cuadrados: number;
  metros_construidos?: number;
  ambientes?: number;
  antiguedad_anios?: number;
  cocheras?: number;
  precio: number;
  moneda: 'USD' | 'ARS';
  estado: string;
  oferta?: boolean;
  precio_oferta?: number;
  destacado?: boolean;
  responsable_email?: string;
  responsable_id?: string; // resolved after lookup
  descripcion?: string;
  extras?: ExtraPersistido[];
}

/** Normalize a raw barrio row. Returns normalized data + validation errors. */
export function normalizeBarrioRow(
  rawData: Record<string, unknown>,
  analisis: AnalisisColumnas,
  extrasDefiniciones: ExtrasDefinicion[]
): { data: NormalizedBarrio; errores: string[]; advertencias: string[] } {
  const errores: string[] = [];
  const advertencias: string[] = [];

  const mapped = mapFields(rawData, analisis.columnasConocidas);

  const nombre = mapped['nombre'] as string | undefined;
  const codigo_interno = mapped['codigo_interno'] as string | undefined;

  if (!codigo_interno) errores.push('El campo "codigo_interno" es obligatorio.');
  if (!nombre) errores.push('El campo "nombre" es obligatorio para filas de tipo barrio.');

  const slugVal = mapped['slug'] as string | undefined;
  const resolvedSlug = slugVal ? slugVal : nombre ? slugify(nombre) : '';

  const extras = processExtras(rawData, analisis.columnasExtras, extrasDefiniciones, advertencias);

  const data: NormalizedBarrio = {
    nombre: nombre ?? '',
    slug: resolvedSlug,
    codigo_interno_ref: codigo_interno ?? '',
    descripcion: mapped['descripcion'] as string | undefined,
    ubicacion_texto: mapped['ubicacion_texto'] as string | undefined,
    lat: parseNumber(mapped['lat']) ?? undefined,
    lng: parseNumber(mapped['lng']) ?? undefined,
    zona: mapped['zona'] as string | undefined,
    extras,
  };

  return { data, errores, advertencias };
}

/** Normalize a raw unidad row. Returns normalized data + validation errors. */
export function normalizeUnidadRow(
  rawData: Record<string, unknown>,
  analisis: AnalisisColumnas,
  extrasDefiniciones: ExtrasDefinicion[]
): { data: NormalizedUnidad; errores: string[]; advertencias: string[] } {
  const errores: string[] = [];
  const advertencias: string[] = [];

  const mapped = mapFields(rawData, analisis.columnasConocidas);

  const codigo_interno = String(mapped['codigo_interno'] ?? '').trim();
  if (!codigo_interno) errores.push('El campo "codigo_interno" es obligatorio.');

  const tipo_unidad = String(mapped['tipo_unidad'] ?? '').toLowerCase().trim();
  if (!['lote', 'casa', 'departamento'].includes(tipo_unidad)) {
    errores.push(
      `El campo "tipo_unidad" debe ser lote, casa o departamento. Valor recibido: "${mapped['tipo_unidad']}".`
    );
  }

  const metros_cuadrados = parseNumber(mapped['metros_cuadrados']);
  if (metros_cuadrados === null)
    errores.push('El campo "metros_cuadrados" es obligatorio y debe ser un número.');

  const precio = parseNumber(mapped['precio']);
  if (precio === null)
    errores.push('El campo "precio" es obligatorio y debe ser un número.');

  const barrio_codigo_interno_ref = mapped['barrio_codigo_interno'] as string | undefined;
  const direccion_propia = mapped['direccion_propia'] as string | undefined;

  if (!barrio_codigo_interno_ref && !direccion_propia) {
    errores.push(
      'Se requiere "barrio_codigo_interno" o "direccion_propia" si la unidad no pertenece a un barrio.'
    );
  }

  const monedaRaw = String(mapped['moneda'] ?? 'USD').toUpperCase().trim();
  const moneda: 'USD' | 'ARS' = monedaRaw === 'ARS' ? 'ARS' : 'USD';

  const estadoRaw = String(mapped['estado'] ?? 'disponible').trim();

  const ofertaRaw = parseBoolean(mapped['oferta']);
  const destacadoRaw = parseBoolean(mapped['destacado']);

  const responsable_email = mapped['responsable_email'] as string | undefined;

  const extras = processExtras(rawData, analisis.columnasExtras, extrasDefiniciones, advertencias);

  const data: NormalizedUnidad = {
    tipo_unidad: (['lote', 'casa', 'departamento'].includes(tipo_unidad)
      ? tipo_unidad
      : 'lote') as 'lote' | 'casa' | 'departamento',
    codigo_interno,
    barrio_codigo_interno_ref: barrio_codigo_interno_ref || undefined,
    numero_unidad: mapped['numero_unidad'] as string | undefined,
    direccion_propia: direccion_propia || undefined,
    metros_cuadrados: metros_cuadrados ?? 0,
    metros_construidos: parseNumber(mapped['metros_construidos']) ?? undefined,
    ambientes: parseNumber(mapped['ambientes']) ?? undefined,
    antiguedad_anios: parseNumber(mapped['antiguedad_anios']) ?? undefined,
    cocheras: parseNumber(mapped['cocheras']) ?? undefined,
    precio: precio ?? 0,
    moneda,
    estado: estadoRaw,
    oferta: ofertaRaw ?? undefined,
    precio_oferta: parseNumber(mapped['precio_oferta']) ?? undefined,
    destacado: destacadoRaw ?? undefined,
    responsable_email: responsable_email || undefined,
    descripcion: mapped['descripcion'] as string | undefined,
    extras,
  };

  return { data, errores, advertencias };
}

/** Maps raw Excel data (keyed by excel header) to field names using the column mapping. */
function mapFields(
  rawData: Record<string, unknown>,
  columnasConocidas: Map<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [header, value] of Object.entries(rawData)) {
    const field = columnasConocidas.get(header) ?? header.toLowerCase().trim();
    out[field] = value;
  }
  return out;
}

/** Processes "Extra: X" columns and returns ExtraPersistido array. */
function processExtras(
  rawData: Record<string, unknown>,
  columnasExtras: Map<string, string | null>,
  extrasDefiniciones: ExtrasDefinicion[],
  advertencias: string[]
): ExtraPersistido[] {
  const extras: ExtraPersistido[] = [];

  for (const [header, extraId] of columnasExtras.entries()) {
    const rawVal = rawData[header];
    if (rawVal === null || rawVal === undefined || rawVal === '') continue;

    if (!extraId) {
      advertencias.push(
        `La columna "${header}" no está mapeada a ningún extra. Se ignorará hasta que se complete el mapeo.`
      );
      continue;
    }

    const def = extrasDefiniciones.find(e => e.id === extraId);
    if (!def) {
      advertencias.push(`No se encontró la definición de extra para "${header}". Se ignorará.`);
      continue;
    }

    let valor: string | number | boolean | null = null;
    switch (def.tipo) {
      case 'numero':
        valor = parseNumber(rawVal);
        if (valor === null && rawVal !== '') {
          advertencias.push(
            `Extra "${def.nombre}": valor "${rawVal}" no es un número válido. Se ignorará.`
          );
        }
        break;
      case 'booleano':
        valor = parseBoolean(rawVal);
        break;
      case 'texto':
      case 'opciones':
      case 'fecha':
        valor = String(rawVal).trim();
        break;
    }

    extras.push({ extra_id: def.id, code: def.code, nombre: def.nombre, valor });
  }

  return extras;
}

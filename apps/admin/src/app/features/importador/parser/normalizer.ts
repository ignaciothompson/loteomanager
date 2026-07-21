import type { BarrioNormalizado, UnidadNormalizado } from './types';

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

export function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const n = Number(String(val).replace(/,/g, '.'));
  return isNaN(n) ? null : n;
}

export function str(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

export function normalizeBarrioRow(
  data: Record<string, unknown>,
  numeroFila: number
): { data: BarrioNormalizado; errores: string[]; ref_barrio: string } {
  const errores: string[] = [];
  const prefix = `Fila ${numeroFila}:`;

  const ref_barrio = str(data['codigo']);
  if (!ref_barrio) errores.push(`${prefix} "codigo" es obligatorio para filas barrio.`);

  const nombre = str(data['nombre']);
  if (!nombre) errores.push(`${prefix} "nombre" es obligatorio.`);

  const slugExplicit = str(data['slug']);
  const slug = slugExplicit || (nombre ? slugify(nombre) : '');
  if (!slug) errores.push(`${prefix} no se pudo generar slug.`);

  const descripcion = str(data['descripcion']) || undefined;
  const zona = str(data['zona']) || undefined;

  return {
    ref_barrio,
    data: {
      nombre,
      slug,
      tipos_unidad: ['lote_vacio'],
      descripcion,
      zona,
    },
    errores,
  };
}

export function normalizeUnidadRow(
  data: Record<string, unknown>,
  numeroFila: number
): { data: UnidadNormalizado; errores: string[]; ref_barrio: string } {
  const errores: string[] = [];
  const prefix = `Fila ${numeroFila}:`;

  const ref_barrio = str(data['codigo_barrio']);
  if (!ref_barrio) {
    errores.push(`${prefix} "codigo_barrio" es obligatorio.`);
  }

  const numero_lote = str(data['numero_lote']);
  if (!numero_lote) errores.push(`${prefix} "numero_lote" es obligatorio.`);

  const metros = parseNumber(data['metros_cuadrados']);
  if (metros === null) {
    errores.push(`${prefix} "metros_cuadrados" debe ser un número.`);
  }

  const precio = parseNumber(data['precio']);
  if (precio === null) {
    errores.push(`${prefix} "precio" debe ser un número.`);
  }

  const monedaRaw = str(data['moneda'] || 'USD').toUpperCase();
  const moneda: 'USD' | 'ARS' = monedaRaw === 'ARS' ? 'ARS' : 'USD';

  const estado = str(data['estado'] || 'disponible') || 'disponible';
  const orientacion = str(data['orientacion']) || undefined;

  return {
    ref_barrio,
    data: {
      codigo: numero_lote,
      tipo_unidad: 'lote_vacio',
      area_m2: metros ?? 0,
      metros_cuadrados: metros ?? 0,
      precio: precio ?? 0,
      moneda,
      estado,
      orientacion,
    },
    errores,
  };
}

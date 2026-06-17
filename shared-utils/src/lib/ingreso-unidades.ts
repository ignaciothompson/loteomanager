import type { TipoUnidadIngreso } from '@loteomanager/shared-types';

export const TIPO_UNIDAD_LABELS = {
  lote_vacio: 'Lote vacío',
  casa_construida: 'Casa construida',
  casa_prefabricada: 'Casa prefabricada',
} as const satisfies Record<TipoUnidadIngreso, string>;

export const TIPO_UNIDAD_BADGE_CLASS = {
  lote_vacio: 'bg-green-100 text-green-800',
  casa_construida: 'bg-blue-100 text-blue-800',
  casa_prefabricada: 'bg-amber-100 text-amber-800',
} as const satisfies Record<TipoUnidadIngreso, string>;

/** Patrón "A-{n}" cantidad 5 → A-1 … A-5 */
export function expandirPatron(patron: string, cantidad: number): string[] {
  const n = Math.max(0, Math.floor(cantidad));
  if (!patron.includes('{n}') || n === 0) return [];
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    out.push(patron.replace(/\{n\}/g, String(i)));
  }
  return out;
}

export function previewPatronRango(patron: string, cantidad: number, max = 5): string {
  const codigos = expandirPatron(patron, cantidad);
  if (!codigos.length) return 'Sin preview (usá {n} en el patrón)';
  if (codigos.length <= max) return codigos.join(', ');
  const head = codigos.slice(0, max).join(', ');
  return `${head} … (+${codigos.length - max} más)`;
}

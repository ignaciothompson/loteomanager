/**
 * Tipos de dominio para extras configurables y estados (colecciones PocketBase).
 * Complementan `pocketbase-types.ts` hasta que `npm run pb:types` incluya estas colecciones.
 */

export type EntidadExtra = 'barrios' | 'unidades' | 'interesados';
export type EntidadEstado = 'unidades' | 'interesados';

export type ExtraTipo = 'texto' | 'numero' | 'opciones' | 'booleano' | 'fecha';

/** Valor persistido en `extras[]` (fecha = ISO string). */
export type ExtraValor = string | number | boolean | null;

export interface ExtraPersistido {
  extra_id: string;
  code: string;
  nombre: string;
  valor: ExtraValor;
}

export interface ExtrasDefinicion {
  id: string;
  code: string;
  entidad: EntidadExtra;
  nombre: string;
  descripcion?: string | null;
  tipo: ExtraTipo;
  opciones?: unknown;
  requerido?: boolean;
  visible_en_lista?: boolean;
  visible_en_landing?: boolean;
  visible_en_comparativa?: boolean;
  orden_display?: number;
  grupo?: string | null;
  activo?: boolean;
  created?: string;
  updated?: string;
}

export interface EstadoDefinicion {
  id: string;
  code: string;
  entidad: EntidadEstado;
  nombre: string;
  color?: string;
  icono?: string | null;
  es_core?: boolean;
  orden_display?: number;
  activo?: boolean;
  created?: string;
  updated?: string;
}

/** Limpia el array antes de enviarlo a PocketBase (huecos, tipos raros del formulario). */
export function sanitizeExtrasPayload(input: unknown): ExtraPersistido[] {
  if (!Array.isArray(input)) return [];
  const out: ExtraPersistido[] = [];
  for (const x of input) {
    if (x == null || typeof x !== 'object' || Array.isArray(x)) continue;
    const extra_id = (x as { extra_id?: unknown }).extra_id;
    if (typeof extra_id !== 'string' || !extra_id) continue;
    const code = (x as { code?: unknown }).code;
    const nombre = (x as { nombre?: unknown }).nombre;
    const valor = (x as { valor?: unknown }).valor as ExtraValor;
    out.push({
      extra_id,
      code: typeof code === 'string' ? code : '',
      nombre: typeof nombre === 'string' ? nombre : '',
      valor: valor === undefined ? null : valor
    });
  }
  return out;
}

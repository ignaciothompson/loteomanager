import type { BarriosResponse, UnidadesResponse } from '@loteomanager/shared-types';
import type { EstadoDefinicion } from '@loteomanager/shared-types';

export interface DuplicateResult {
  isDuplicate: boolean;
  existingId?: string;
}

export function checkBarrioDuplicate(
  slug: string,
  existingBarrios: BarriosResponse[]
): DuplicateResult {
  const found = existingBarrios.find((b) => b.slug === slug);
  if (found) return { isDuplicate: true, existingId: found.id };
  return { isDuplicate: false };
}

export function checkUnidadDuplicate(
  codigo: string,
  barrioId: string | undefined,
  existingUnidades: UnidadesResponse[]
): DuplicateResult {
  if (!barrioId) return { isDuplicate: false };
  const found = existingUnidades.find(
    (u) => u.barrio_id === barrioId && (u.codigo === codigo || u.codigo_interno === codigo)
  );
  if (found) return { isDuplicate: true, existingId: found.id };
  return { isDuplicate: false };
}

export function validateEstadoUnidad(
  estado: string,
  estadosValidos: EstadoDefinicion[],
  numeroFila: number
): string | null {
  const codes = new Set([
    ...estadosValidos.map((e) => e.code),
    'disponible',
    'bloqueado',
    'reservado',
    'sena',
    'vendido',
    'escriturado',
  ]);
  if (!codes.has(estado)) {
    return `Fila ${numeroFila}: estado "${estado}" no válido.`;
  }
  return null;
}

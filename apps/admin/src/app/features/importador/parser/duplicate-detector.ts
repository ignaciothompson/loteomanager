import { BarriosResponse, UnidadesResponse } from '@loteomanager/shared-types';

export interface DuplicateResult {
  isDuplicate: boolean;
  existingId?: string;
}

/** Check if barrio already exists in DB by slug. */
export function checkBarrioDuplicate(
  slug: string,
  existingBarrios: BarriosResponse[]
): DuplicateResult {
  const found = existingBarrios.find(b => b.slug === slug);
  if (found) return { isDuplicate: true, existingId: found.id };
  return { isDuplicate: false };
}

/** Check if unidad already exists in DB by codigo_interno. */
export function checkUnidadDuplicate(
  codigo_interno: string,
  existingUnidades: UnidadesResponse[]
): DuplicateResult {
  const found = existingUnidades.find(u => u.codigo_interno === codigo_interno);
  if (found) return { isDuplicate: true, existingId: found.id };
  return { isDuplicate: false };
}

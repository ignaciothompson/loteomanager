import type { BarriosResponse, UnidadesResponse } from '@loteomanager/shared-types';

export interface DuplicateResult {
  isDuplicate: boolean;
  existingId?: string;
}

export function resolveBarrioExistente(
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
  if (!barrioId || !codigo) return { isDuplicate: false };
  const found = existingUnidades.find(
    (u) => u.barrio_id === barrioId && (u.codigo === codigo || u.codigo_interno === codigo)
  );
  if (found) return { isDuplicate: true, existingId: found.id };
  return { isDuplicate: false };
}

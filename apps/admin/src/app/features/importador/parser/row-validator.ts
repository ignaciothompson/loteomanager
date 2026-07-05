import type { EstadoDefinicion } from '@loteomanager/shared-types';

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

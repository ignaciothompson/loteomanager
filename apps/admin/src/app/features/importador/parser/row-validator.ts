import type { EstadoDefinicion } from '@loteomanager/shared-types';
import { sugerirEstado } from './autocorrect';

/** @deprecated Usar sugerirEstado / analyze. Se mantiene por compat de imports. */
export function validateEstadoUnidad(
  estado: string,
  estadosValidos: EstadoDefinicion[],
  numeroFila: number
): string | null {
  const r = sugerirEstado(estado, estadosValidos);
  if (!r.code) return `Fila ${numeroFila}: estado "${estado}" no válido.`;
  return null;
}

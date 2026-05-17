import { EstadoDefinicion } from '@loteomanager/shared-types';
import { NormalizedBarrio, NormalizedUnidad } from './normalizer';

export function validateBarrio(
  data: NormalizedBarrio,
  erroresNormalizacion: string[]
): string[] {
  const msgs = [...erroresNormalizacion];
  if (!data.nombre) msgs.push('El campo "nombre" es obligatorio.');
  if (!data.slug) msgs.push('No se pudo generar el slug para este barrio.');
  return msgs;
}

export function validateUnidad(
  data: NormalizedUnidad,
  erroresNormalizacion: string[],
  estadosValidos: EstadoDefinicion[]
): string[] {
  const msgs = [...erroresNormalizacion];

  if (data.estado) {
    const estadosCodes = estadosValidos.map(e => e.code);
    const hardcoded = ['disponible', 'bloqueado', 'reservado', 'sena', 'vendido', 'escriturado'];
    const allValidos = [...new Set([...estadosCodes, ...hardcoded])];
    if (!allValidos.includes(data.estado)) {
      msgs.push(
        `El estado "${data.estado}" no es válido. Estados permitidos: ${allValidos.join(', ')}.`
      );
    }
  }

  return msgs;
}

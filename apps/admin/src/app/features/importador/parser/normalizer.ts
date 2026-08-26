import type { TipoUnidadIngreso } from '@loteomanager/shared-types';
import type { EstadoDefinicion } from '@loteomanager/shared-types';
import type { BarriosResponse } from '@loteomanager/shared-types';
import { toSlug } from '@loteomanager/shared-utils';
import type { CabezalBarrio, CorreccionSugerida, FilaLote, MonedaImportacion } from './types';
import { TIPOS_UNIDAD_VALIDOS } from './types';
import { cellStr } from './text';
import {
  monedaEsValida,
  sugerirEstado,
  sugerirMoneda,
  sugerirNumero,
  sugerirOrientacion,
  sugerirTrim,
} from './autocorrect';

export function normalizeCabezal(
  raw: Record<string, string>,
  nombreHoja: string,
  existingBarrios: BarriosResponse[],
  barrioDestino?: BarriosResponse | null
): { data: CabezalBarrio; errores: string[]; advertencias: string[] } {
  const errores: string[] = [];
  const advertencias: string[] = [];

  const nombre = cellStr(raw['nombre']);
  if (!nombre) errores.push('Falta "Nombre del barrio".');
  if (nombre.length > 120) errores.push('El nombre del barrio no puede superar 120 caracteres.');

  const slug = nombre ? toSlug(nombre) : '';
  const existing = slug ? existingBarrios.find((b) => b.slug === slug) : undefined;

  const departamento_excel = cellStr(raw['departamento']);
  const zona_excel = cellStr(raw['zona']);
  if (!departamento_excel) errores.push('Falta "Departamento".');
  if (!zona_excel) errores.push('Falta "Zona".');

  const tipos_unidad = parseTiposUnidad(raw['tipos_unidad']);
  const monedaRaw = cellStr(raw['moneda_default']);
  const monedaSug = sugerirMoneda(monedaRaw || 'USD');
  const moneda_default: MonedaImportacion = monedaSug.valor;

  const estado_default = cellStr(raw['estado_default']) || 'disponible';

  let advertencia_nombre_destino = false;
  if (barrioDestino && nombre && toSlug(nombre) !== barrioDestino.slug) {
    advertencia_nombre_destino = true;
    advertencias.push(
      `El nombre del archivo ("${nombre}") no coincide con el barrio destino ("${barrioDestino.nombre}"). Manda el barrio destino.`
    );
  }

  const data: CabezalBarrio = {
    nombre,
    slug,
    departamento_excel,
    zona_excel,
    tipos_unidad,
    descripcion: cellStr(raw['descripcion']) || undefined,
    ubicacion_texto: cellStr(raw['ubicacion_texto']) || undefined,
    moneda_default,
    estado_default,
    barrio_existente: !!existing || !!barrioDestino,
    barrio_resuelto_id: barrioDestino?.id ?? existing?.id ?? null,
    nombre_hoja: nombreHoja,
    plantilla_nombre: nombre || undefined,
    advertencia_nombre_destino,
  };

  return { data, errores, advertencias };
}

export function parseTiposUnidad(raw?: string): TipoUnidadIngreso[] {
  const parts = cellStr(raw)
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return ['lote_vacio'];
  const valid = new Set<string>(TIPOS_UNIDAD_VALIDOS);
  const out: TipoUnidadIngreso[] = [];
  for (const p of parts) {
    const key = p.replace(/\s+/g, '_') as TipoUnidadIngreso;
    if (valid.has(key) && !out.includes(key)) out.push(key);
  }
  return out.length ? out : ['lote_vacio'];
}

export interface NormalizeLoteResult {
  data: FilaLote;
  errores: string[];
  advertencias: string[];
  correcciones: CorreccionSugerida[];
  codigos: string[];
}

export function normalizeLote(
  raw: Record<string, unknown>,
  cabezal: CabezalBarrio,
  estados: EstadoDefinicion[]
): NormalizeLoteResult {
  const errores: string[] = [];
  const advertencias: string[] = [];
  const correcciones: CorreccionSugerida[] = [];
  const codigos: string[] = [];

  const trimSug = sugerirTrim(raw['numero_lote'], 'numero_lote');
  const numeroRaw = cellStr(raw['numero_lote']);
  const codigo = numeroRaw.trim();
  if (trimSug) correcciones.push(trimSug);
  if (!codigo) {
    errores.push('Falta numero_lote.');
    codigos.push('FALTA_NUMERO_LOTE');
  }

  const metrosRaw = raw['metros_cuadrados'];
  const metrosSug = sugerirNumero(metrosRaw);
  let metros = 0;
  if (cellStr(metrosRaw) === '' && (metrosRaw === null || metrosRaw === undefined || metrosRaw === '')) {
    errores.push('Falta metros_cuadrados.');
    codigos.push('FALTA_METROS');
  } else if (!metrosSug) {
    errores.push('metros_cuadrados no es un número.');
    codigos.push('METROS_NO_NUMERICO');
  } else {
    metros = metrosSug.valor;
    if (metrosSug.motivo) {
      correcciones.push({
        campo: 'metros_cuadrados',
        valor_original: cellStr(metrosRaw),
        valor_sugerido: metrosSug.sugerido,
        motivo: metrosSug.motivo,
      });
      errores.push('metros_cuadrados no es un número.');
      codigos.push('METROS_NO_NUMERICO');
      metros = 0;
    } else if (metros <= 0) {
      errores.push('metros_cuadrados debe ser mayor a 0.');
      codigos.push('FALTA_METROS');
    }
  }

  const precioRaw = raw['precio'];
  const precioSug = sugerirNumero(precioRaw);
  let precio = 0;
  if (cellStr(precioRaw) === '' && (precioRaw === null || precioRaw === undefined || precioRaw === '')) {
    errores.push('Falta precio.');
    codigos.push('FALTA_PRECIO');
  } else if (!precioSug) {
    errores.push('precio no es un número.');
    codigos.push('PRECIO_NO_NUMERICO');
  } else {
    precio = precioSug.valor;
    if (precioSug.motivo) {
      correcciones.push({
        campo: 'precio',
        valor_original: cellStr(precioRaw),
        valor_sugerido: precioSug.sugerido,
        motivo: precioSug.motivo,
      });
      errores.push('precio no es un número.');
      codigos.push('PRECIO_NO_NUMERICO');
      precio = 0;
    } else if (precio <= 0) {
      errores.push('precio debe ser mayor a 0.');
      codigos.push('FALTA_PRECIO');
    }
  }

  const monedaCell = cellStr(raw['moneda']);
  const monedaInput = monedaCell || cabezal.moneda_default;
  const monedaRes = sugerirMoneda(monedaInput);
  let moneda: MonedaImportacion = monedaRes.valor;
  if (monedaCell && !monedaEsValida(monedaCell)) {
    errores.push(`moneda "${monedaCell}" no válida.`);
    codigos.push('MONEDA_INVALIDA');
  } else if (monedaRes.arsConvertida) {
    moneda = 'USD';
    advertencias.push('ARS discontinuada — se convierte a USD.');
    if (monedaRes.sugerido) correcciones.push(monedaRes.sugerido);
  } else if (monedaRes.sugerido && monedaCell) {
    correcciones.push(monedaRes.sugerido);
    errores.push(`moneda "${monedaCell}" no válida.`);
    codigos.push('MONEDA_INVALIDA');
    moneda = cabezal.moneda_default;
  }

  const estadoCell = cellStr(raw['estado']);
  const estadoInput = estadoCell || cabezal.estado_default;
  const estadoRes = sugerirEstado(estadoInput, estados);
  let estado = estadoRes.code ?? estadoInput;
  if (!estadoRes.code) {
    errores.push(`estado "${estadoInput}" no válido.`);
    codigos.push('ESTADO_DESCONOCIDO');
  } else if (estadoRes.sugerido && estadoCell) {
    correcciones.push(estadoRes.sugerido);
    errores.push(`estado "${estadoCell}" no válido.`);
    codigos.push('ESTADO_DESCONOCIDO');
    estado = estadoInput;
  } else if (estadoRes.sugerido && !estadoCell) {
    estado = estadoRes.code;
  }

  const oriCell = cellStr(raw['orientacion']);
  const oriRes = sugerirOrientacion(oriCell);
  let orientacion: string | undefined;
  if (!oriCell) {
    orientacion = undefined;
  } else if (oriRes.desconocida) {
    orientacion = oriCell;
    advertencias.push(`orientación "${oriCell}" no reconocida.`);
    codigos.push('ORIENTACION_INVALIDA');
  } else if (oriRes.sugerido) {
    correcciones.push(oriRes.sugerido);
    orientacion = oriCell;
    advertencias.push(`orientación "${oriCell}" — se sugiere ${oriRes.sugerido.valor_sugerido}.`);
    codigos.push('ORIENTACION_INVALIDA');
  } else {
    orientacion = oriRes.valor || undefined;
  }

  return {
    data: {
      codigo,
      tipo_unidad: 'lote_vacio',
      area_m2: metros,
      metros_cuadrados: metros,
      precio,
      moneda,
      estado,
      orientacion,
    },
    errores,
    advertencias,
    correcciones,
    codigos,
  };
}

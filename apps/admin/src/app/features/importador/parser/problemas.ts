import type { AccionMasiva, CabezalBarrio, CodigoProblema, FilaLote, MapeoGeografia, ProblemaAgrupado } from './types';
import { geoSinResolver } from './geo-matcher';
import { plural } from '../importador-ui';

export type { ProblemaAgrupado, AccionMasiva };

export interface FilaParaProblemas {
  id: string;
  tipo_fila: 'barrio' | 'unidad';
  estado_fila: string;
  decision_usuario?: string;
  ref_barrio?: string;
  nombre_hoja?: string;
  mensajes?: string[];
  mensaje?: string;
  datos_normalizados?: CabezalBarrio | FilaLote | null;
  datos_originales?: Record<string, unknown> | null;
  correcciones_sugeridas?: Array<{ campo: string }>;
}

const ACCIONES: Record<CodigoProblema, AccionMasiva[]> = {
  CABEZAL_INCOMPLETO: [{ codigo: 'completar_cabezal', label: 'Completar el campo faltante' }],
  GEO_SIN_MAPEAR: [{ codigo: 'abrir_mapeo', label: 'Resolver geografía' }],
  FALTA_NUMERO_LOTE: [{ codigo: 'omitir', label: 'Omitir' }],
  FALTA_METROS: [
    { codigo: 'asignar', campo: 'metros_cuadrados', label: 'Asignar valor' },
    { codigo: 'aplicar_sugerencia', label: 'Aplicar sugerencia' },
    { codigo: 'omitir', label: 'Omitir' },
  ],
  METROS_NO_NUMERICO: [
    { codigo: 'asignar', campo: 'metros_cuadrados', label: 'Asignar valor' },
    { codigo: 'aplicar_sugerencia', label: 'Aplicar sugerencia' },
    { codigo: 'omitir', label: 'Omitir' },
  ],
  FALTA_PRECIO: [
    { codigo: 'asignar', campo: 'precio', label: 'Asignar valor' },
    { codigo: 'aplicar_sugerencia', label: 'Aplicar sugerencia' },
    { codigo: 'omitir', label: 'Omitir' },
  ],
  PRECIO_NO_NUMERICO: [
    { codigo: 'asignar', campo: 'precio', label: 'Asignar valor' },
    { codigo: 'aplicar_sugerencia', label: 'Aplicar sugerencia' },
    { codigo: 'omitir', label: 'Omitir' },
  ],
  ESTADO_DESCONOCIDO: [
    { codigo: 'elegir_estado', label: 'Elegir estado' },
    { codigo: 'aplicar_sugerencia', label: 'Aplicar sugerencia' },
    { codigo: 'omitir', label: 'Omitir' },
  ],
  MONEDA_INVALIDA: [
    { codigo: 'elegir_moneda', label: 'Elegir moneda' },
    { codigo: 'aplicar_sugerencia', label: 'Aplicar sugerencia' },
    { codigo: 'omitir', label: 'Omitir' },
  ],
  ORIENTACION_INVALIDA: [
    { codigo: 'elegir_orientacion', label: 'Elegir orientación' },
    { codigo: 'dejar_vacia', campo: 'orientacion', label: 'Dejar vacía' },
    { codigo: 'aplicar_sugerencia', label: 'Aplicar sugerencia' },
  ],
  LOTE_DUPLICADO_ARCHIVO: [
    { codigo: 'quedarse_primera', label: 'Quedarse con la primera' },
    { codigo: 'omitir', label: 'Omitir todas' },
  ],
  LOTE_DUPLICADO_BD: [{ codigo: 'omitir', label: 'Omitir todas' }],
};

const MENSAJES: Record<CodigoProblema, (n: number) => string> = {
  CABEZAL_INCOMPLETO: (n) => `${plural(n, 'barrio', 'barrios')} con cabezal incompleto`,
  GEO_SIN_MAPEAR: (n) => `${plural(n, 'valor', 'valores')} de departamento/zona sin resolver`,
  FALTA_NUMERO_LOTE: (n) => `${plural(n, 'lote', 'lotes')} sin número`,
  FALTA_METROS: (n) => `${plural(n, 'lote', 'lotes')} sin metros cuadrados`,
  METROS_NO_NUMERICO: (n) => `${plural(n, 'lote', 'lotes')} con metros no numéricos`,
  FALTA_PRECIO: (n) => `${plural(n, 'lote', 'lotes')} sin precio`,
  PRECIO_NO_NUMERICO: (n) => `${plural(n, 'lote', 'lotes')} con precio no numérico`,
  ESTADO_DESCONOCIDO: (n) => `${plural(n, 'lote', 'lotes')} con estado desconocido`,
  MONEDA_INVALIDA: (n) => `${plural(n, 'lote', 'lotes')} con moneda inválida`,
  ORIENTACION_INVALIDA: (n) => `${plural(n, 'lote', 'lotes')} con orientación no reconocida`,
  LOTE_DUPLICADO_ARCHIVO: (n) =>
    n === 1 ? '1 lote duplicado en el archivo' : `${n} lotes duplicados en el archivo`,
  LOTE_DUPLICADO_BD: (n) =>
    n === 1 ? '1 lote ya existe en el barrio' : `${n} lotes ya existen en el barrio`,
};

export function agruparProblemas(
  filas: FilaParaProblemas[],
  mapeo: MapeoGeografia | null | undefined
): ProblemaAgrupado[] {
  const buckets = new Map<
    string,
    { codigo: CodigoProblema; campo: string | null; ids: string[]; barrios: Map<string, number> }
  >();

  const nombreDe = (f: FilaParaProblemas): string => {
    if (f.tipo_fila === 'barrio') {
      const c = f.datos_normalizados as CabezalBarrio | undefined;
      return c?.nombre || f.ref_barrio || f.nombre_hoja || 'Barrio';
    }
    const cab = filas.find((x) => x.tipo_fila === 'barrio' && x.ref_barrio === f.ref_barrio);
    if (cab) {
      const c = cab.datos_normalizados as CabezalBarrio | undefined;
      return c?.nombre || cab.ref_barrio || 'Barrio';
    }
    return f.ref_barrio || f.nombre_hoja || 'Barrio';
  };

  const add = (codigo: CodigoProblema, id: string, barrio: string, campo: string | null) => {
    const key = `${codigo}::${campo ?? ''}`;
    const cur = buckets.get(key);
    if (cur) {
      cur.ids.push(id);
      cur.barrios.set(barrio, (cur.barrios.get(barrio) ?? 0) + 1);
    } else {
      buckets.set(key, { codigo, campo, ids: [id], barrios: new Map([[barrio, 1]]) });
    }
  };

  for (const f of filas) {
    if (f.decision_usuario === 'omitir') continue;
    const barrio = nombreDe(f);
    const msgs = mensajesDe(f);

    if (f.tipo_fila === 'barrio') {
      const c = f.datos_normalizados as CabezalBarrio | undefined;
      if (msgs.some((m) => /nombre|departamento|zona/i.test(m) && /falta/i.test(m))) {
        add('CABEZAL_INCOMPLETO', f.id, barrio, null);
      }
      if (c && mapeo && !mapeo.barrio_destino_id && geoSinResolver(mapeo, c.departamento_excel, c.zona_excel)) {
        add('GEO_SIN_MAPEAR', f.id, barrio, null);
      }
      continue;
    }

    if (f.estado_fila === 'duplicado') {
      if (msgs.some((m) => /archivo/i.test(m))) add('LOTE_DUPLICADO_ARCHIVO', f.id, barrio, 'numero_lote');
      else add('LOTE_DUPLICADO_BD', f.id, barrio, 'numero_lote');
      continue;
    }

    for (const m of msgs) {
      if (/falta numero_lote/i.test(m)) add('FALTA_NUMERO_LOTE', f.id, barrio, 'numero_lote');
      else if (/falta metros/i.test(m) || /metros_cuadrados debe ser mayor/i.test(m)) {
        add('FALTA_METROS', f.id, barrio, 'metros_cuadrados');
      } else if (/metros_cuadrados no es un número/i.test(m)) {
        add('METROS_NO_NUMERICO', f.id, barrio, 'metros_cuadrados');
      } else if (/falta precio/i.test(m) || /precio debe ser mayor/i.test(m)) {
        add('FALTA_PRECIO', f.id, barrio, 'precio');
      } else if (/precio no es un número/i.test(m)) {
        add('PRECIO_NO_NUMERICO', f.id, barrio, 'precio');
      } else if (/estado .* no válido/i.test(m)) add('ESTADO_DESCONOCIDO', f.id, barrio, 'estado');
      else if (/moneda .* no válida/i.test(m)) add('MONEDA_INVALIDA', f.id, barrio, 'moneda');
      else if (/orientaci/i.test(m)) add('ORIENTACION_INVALIDA', f.id, barrio, 'orientacion');
      else if (/duplicado en el archivo/i.test(m)) add('LOTE_DUPLICADO_ARCHIVO', f.id, barrio, 'numero_lote');
    }
  }

  const out: ProblemaAgrupado[] = [];
  for (const b of buckets.values()) {
    let acciones = ACCIONES[b.codigo].map((a) => ({ ...a, label: labelAccion(a, b.ids.length) }));
    if (
      (b.codigo === 'FALTA_METROS' ||
        b.codigo === 'METROS_NO_NUMERICO' ||
        b.codigo === 'FALTA_PRECIO' ||
        b.codigo === 'PRECIO_NO_NUMERICO' ||
        b.codigo === 'ESTADO_DESCONOCIDO' ||
        b.codigo === 'MONEDA_INVALIDA' ||
        b.codigo === 'ORIENTACION_INVALIDA') &&
      !filas.some((f) => b.ids.includes(f.id) && (f.correcciones_sugeridas?.length ?? 0) > 0)
    ) {
      acciones = acciones.filter((a) => a.codigo !== 'aplicar_sugerencia');
    }
    out.push({
      codigo: b.codigo,
      campo: b.campo,
      hoja: null,
      mensaje: MENSAJES[b.codigo](b.ids.length),
      filas_ids: b.ids,
      barrios: [...b.barrios.entries()].map(([nombre, count]) => ({ nombre, count })),
      acciones,
    });
  }
  return out;
}

function labelAccion(a: AccionMasiva, n: number): string {
  if (a.codigo === 'asignar') return n === 1 ? 'Asignar valor' : `Asignar valor a los ${n}`;
  if (a.codigo === 'omitir') return n === 1 ? 'Omitir' : `Omitir los ${n}`;
  if (a.codigo === 'aplicar_sugerencia') return n === 1 ? 'Aplicar sugerencia' : `Aplicar las ${n}`;
  if (a.codigo === 'elegir_estado') return n === 1 ? 'Asignar estado' : `Asignar estado a los ${n}`;
  if (a.codigo === 'elegir_moneda') return n === 1 ? 'Asignar moneda' : `Asignar moneda a los ${n}`;
  if (a.codigo === 'elegir_orientacion') {
    return n === 1 ? 'Asignar orientación' : `Asignar orientación a los ${n}`;
  }
  return a.label;
}

function mensajesDe(f: FilaParaProblemas): string[] {
  if (Array.isArray(f.mensajes)) return f.mensajes.filter((m): m is string => typeof m === 'string');
  return f.mensaje ? [f.mensaje] : [];
}

/** @deprecated import from problemas.ts */
export type FilaExtendidaLike = FilaParaProblemas;

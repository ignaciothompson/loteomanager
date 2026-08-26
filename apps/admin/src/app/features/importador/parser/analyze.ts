import type { BarriosResponse, EstadoDefinicion, UnidadesResponse } from '@loteomanager/shared-types';
import { toSlug } from '@loteomanager/shared-utils';
import type {
  CabezalBarrio,
  FilaLote,
  FilaProcesada,
  HojaBarrioRaw,
  MapeoGeografia,
  EstadoFila,
  DecisionUsuario,
} from './types';
import { ImportadorFormatoError } from './types';
import { normalizeCabezal, normalizeLote } from './normalizer';
import { checkUnidadDuplicate } from './duplicate-detector';
import { buildMapeoGeografia, geoSinResolver, type GeoCatalog } from './geo-matcher';
import { cellStr } from './text';

export interface AnalyzeContext {
  existingBarrios: BarriosResponse[];
  existingUnidades: UnidadesResponse[];
  catalog: GeoCatalog;
  estados: EstadoDefinicion[];
  barrioDestino?: BarriosResponse | null;
}

export interface AnalyzeResult {
  filas: FilaProcesada[];
  mapeo: MapeoGeografia;
}

export function analyzeHojas(hojas: HojaBarrioRaw[], ctx: AnalyzeContext): AnalyzeResult {
  if (ctx.barrioDestino && hojas.length > 1) {
    throw new ImportadorFormatoError(
      'Este archivo trae varios barrios. Usá el importador general.',
      'ATAJO_MULTIHOJA'
    );
  }

  const pares = hojas.map((h) => ({
    departamento: cellStr(h.cabezal['departamento']),
    zona: cellStr(h.cabezal['zona']),
  }));
  const mapeo = buildMapeoGeografia(pares, ctx.catalog, ctx.barrioDestino?.id);

  const filas: FilaProcesada[] = [];
  let numero = 0;
  const seenUnidadKey = new Map<string, number>();

  for (const hoja of hojas) {
    const { data: cabezal, errores, advertencias } = normalizeCabezal(
      hoja.cabezal,
      hoja.nombre_hoja,
      ctx.existingBarrios,
      ctx.barrioDestino
    );

    if (ctx.barrioDestino) {
      cabezal.barrio_existente = true;
      cabezal.barrio_resuelto_id = ctx.barrioDestino.id;
    }

    const geoPendiente =
      !ctx.barrioDestino &&
      !errores.length &&
      geoSinResolver(mapeo, cabezal.departamento_excel, cabezal.zona_excel);
    const mensajesCabezal = [...errores, ...advertencias];
    if (geoPendiente) {
      mensajesCabezal.push('Departamento o zona sin mapear — resolvé el panel de geografía.');
    }

    let estadoCabezal: EstadoFila = 'ok';
    if (errores.length || geoPendiente) estadoCabezal = 'error';
    else if (advertencias.length) estadoCabezal = 'advertencia';

    numero++;
    const ref = cabezal.nombre || hoja.nombre_hoja;
    filas.push({
      numero_fila: numero,
      tipo_fila: 'barrio',
      datos_originales: { ...hoja.cabezal, _hoja: hoja.nombre_hoja, _fila_excel: 0 },
      datos_normalizados: cabezal,
      estado_fila: estadoCabezal,
      mensajes: mensajesCabezal,
      decision_usuario: 'pendiente',
      registro_existente_id: cabezal.barrio_resuelto_id ?? undefined,
      ref_barrio: ref,
      correcciones_sugeridas: [],
      nombre_hoja: hoja.nombre_hoja,
      fila_excel: 0,
    });

    const barrioId = cabezal.barrio_resuelto_id ?? undefined;

    for (const lote of hoja.lotes) {
      numero++;
      const norm = normalizeLote(lote.data, cabezal, ctx.estados);
      const mensajes = [...norm.errores, ...norm.advertencias];
      const unidadKey = `${ref}::${norm.data.codigo}`;
      let estado: EstadoFila = 'ok';
      let decision: DecisionUsuario = 'pendiente';
      let registro_existente_id: string | undefined;

      if (norm.data.codigo && seenUnidadKey.has(unidadKey)) {
        mensajes.push(
          `Lote "${norm.data.codigo}" duplicado en el archivo (primera aparición fila ${seenUnidadKey.get(unidadKey)}).`
        );
        estado = 'error';
      } else if (norm.data.codigo) {
        seenUnidadKey.set(unidadKey, numero);
      }

      if (estado !== 'error' && !norm.errores.length && barrioId && norm.data.codigo) {
        const dup = checkUnidadDuplicate(norm.data.codigo, barrioId, ctx.existingUnidades);
        if (dup.isDuplicate && dup.existingId) {
          estado = 'duplicado';
          registro_existente_id = dup.existingId;
          decision = 'omitir';
          mensajes.push(`Ya existe en este barrio — se omite.`);
        }
      }

      if (estado === 'ok') {
        if (norm.errores.length) estado = 'error';
        else if (norm.advertencias.length || norm.correcciones.length) estado = 'advertencia';
      }

      filas.push({
        numero_fila: numero,
        tipo_fila: 'unidad',
        datos_originales: { ...lote.data, _hoja: hoja.nombre_hoja, _fila_excel: lote.fila_excel },
        datos_normalizados: norm.data,
        estado_fila: estado,
        mensajes,
        decision_usuario: decision,
        registro_existente_id,
        ref_barrio: ref,
        correcciones_sugeridas: norm.correcciones,
        nombre_hoja: hoja.nombre_hoja,
        fila_excel: lote.fila_excel,
      });
    }
  }

  return { filas, mapeo };
}

export function revalidateFilas(
  filas: FilaProcesada[],
  ctx: AnalyzeContext,
  mapeo: MapeoGeografia
): FilaProcesada[] {
  const cabezales = new Map<string, CabezalBarrio>();
  const seenUnidadKey = new Map<string, number>();
  return filas.map((f) => {
    if (f.tipo_fila === 'barrio') {
      const c = { ...(f.datos_normalizados as CabezalBarrio) };
      if (ctx.barrioDestino) {
        c.barrio_existente = true;
        c.barrio_resuelto_id = ctx.barrioDestino.id;
      } else if (c.nombre) {
        c.slug = toSlug(c.nombre);
        const existing = ctx.existingBarrios.find((b) => b.slug === c.slug);
        c.barrio_existente = !!existing;
        c.barrio_resuelto_id = existing?.id ?? null;
      }
      cabezales.set(f.ref_barrio, c);
      const geoPendiente =
        !mapeo.barrio_destino_id && geoSinResolver(mapeo, c.departamento_excel, c.zona_excel);
      const errores: string[] = [];
      if (!c.nombre) errores.push('Falta "Nombre del barrio".');
      if (!c.departamento_excel) errores.push('Falta "Departamento".');
      if (!c.zona_excel) errores.push('Falta "Zona".');
      const mensajes = [...errores];
      if (geoPendiente) mensajes.push('Departamento o zona sin mapear — resolvé el panel de geografía.');
      if (c.advertencia_nombre_destino) {
        mensajes.push(
          `El nombre del archivo ("${c.nombre}") no coincide con el barrio destino. Manda el barrio destino.`
        );
      }
      let estado: EstadoFila = 'ok';
      if (errores.length || geoPendiente) estado = 'error';
      else if (mensajes.length) estado = 'advertencia';
      return { ...f, datos_normalizados: c, estado_fila: estado, mensajes };
    }

    const cabezal = cabezales.get(f.ref_barrio);
    if (!cabezal) return f;
    const raw = { ...(f.datos_originales ?? {}) };
    const lote = f.datos_normalizados as FilaLote;
    raw['numero_lote'] = lote.codigo;
    raw['metros_cuadrados'] = lote.metros_cuadrados || raw['metros_cuadrados'];
    raw['precio'] = lote.precio || raw['precio'];
    raw['moneda'] = lote.moneda;
    raw['estado'] = lote.estado;
    raw['orientacion'] = lote.orientacion ?? '';

    const norm = normalizeLote(raw, cabezal, ctx.estados);
    const merged: FilaLote = {
      ...norm.data,
      codigo: lote.codigo || norm.data.codigo,
      metros_cuadrados: lote.metros_cuadrados || norm.data.metros_cuadrados,
      area_m2: lote.metros_cuadrados || lote.area_m2 || norm.data.area_m2,
      precio: lote.precio || norm.data.precio,
      moneda: lote.moneda || norm.data.moneda,
      estado: lote.estado || norm.data.estado,
      orientacion: lote.orientacion ?? norm.data.orientacion,
    };

    const mensajes = [...norm.errores, ...norm.advertencias];
    const unidadKey = `${f.ref_barrio}::${merged.codigo}`;
    let estado: EstadoFila = 'ok';
    let decision: DecisionUsuario = f.decision_usuario === 'omitir' ? 'omitir' : 'pendiente';
    let registro_existente_id = f.registro_existente_id;

    if (merged.codigo && seenUnidadKey.has(unidadKey)) {
      mensajes.push(
        `Lote "${merged.codigo}" duplicado en el archivo (primera aparición fila ${seenUnidadKey.get(unidadKey)}).`
      );
      estado = 'error';
    } else if (merged.codigo) {
      seenUnidadKey.set(unidadKey, f.numero_fila);
    }

    const barrioId = cabezal.barrio_resuelto_id ?? undefined;
    if (estado !== 'error' && !norm.errores.length && barrioId && merged.codigo) {
      const dup = checkUnidadDuplicate(merged.codigo, barrioId, ctx.existingUnidades);
      if (dup.isDuplicate && dup.existingId) {
        estado = 'duplicado';
        registro_existente_id = dup.existingId;
        decision = 'omitir';
        mensajes.push('Ya existe en este barrio — se omite.');
      } else {
        registro_existente_id = undefined;
        if (decision === 'omitir' && f.estado_fila === 'duplicado') decision = 'pendiente';
      }
    }

    if (estado === 'ok') {
      if (norm.errores.length) estado = 'error';
      else if (norm.advertencias.length || norm.correcciones.length) estado = 'advertencia';
    }

    return {
      ...f,
      datos_normalizados: merged,
      estado_fila: estado,
      mensajes,
      decision_usuario: decision,
      registro_existente_id,
      correcciones_sugeridas: norm.correcciones,
    };
  });
}

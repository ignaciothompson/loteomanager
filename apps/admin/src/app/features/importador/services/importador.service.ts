import { Injectable, Signal, inject } from '@angular/core';
import {
  BarriosService,
  UnidadesService,
  ImportacionesService,
  ImportacionFilasService,
  DefinicionesCacheService,
  ZonasService,
  POCKETBASE,
} from '@loteomanager/shared-pb-client';
import { toSlug } from '@loteomanager/shared-utils';
import type {
  BarriosResponse,
  UnidadesResponse,
  ImportacionesResponse,
  ImportacionFilasResponse,
  UnidadesOrientacionOptions,
} from '@loteomanager/shared-types';
import type {
  BarrioNormalizado,
  UnidadNormalizado,
  ResultadoCommit,
  EstadoFila,
  DecisionUsuario,
} from '../parser/types';
import { parseExcelFile } from '../parser/excel-parser';
import { normalizeBarrioRow, normalizeUnidadRow } from '../parser/normalizer';
import { validateEstadoUnidad } from '../parser/row-validator';
import {
  checkBarrioDuplicate,
  checkUnidadDuplicate,
} from '../parser/duplicate-detector';
import type { FilaExtendida } from '../importador-types';
import PocketBase from 'pocketbase';

@Injectable({ providedIn: 'root' })
export class ImportadorService {
  private pb = inject(POCKETBASE) as PocketBase;
  private definicionesCacheSvc = inject(DefinicionesCacheService);
  private barriosService = inject(BarriosService);
  private unidadesService = inject(UnidadesService);
  private importacionesService = inject(ImportacionesService);
  private filasService = inject(ImportacionFilasService);
  private zonasService = inject(ZonasService);

  listarImportaciones(): Signal<ImportacionesResponse[]> {
    return this.importacionesService.list(undefined, { sort: '-created' });
  }

  obtenerImportacion(id: string): Signal<ImportacionesResponse | null> {
    return this.importacionesService.get(id);
  }

  async obtenerImportacionAsync(id: string): Promise<ImportacionesResponse> {
    return this.importacionesService.getAsync(id);
  }

  listarFilas(importacionId: string): Signal<ImportacionFilasResponse[]> {
    return this.filasService.list(pbFilterImportacion(importacionId), { sort: 'numero_fila' });
  }

  async listarFilasAsync(importacionId: string): Promise<FilaExtendida[]> {
    return this.filasService.listAsync(pbFilterImportacion(importacionId), {
      sort: 'numero_fila',
    }) as Promise<FilaExtendida[]>;
  }

  async analizarExcel(file: File): Promise<string> {
    const { rows } = await parseExcelFile(file);
    const estadosUnidades = this.definicionesCacheSvc.estadosActivosPara('unidades');

    const formData = new FormData();
    formData.append('archivo_origen', file);
    formData.append('tipo', 'barrios_con_unidades');
    formData.append('origen', 'excel');
    formData.append('estado', 'analizando');
    formData.append('nombre_archivo', file.name);
    formData.append('creado_por', this.pb.authStore.model?.['id'] ?? '');

    const importacion = await this.pb.collection('importaciones').create<ImportacionesResponse>(formData);
    const importacionId = importacion.id;

    const [existingBarrios, existingUnidades] = await Promise.all([
      this.barriosService.listAsync() as Promise<BarriosResponse[]>,
      this.unidadesService.listAsync() as Promise<UnidadesResponse[]>,
    ]);

    const barrioRows = rows.filter((r) => strTipo(r.data) === 'barrio');
    const unidadRows = rows.filter((r) => strTipo(r.data) === 'unidad');

    const barrioCodigos = new Map<string, { slug: string; barrioId?: string }>();
    const seenBarrioCodigo = new Map<string, number>();
    const seenUnidadKey = new Map<string, number>();

    let filasOk = 0;
    let filasDuplicado = 0;
    let filasError = 0;

    for (const row of barrioRows) {
      const { data, errores, ref_barrio } = normalizeBarrioRow(row.data, row.numero_fila);
      const mensajes = [...errores];

      if (ref_barrio && seenBarrioCodigo.has(ref_barrio)) {
        mensajes.push(
          `Fila ${row.numero_fila}: codigo "${ref_barrio}" duplicado en el archivo (primera aparición fila ${seenBarrioCodigo.get(ref_barrio)}).`
        );
      } else if (ref_barrio) {
        seenBarrioCodigo.set(ref_barrio, row.numero_fila);
      }

      let estado: EstadoFila = mensajes.length ? 'error' : 'ok';
      let registro_existente_id: string | undefined;
      let decision: DecisionUsuario = 'pendiente';

      if (!mensajes.length) {
        const dup = checkBarrioDuplicate(data.slug, existingBarrios);
        if (dup.isDuplicate && dup.existingId) {
          estado = 'duplicado';
          registro_existente_id = dup.existingId;
          mensajes.push(
            `Barrio "${data.nombre}" ya existe — se usará el existente para sus unidades.`
          );
          barrioCodigos.set(ref_barrio, { slug: data.slug, barrioId: dup.existingId });
        } else {
          barrioCodigos.set(ref_barrio, { slug: data.slug });
        }
      }

      if (estado === 'ok') filasOk++;
      else if (estado === 'duplicado') filasDuplicado++;
      else filasError++;

      await this.crearFila({
        importacionId,
        numeroFila: row.numero_fila,
        tipoFila: 'barrio',
        datosOriginales: row.data,
        datosNormalizados: data,
        estadoFila: estado,
        mensajes,
        decisionUsuario: decision,
        registroExistenteId: registro_existente_id,
        refBarrio: ref_barrio,
      });
    }

    for (const row of unidadRows) {
      const { data, errores, ref_barrio } = normalizeUnidadRow(row.data, row.numero_fila);
      const mensajes = [...errores];

      const estadoErr = validateEstadoUnidad(data.estado, estadosUnidades, row.numero_fila);
      if (estadoErr) mensajes.push(estadoErr);

      if (ref_barrio && !barrioCodigos.has(ref_barrio)) {
        mensajes.push(
          `Fila ${row.numero_fila}: codigo_barrio "${ref_barrio}" no corresponde a ningún barrio del archivo.`
        );
      }

      const unidadKey = `${ref_barrio}::${data.codigo}`;
      if (ref_barrio && data.codigo && seenUnidadKey.has(unidadKey)) {
        mensajes.push(
          `Fila ${row.numero_fila}: lote "${data.codigo}" duplicado en el archivo para barrio "${ref_barrio}".`
        );
      } else if (ref_barrio && data.codigo) {
        seenUnidadKey.set(unidadKey, row.numero_fila);
      }

      let estado: EstadoFila = mensajes.length ? 'error' : 'ok';
      let registro_existente_id: string | undefined;
      let decision: DecisionUsuario = 'pendiente';

      if (!mensajes.length && ref_barrio) {
        const barrioInfo = barrioCodigos.get(ref_barrio);
        const barrioId = barrioInfo?.barrioId;
        const dup = checkUnidadDuplicate(data.codigo, barrioId, existingUnidades);
        if (dup.isDuplicate && dup.existingId) {
          estado = 'duplicado';
          registro_existente_id = dup.existingId;
          decision = 'omitir';
          mensajes.push(
            `Lote "${data.codigo}" ya existe en el barrio — se saltea por defecto.`
          );
        }
      }

      if (estado === 'ok') filasOk++;
      else if (estado === 'duplicado') filasDuplicado++;
      else filasError++;

      await this.crearFila({
        importacionId,
        numeroFila: row.numero_fila,
        tipoFila: 'unidad',
        datosOriginales: row.data,
        datosNormalizados: data,
        estadoFila: estado,
        mensajes,
        decisionUsuario: decision,
        registroExistenteId: registro_existente_id,
        refBarrio: ref_barrio,
      });
    }

    const total = filasOk + filasDuplicado + filasError;
    await this.pb.collection('importaciones').update(importacionId, {
      estado: 'listo_para_confirmar',
      total_filas: total,
      filas_ok: filasOk,
      filas_duplicado: filasDuplicado,
      filas_error: filasError,
      filas_advertencia: 0,
    });

    return importacionId;
  }

  async editarFila(
    filaId: string,
    datosNormalizados: BarrioNormalizado | UnidadNormalizado
  ): Promise<void> {
    const fila = await this.pb.collection('importacion_filas').getOne<FilaExtendida>(filaId);
    const estadosUnidades = this.definicionesCacheSvc.estadosActivosPara('unidades');
    const [existingBarrios, existingUnidades] = await Promise.all([
      this.barriosService.listAsync() as Promise<BarriosResponse[]>,
      this.unidadesService.listAsync() as Promise<UnidadesResponse[]>,
    ]);

    const mensajes: string[] = [];
    let estado: EstadoFila = 'ok';
    let registro_existente_id: string | undefined = fila.registro_existente_id;
    let decision: DecisionUsuario = fila.decision_usuario ?? 'pendiente';

    if (fila.tipo_fila === 'barrio') {
      const data = datosNormalizados as BarrioNormalizado;
      if (!data.nombre) mensajes.push('El nombre es obligatorio.');
      if (!data.slug) mensajes.push('El slug es obligatorio.');
      const dup = checkBarrioDuplicate(data.slug, existingBarrios);
      if (dup.isDuplicate && dup.existingId) {
        estado = 'duplicado';
        registro_existente_id = dup.existingId;
        mensajes.push(`Barrio "${data.nombre}" ya existe — se reutilizará.`);
        decision = 'pendiente';
      }
    } else {
      const data = datosNormalizados as UnidadNormalizado;
      if (!data.codigo) mensajes.push('El número de lote es obligatorio.');
      if (data.metros_cuadrados <= 0) mensajes.push('metros_cuadrados debe ser mayor a 0.');
      if (data.precio <= 0) mensajes.push('precio debe ser mayor a 0.');
      const estErr = validateEstadoUnidad(data.estado, estadosUnidades, fila.numero_fila);
      if (estErr) mensajes.push(estErr);

      const ref = fila.ref_barrio;
      let barrioId: string | undefined;
      if (ref) {
        const barrioFilas = await this.pb.collection('importacion_filas').getFullList<FilaExtendida>({
          filter: `${pbFilterImportacion(fila.importacion_id)} && tipo_fila = 'barrio' && ref_barrio = '${ref.replace(/'/g, "''")}'`,
        });
        const barrioFila = barrioFilas[0];
        barrioId = barrioFila?.barrio_resuelto_id ?? barrioFila?.registro_existente_id;
        if (!barrioId && barrioFila?.datos_normalizados) {
          const slug = (barrioFila.datos_normalizados as BarrioNormalizado).slug;
          barrioId = existingBarrios.find((b) => b.slug === slug)?.id;
        }
      }

      const dup = checkUnidadDuplicate(data.codigo, barrioId, existingUnidades);
      if (dup.isDuplicate && dup.existingId && decision !== 'crear') {
        estado = 'duplicado';
        registro_existente_id = dup.existingId;
        mensajes.push(`Lote "${data.codigo}" ya existe — se saltea por defecto.`);
        if (decision === 'pendiente') decision = 'omitir';
      } else if (mensajes.length) {
        estado = 'error';
      } else {
        estado = 'ok';
        decision = decision === 'omitir' && !dup.isDuplicate ? 'pendiente' : decision;
      }
    }

    if (mensajes.length && estado !== 'duplicado') estado = 'error';

    await this.pb.collection('importacion_filas').update(filaId, {
      datos_normalizados: datosNormalizados,
      mensajes,
      mensaje: mensajes.join(' '),
      estado_fila: estado,
      registro_existente_id: registro_existente_id ?? null,
      decision_usuario: decision,
    });

    await this.recalcularContadores(fila.importacion_id);
  }

  async actualizarDecision(filaId: string, decision: DecisionUsuario): Promise<void> {
    const fila = await this.pb.collection('importacion_filas').update<FilaExtendida>(filaId, {
      decision_usuario: decision,
    });
    await this.recalcularContadores(fila.importacion_id);
  }

  async commitImportacion(importacionId: string): Promise<ResultadoCommit> {
    const currentUserId = this.pb.authStore.model?.['id'] as string | undefined;
    if (!currentUserId) throw new Error('Usuario no autenticado.');

    const filas = await this.pb.collection('importacion_filas').getFullList<FilaExtendida>({
      filter: pbFilterImportacion(importacionId),
      sort: 'numero_fila',
    });

    const refToBarrioId = new Map<string, string>();
    let aplicadas = 0;
    let fallidas = 0;
    let omitidas = 0;

    const barrioFilas = filas.filter((f) => f.tipo_fila === 'barrio' && !f.aplicada);
    const unidadFilas = filas.filter((f) => f.tipo_fila === 'unidad' && !f.aplicada);

    for (const fila of barrioFilas) {
      if (fila.estado_fila === 'error' && !fila.error_aplicacion) {
        omitidas++;
        continue;
      }

      try {
        const datos = fila.datos_normalizados as BarrioNormalizado;
        const ref = refBarrioDesdeFilaBarrio(fila);

        if (fila.estado_fila === 'duplicado' && fila.registro_existente_id) {
          const id = fila.registro_existente_id;
          await this.pb.collection('importacion_filas').update(fila.id, {
            barrio_resuelto_id: id,
            aplicada: true,
          });
          if (ref) refToBarrioId.set(ref, id);
          aplicadas++;
          continue;
        }

        if (fila.estado_fila === 'ok') {
          const zona_id = await this.resolveZonaId(datos.zona);
          const created = await this.pb.collection('barrios').create<BarriosResponse>({
            nombre: datos.nombre,
            slug: datos.slug,
            zona_id,
            tipos_unidad: datos.tipos_unidad,
            descripcion: datos.descripcion ?? null,
          });
          await this.pb.collection('importacion_filas').update(fila.id, {
            barrio_resuelto_id: created.id,
            registro_creado_id: created.id,
            aplicada: true,
          });
          if (ref) refToBarrioId.set(ref, created.id);
          aplicadas++;
        }
      } catch (err: unknown) {
        fallidas++;
        const msg = err instanceof Error ? err.message : 'Error al crear barrio';
        await this.pb.collection('importacion_filas').update(fila.id, {
          error_aplicacion: msg,
        });
      }
    }

    // Fallback: barrios duplicados / ref_barrio no persistido en PB sin migración
    for (const f of filas.filter((x) => x.tipo_fila === 'barrio')) {
      const ref = refBarrioDesdeFilaBarrio(f);
      if (!ref || refToBarrioId.has(ref)) continue;
      const id =
        f.barrio_resuelto_id ??
        f.registro_creado_id ??
        f.registro_existente_id ??
        undefined;
      if (id) refToBarrioId.set(ref, id);
    }

    for (const fila of unidadFilas) {
      if (fila.aplicada) continue;

      const skipDup =
        fila.estado_fila === 'duplicado' &&
        (fila.decision_usuario === 'omitir' || fila.decision_usuario === 'pendiente');
      if (skipDup) {
        omitidas++;
        continue;
      }
      if (fila.estado_fila === 'error' && !fila.error_aplicacion) {
        omitidas++;
        continue;
      }
      if (fila.decision_usuario === 'omitir') {
        omitidas++;
        continue;
      }

      try {
        const datos = fila.datos_normalizados as UnidadNormalizado;
        const ref = refBarrioDesdeFilaUnidad(fila);
        const barrio_id = refToBarrioId.get(ref);
        if (!barrio_id) {
          throw new Error(
            `No se pudo resolver barrio para codigo_barrio "${ref}". Verificá que exista la fila barrio en el Excel.`
          );
        }

        const orientacion = orientacionValida(datos.orientacion);

        const created = await this.unidadesService.crearIndividual(
          {
            barrio_id,
            tipo_unidad: 'lote_vacio',
            codigo: datos.codigo,
            area_m2: datos.area_m2,
            metros_cuadrados: datos.metros_cuadrados,
            precio: datos.precio,
            moneda: datos.moneda,
            estado: datos.estado as UnidadesResponse['estado'],
            ...(orientacion ? { orientacion } : {}),
            web_visible: true,
          },
          currentUserId
        );

        await this.pb.collection('importacion_filas').update(fila.id, {
          barrio_resuelto_id: barrio_id,
          registro_creado_id: created.id,
          aplicada: true,
          error_aplicacion: null,
        });
        aplicadas++;
      } catch (err: unknown) {
        fallidas++;
        const msg = err instanceof Error ? err.message : 'Error al crear unidad';
        await this.pb.collection('importacion_filas').update(fila.id, {
          error_aplicacion: msg,
        });
      }
    }

    await this.pb.collection('importaciones').update(importacionId, {
      estado: fallidas > 0 ? 'con_errores' : 'confirmada',
      confirmada_en: new Date().toISOString(),
    });

    return { filas_aplicadas: aplicadas, filas_fallidas: fallidas, filas_omitidas: omitidas };
  }

  async descartarImportacion(importacionId: string): Promise<void> {
    await this.pb.collection('importaciones').update(importacionId, { estado: 'descartada' });
  }

  private async resolveZonaId(zonaText?: string | null): Promise<string> {
    const trimmed = zonaText?.trim();
    if (!trimmed) {
      const todo = await this.pb.collection('zonas').getFirstListItem('slug="todo"');
      return todo.id;
    }
    const slug = toSlug(trimmed);
    try {
      const existing = await this.pb.collection('zonas').getFirstListItem(`slug="${slug}"`);
      return existing.id;
    } catch {
      const dept = await this.pb.collection('departamentos').getFirstListItem('slug="todo"');
      const created = await this.zonasService.create({
        nombre: trimmed,
        departamento_id: dept.id,
      });
      return created.id;
    }
  }

  private async crearFila(params: {
    importacionId: string;
    numeroFila: number;
    tipoFila: 'barrio' | 'unidad';
    datosOriginales: Record<string, unknown>;
    datosNormalizados: BarrioNormalizado | UnidadNormalizado;
    estadoFila: EstadoFila;
    mensajes: string[];
    decisionUsuario: DecisionUsuario;
    registroExistenteId?: string;
    refBarrio?: string;
  }): Promise<void> {
    await this.pb.collection('importacion_filas').create({
      importacion_id: params.importacionId,
      numero_fila: params.numeroFila,
      tipo_fila: params.tipoFila,
      datos_originales: params.datosOriginales,
      datos_normalizados: params.datosNormalizados,
      estado_fila: params.estadoFila,
      mensajes: params.mensajes,
      mensaje: params.mensajes.join(' '),
      decision_usuario: params.decisionUsuario,
      registro_existente_id: params.registroExistenteId ?? null,
      ref_barrio: params.refBarrio ?? null,
      aplicada: false,
    });
  }

  private async recalcularContadores(importacionId: string): Promise<void> {
    const filas = await this.pb.collection('importacion_filas').getFullList<ImportacionFilasResponse>({
      filter: pbFilterImportacion(importacionId),
    });
    let ok = 0;
    let dup = 0;
    let err = 0;
    for (const f of filas) {
      if (f.estado_fila === 'ok') ok++;
      else if (f.estado_fila === 'duplicado') dup++;
      else if (f.estado_fila === 'error') err++;
    }
    await this.pb.collection('importaciones').update(importacionId, {
      total_filas: filas.length,
      filas_ok: ok,
      filas_duplicado: dup,
      filas_error: err,
    });
  }
}

function pbFilterImportacion(importacionId: string): string {
  const safe = importacionId.replace(/'/g, "''");
  return `importacion_id = '${safe}'`;
}

function origenFila(fila: FilaExtendida): Record<string, unknown> {
  return (fila.datos_originales ?? {}) as Record<string, unknown>;
}

/** ref_barrio en PB puede faltar sin migración — leer codigo del Excel */
function refBarrioDesdeFilaBarrio(fila: FilaExtendida): string {
  const fromPb = fila.ref_barrio?.trim();
  if (fromPb) return fromPb;
  const orig = origenFila(fila);
  return String(orig['codigo'] ?? '').trim();
}

function refBarrioDesdeFilaUnidad(fila: FilaExtendida): string {
  const fromPb = fila.ref_barrio?.trim();
  if (fromPb) return fromPb;
  const orig = origenFila(fila);
  return String(orig['codigo_barrio'] ?? '').trim();
}

const ORIENTACIONES_VALIDAS = new Set<string>([
  'Norte',
  'Sur',
  'Este',
  'Oeste',
  'Noreste',
  'Noroeste',
  'Sureste',
  'Suroeste',
]);

function orientacionValida(value?: string): UnidadesOrientacionOptions | undefined {
  const t = value?.trim();
  if (!t || !ORIENTACIONES_VALIDAS.has(t)) return undefined;
  return t as UnidadesOrientacionOptions;
}

function strTipo(data: Record<string, unknown>): string {
  return String(data['tipo'] ?? '').toLowerCase().trim();
}

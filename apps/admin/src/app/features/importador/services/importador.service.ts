import { Injectable, Signal, inject } from '@angular/core';
import {
  BarriosService,
  UnidadesService,
  ImportacionesService,
  ImportacionFilasService,
  DefinicionesCacheService,
  ZonasService,
  DepartamentosService,
  PlantillasUnidadService,
  PublicacionService,
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
  CabezalBarrio,
  FilaLote,
  FilaProcesada,
  ResultadoCommit,
  EstadoFila,
  DecisionUsuario,
  MapeoGeografia,
  CorreccionSugerida,
  AnalizarExcelOpts,
  MonedaImportacion,
} from '../parser/types';
import { parseWorkbook } from '../parser/excel-parser';
import { analyzeHojas, revalidateFilas, type AnalyzeContext } from '../parser/analyze';
import { agruparProblemas, type FilaParaProblemas } from '../parser/problemas';
import { zonaIdResuelta } from '../parser/geo-matcher';
import { inferirPatronCodigo } from '../parser/patron-codigo';
import { ORIENTACIONES_CANONICAS } from '../parser/types';
import type { FilaExtendida, ImportacionExtendida } from '../importador-types';
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
  private departamentosService = inject(DepartamentosService);
  private plantillasSvc = inject(PlantillasUnidadService);
  private publicacionSvc = inject(PublicacionService);
  /** Serializa patches de revisión: un editarFilas pisa el getFullList del anterior (autocancel). */
  private writeChain: Promise<void> = Promise.resolve();

  private enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.writeChain.then(fn, fn);
    this.writeChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  listarImportaciones(): Signal<ImportacionesResponse[]> {
    return this.importacionesService.list(undefined, { sort: '-created' });
  }

  listarImportacionesAsync(): Promise<ImportacionesResponse[]> {
    return this.importacionesService.listAsync(undefined, { sort: '-created' });
  }

  obtenerImportacion(id: string): Signal<ImportacionesResponse | null> {
    return this.importacionesService.get(id);
  }

  async obtenerImportacionAsync(id: string): Promise<ImportacionExtendida> {
    return this.importacionesService.getAsync(id) as Promise<ImportacionExtendida>;
  }

  listarFilas(importacionId: string): Signal<ImportacionFilasResponse[]> {
    return this.filasService.list(pbFilterImportacion(importacionId), { sort: 'numero_fila' });
  }

  async listarFilasAsync(importacionId: string): Promise<FilaExtendida[]> {
    const filas = (await this.filasService.listAsync(pbFilterImportacion(importacionId), {
      sort: 'numero_fila',
    })) as FilaExtendida[];
    return filas.map(hydrateFila);
  }

  problemasDe(filas: FilaExtendida[], mapeo: MapeoGeografia | null | undefined) {
    return agruparProblemas(filas as FilaParaProblemas[], mapeo);
  }

  async analizarExcel(
    file: File,
    opts?: AnalizarExcelOpts & { onProgress?: (msg: string) => void }
  ): Promise<string> {
    const hojas = await parseWorkbook(file, opts?.onProgress);
    opts?.onProgress?.('Validando lotes…');
    const ctx = await this.buildAnalyzeContext(opts?.barrioDestinoId);
    const { filas, mapeo } = analyzeHojas(hojas, ctx);

    const formData = new FormData();
    formData.append('archivo_origen', file);
    formData.append('tipo', 'barrios_con_unidades');
    formData.append('origen', 'excel');
    formData.append('estado', 'analizando');
    formData.append('nombre_archivo', file.name);
    formData.append('creado_por', this.pb.authStore.model?.['id'] ?? '');

    const importacion = await this.pb.collection('importaciones').create<ImportacionesResponse>(formData);
    const importacionId = importacion.id;

    for (const fila of filas) {
      await this.crearFila(importacionId, fila);
    }

    await this.recalcularContadores(importacionId);
    const mapeoConConteo: MapeoGeografia = {
      ...mapeo,
      conteo: {
        barrios: filas.filter((f) => f.tipo_fila === 'barrio').length,
        lotes: filas.filter((f) => f.tipo_fila === 'unidad').length,
      },
    };
    await this.pb.collection('importaciones').update(importacionId, {
      estado: 'listo_para_confirmar',
      mapeo_geografia: mapeoConConteo,
    });

    return importacionId;
  }

  async editarFila(filaId: string, datosNormalizados: CabezalBarrio | FilaLote): Promise<void> {
    const fila = await this.pb.collection('importacion_filas').getOne<FilaExtendida>(filaId);
    await this.editarFilas([filaId], datosNormalizados as unknown as Record<string, unknown>, fila.importacion_id);
  }

  async editarFilas(
    ids: string[],
    cambios: Record<string, unknown>,
    importacionId?: string
  ): Promise<void> {
    return this.enqueueWrite(() => this.editarFilasNow(ids, cambios, importacionId));
  }

  private async editarFilasNow(
    ids: string[],
    cambios: Record<string, unknown>,
    importacionId?: string
  ): Promise<void> {
    if (!ids.length) return;
    const first = await this.pb.collection('importacion_filas').getOne<FilaExtendida>(ids[0]);
    const impId = importacionId ?? first.importacion_id;
    const [filas, imp] = await Promise.all([
      this.listarFilasAsync(impId),
      this.obtenerImportacionAsync(impId),
    ]);
    const mapeo = (imp.mapeo_geografia ?? emptyMapeo()) as MapeoGeografia;
    const ctx = await this.buildAnalyzeContext(mapeo.barrio_destino_id);

    const idSet = new Set(ids);
    const procesadas = filas.map((f) => {
      const p = toProcesada(f);
      if (!idSet.has(f.id)) return p;
      return applyCambios(p, cambios);
    });

    const reval = revalidateFilas(procesadas, ctx, mapeo);
    await this.persistRevalidated(filas, reval);
    await this.recalcularContadores(impId);
  }

  async aplicarSugerencias(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const first = await this.pb.collection('importacion_filas').getOne<FilaExtendida>(ids[0]);
    const impId = first.importacion_id;
    const filas = await this.listarFilasAsync(impId);
    const cambiosPorId = new Map<string, Record<string, unknown>>();
    for (const f of filas) {
      if (!ids.includes(f.id)) continue;
      const sug = f.correcciones_sugeridas ?? [];
      if (!sug.length) continue;
      const cambios: Record<string, unknown> = {};
      for (const c of sug) {
        cambios[c.campo] = coerceCampo(c.campo, c.valor_sugerido);
      }
      cambiosPorId.set(f.id, cambios);
    }
    if (!cambiosPorId.size) return;

    const imp = await this.obtenerImportacionAsync(impId);
    const mapeo = (imp.mapeo_geografia ?? emptyMapeo()) as MapeoGeografia;
    const ctx = await this.buildAnalyzeContext(mapeo.barrio_destino_id);
    const procesadas = filas.map((f) => {
      const p = toProcesada(f);
      const c = cambiosPorId.get(f.id);
      if (!c) return p;
      const applied = applyCambios(p, c);
      applied.correcciones_sugeridas = [];
      return applied;
    });
    const reval = revalidateFilas(procesadas, ctx, mapeo);
    await this.persistRevalidated(filas, reval);
    await this.recalcularContadores(impId);
  }

  async omitirFilas(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.pb.collection('importacion_filas').update(id, { decision_usuario: 'omitir' });
    }
    if (ids.length) {
      const first = await this.pb.collection('importacion_filas').getOne<FilaExtendida>(ids[0]);
      await this.recalcularContadores(first.importacion_id);
    }
  }

  async incluirFilas(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.pb.collection('importacion_filas').update(id, { decision_usuario: 'pendiente' });
    }
    if (ids.length) {
      const first = await this.pb.collection('importacion_filas').getOne<FilaExtendida>(ids[0]);
      await this.recalcularContadores(first.importacion_id);
    }
  }

  async quedarseConPrimera(ids: string[]): Promise<void> {
    if (ids.length < 2) return;
    const rest = ids.slice(1);
    await this.omitirFilas(rest);
  }

  async actualizarDecision(filaId: string, decision: DecisionUsuario): Promise<void> {
    const fila = await this.pb.collection('importacion_filas').update<FilaExtendida>(filaId, {
      decision_usuario: decision,
    });
    await this.recalcularContadores(fila.importacion_id);
  }

  async marcarPlantilla(cabezalFilaId: string, loteFilaId: string | null, nombre?: string): Promise<void> {
    const fila = await this.pb.collection('importacion_filas').getOne<FilaExtendida>(cabezalFilaId);
    const datos = { ...(fila.datos_normalizados as CabezalBarrio) };
    datos.plantilla_fila_id = loteFilaId;
    if (nombre !== undefined) datos.plantilla_nombre = nombre;
    await this.pb.collection('importacion_filas').update(cabezalFilaId, { datos_normalizados: datos });
  }

  async guardarMapeoGeografia(importacionId: string, mapeo: MapeoGeografia): Promise<void> {
    await this.pb.collection('importaciones').update(importacionId, { mapeo_geografia: mapeo });
    const [filas, ctx] = await Promise.all([
      this.listarFilasAsync(importacionId),
      this.buildAnalyzeContext(mapeo.barrio_destino_id),
    ]);
    const procesadas = filas.map(toProcesada);
    const reval = revalidateFilas(procesadas, ctx, mapeo);
    await this.persistRevalidated(filas, reval);
    await this.recalcularContadores(importacionId);
  }

  async crearZonaEnMapeo(
    importacionId: string,
    valorExcelZona: string,
    departamentoExcel: string,
    departamentoId: string
  ): Promise<MapeoGeografia> {
    const created = await this.zonasService.create({
      nombre: valorExcelZona.trim(),
      departamento_id: departamentoId,
    });
    const imp = await this.obtenerImportacionAsync(importacionId);
    const mapeo = { ...(imp.mapeo_geografia ?? emptyMapeo()) };
    mapeo.zonas = mapeo.zonas.map((z) =>
      z.valor_excel === valorExcelZona && z.departamento_excel === departamentoExcel
        ? { ...z, zona_id: created.id, estado: 'confirmado' as const, nombre_sugerido: created.nombre }
        : z
    );
    await this.guardarMapeoGeografia(importacionId, mapeo);
    return mapeo;
  }

  async commitImportacion(
    importacionId: string,
    opts?: { publicarWeb?: boolean }
  ): Promise<ResultadoCommit> {
    const currentUserId = this.pb.authStore.model?.['id'] as string | undefined;
    if (!currentUserId) throw new Error('Usuario no autenticado.');

    const [filas, imp] = await Promise.all([
      this.listarFilasAsync(importacionId),
      this.obtenerImportacionAsync(importacionId),
    ]);
    const mapeo = (imp.mapeo_geografia ?? emptyMapeo()) as MapeoGeografia;

    const refToBarrioId = new Map<string, string>();
    let aplicadas = 0;
    let fallidas = 0;
    let omitidas = 0;
    let barriosCreados = 0;
    let lotesCreados = 0;
    const barriosTocados = new Set<string>();
    const barriosInfo: { id: string; nombre: string }[] = [];
    const omisiones: { codigo: string; motivo: string }[] = [];

    const cabezalBloqueado = new Set(
      filas
        .filter((f) => f.tipo_fila === 'barrio' && f.estado_fila === 'error')
        .map((f) => f.ref_barrio ?? '')
        .filter(Boolean)
    );

    const barrioFilas = filas.filter((f) => f.tipo_fila === 'barrio' && !f.aplicada);
    const unidadFilas = filas.filter((f) => f.tipo_fila === 'unidad' && !f.aplicada);

    for (const fila of barrioFilas) {
      const ref = fila.ref_barrio ?? '';
      if (fila.estado_fila === 'error') {
        omitidas++;
        continue;
      }
      try {
        const datos = fila.datos_normalizados as CabezalBarrio;
        const existingId =
          mapeo.barrio_destino_id ||
          fila.registro_existente_id ||
          datos.barrio_resuelto_id ||
          undefined;
        if (existingId) {
          await this.pb.collection('importacion_filas').update(fila.id, {
            barrio_resuelto_id: existingId,
            aplicada: true,
          });
          if (ref) refToBarrioId.set(ref, existingId);
          barriosTocados.add(existingId);
          barriosInfo.push({ id: existingId, nombre: datos.nombre });
          aplicadas++;
          continue;
        }

        const zona_id = zonaIdResuelta(mapeo, datos.departamento_excel, datos.zona_excel);
        if (!zona_id) throw new Error('Zona no resuelta para esta hoja.');

        const created = await this.barriosService.create({
          nombre: datos.nombre,
          slug: toSlug(datos.nombre),
          zona_id,
          tipos_unidad: datos.tipos_unidad?.length ? datos.tipos_unidad : ['lote_vacio'],
          descripcion: datos.descripcion ?? undefined,
          ubicacion_texto: datos.ubicacion_texto ?? undefined,
        });
        await this.pb.collection('importacion_filas').update(fila.id, {
          barrio_resuelto_id: created.id,
          registro_creado_id: created.id,
          aplicada: true,
        });
        if (ref) refToBarrioId.set(ref, created.id);
        barriosTocados.add(created.id);
        barriosInfo.push({ id: created.id, nombre: datos.nombre });
        barriosCreados++;
        aplicadas++;
      } catch (err: unknown) {
        fallidas++;
        const msg = err instanceof Error ? err.message : 'Error al crear barrio';
        await this.pb.collection('importacion_filas').update(fila.id, { error_aplicacion: msg });
      }
    }

    for (const f of filas.filter((x) => x.tipo_fila === 'barrio')) {
      const ref = f.ref_barrio ?? '';
      if (!ref || refToBarrioId.has(ref)) continue;
      const id = f.barrio_resuelto_id ?? f.registro_creado_id ?? f.registro_existente_id;
      if (id) refToBarrioId.set(ref, id);
    }

    for (const fila of unidadFilas) {
      const ref = fila.ref_barrio ?? '';
      const datosLote = fila.datos_normalizados as FilaLote;
      const codigo = datosLote?.codigo || 'lote';
      if (cabezalBloqueado.has(ref)) {
        omitidas++;
        pushOmision(omisiones, codigo, 'El barrio de esta hoja no se pudo crear.');
        continue;
      }
      if (fila.decision_usuario === 'omitir') {
        omitidas++;
        pushOmision(omisiones, codigo, 'Lo omitiste a mano.');
        continue;
      }
      if (fila.estado_fila === 'duplicado') {
        omitidas++;
        pushOmision(omisiones, codigo, 'Ya existe en este barrio.');
        continue;
      }
      if (fila.estado_fila === 'error') {
        omitidas++;
        pushOmision(omisiones, codigo, fila.mensajes?.[0] || 'Tiene un error.');
        continue;
      }
      try {
        const datos = fila.datos_normalizados as FilaLote;
        const barrio_id = refToBarrioId.get(ref);
        if (!barrio_id) throw new Error(`No se pudo resolver el barrio de la hoja "${ref}".`);

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
        barriosTocados.add(barrio_id);
        lotesCreados++;
        aplicadas++;
      } catch (err: unknown) {
        fallidas++;
        const msg = err instanceof Error ? err.message : 'Error al crear unidad';
        await this.pb.collection('importacion_filas').update(fila.id, { error_aplicacion: msg });
      }
    }

    const plantillasGuardadas = await this.crearPlantillas(filas, refToBarrioId);

    if (opts?.publicarWeb) {
      for (const barrioId of barriosTocados) {
        try {
          await this.publicacionSvc.publicarBarrio(barrioId);
        } catch {
          /* la publicación no revierte el commit de lotes */
        }
      }
    }

    const mapeoFinal: MapeoGeografia = {
      ...mapeo,
      resultado: {
        lotes_creados: lotesCreados,
        omitidos: omitidas,
        barrios_creados: barriosCreados,
      },
    };

    await this.pb.collection('importaciones').update(importacionId, {
      estado: fallidas > 0 ? 'con_errores' : 'confirmada',
      confirmada_en: new Date().toISOString(),
      mapeo_geografia: mapeoFinal,
    });

    const barriosUnicos = uniqueBarrios(barriosInfo);

    return {
      filas_aplicadas: aplicadas,
      filas_fallidas: fallidas,
      filas_omitidas: omitidas,
      barrios_creados: barriosCreados,
      lotes_creados: lotesCreados,
      plantillas_guardadas: plantillasGuardadas,
      barrios: barriosUnicos,
      omisiones,
    };
  }

  async descartarImportacion(importacionId: string): Promise<void> {
    await this.pb.collection('importaciones').update(importacionId, { estado: 'descartada' });
  }

  resumenCommit(filas: FilaExtendida[]): {
    crearBarrios: number;
    crearLotes: number;
    omitirError: number;
    hojasSaltadas: number;
    aRevisar: number;
    seOmiten: number;
    sugerencias: number;
  } {
    const cabezales = filas.filter((f) => f.tipo_fila === 'barrio' && !f.aplicada);
    /** Geo-only cabezal error no bloquea conteo de UI; sí bloquea commit vía mapeoPendiente. */
    const bloqueadas = new Set(
      cabezales
        .filter((f) => f.estado_fila === 'error' && !soloErrorGeo(f))
        .map((f) => f.ref_barrio ?? '')
    );
    const crearBarrios = cabezales.filter((f) => {
      const c = f.datos_normalizados as CabezalBarrio;
      if (c.barrio_existente || f.decision_usuario === 'omitir') return false;
      if (f.estado_fila === 'error' && !soloErrorGeo(f)) return false;
      return true;
    }).length;
    const unidades = filas.filter((f) => f.tipo_fila === 'unidad' && !f.aplicada);
    const crearLotes = unidades.filter(
      (f) =>
        !bloqueadas.has(f.ref_barrio ?? '') &&
        f.estado_fila !== 'error' &&
        f.estado_fila !== 'duplicado' &&
        f.decision_usuario !== 'omitir'
    ).length;
    const omitirError = unidades.filter(
      (f) => f.estado_fila === 'error' && f.decision_usuario !== 'omitir'
    ).length;
    const aRevisar = unidades.filter(
      (f) =>
        (f.estado_fila === 'error' || f.estado_fila === 'advertencia') &&
        f.decision_usuario !== 'omitir'
    ).length;
    const seOmiten = unidades.filter(
      (f) => f.decision_usuario === 'omitir' || f.estado_fila === 'duplicado'
    ).length;
    const sugerencias = filas.reduce((n, f) => n + (f.correcciones_sugeridas?.length ?? 0), 0);
    return {
      crearBarrios,
      crearLotes,
      omitirError,
      hojasSaltadas: bloqueadas.size,
      aRevisar,
      seOmiten,
      sugerencias,
    };
  }

  private async crearPlantillas(
    filas: FilaExtendida[],
    refToBarrioId: Map<string, string>
  ): Promise<number> {
    const byId = new Map(filas.map((f) => [f.id, f]));
    let n = 0;
    for (const f of filas) {
      if (f.tipo_fila !== 'barrio') continue;
      const c = f.datos_normalizados as CabezalBarrio;
      if (!c.plantilla_fila_id) continue;
      const loteFila = byId.get(c.plantilla_fila_id);
      if (!loteFila || loteFila.tipo_fila !== 'unidad') continue;
      const lote = loteFila.datos_normalizados as FilaLote;
      const barrio_id = refToBarrioId.get(f.ref_barrio ?? '') ?? c.barrio_resuelto_id;
      if (!barrio_id) continue;
      const estadoInicial =
        lote.estado === 'reservado' || lote.estado === 'bloqueado' || lote.estado === 'disponible'
          ? lote.estado
          : 'disponible';
      await this.plantillasSvc.create({
        barrio_id,
        tipo_unidad: 'lote_vacio',
        nombre: (c.plantilla_nombre || c.nombre).trim() || c.nombre,
        patron_codigo: inferirPatronCodigo(lote.codigo),
        cantidad: 1,
        area_m2: lote.area_m2 || lote.metros_cuadrados,
        orientacion: orientacionValida(lote.orientacion),
        precio: lote.precio,
        moneda: lote.moneda,
        estado_inicial: estadoInicial,
        web_visible: true,
      });
      n++;
    }
    return n;
  }

  private async buildAnalyzeContext(barrioDestinoId?: string): Promise<AnalyzeContext> {
    const [existingBarrios, existingUnidades, departamentos, zonas] = await Promise.all([
      this.barriosService.listAsync() as Promise<BarriosResponse[]>,
      this.unidadesService.listAsync() as Promise<UnidadesResponse[]>,
      this.departamentosService.listAsync(),
      this.zonasService.listAsync(),
    ]);
    const barrioDestino = barrioDestinoId
      ? existingBarrios.find((b) => b.id === barrioDestinoId) ??
        (await this.barriosService.getAsync(barrioDestinoId).catch(() => null))
      : null;
    return {
      existingBarrios,
      existingUnidades,
      catalog: { departamentos, zonas },
      estados: this.definicionesCacheSvc.estadosActivosPara('unidades'),
      barrioDestino,
    };
  }

  private async crearFila(importacionId: string, fila: FilaProcesada): Promise<void> {
    await this.pb.collection('importacion_filas').create({
      importacion_id: importacionId,
      numero_fila: fila.numero_fila,
      tipo_fila: fila.tipo_fila,
      datos_originales: fila.datos_originales,
      datos_normalizados: fila.datos_normalizados,
      estado_fila: fila.estado_fila,
      mensajes: fila.mensajes,
      mensaje: fila.mensajes.join(' '),
      decision_usuario: fila.decision_usuario,
      registro_existente_id: fila.registro_existente_id ?? null,
      ref_barrio: fila.ref_barrio,
      correcciones_sugeridas: fila.correcciones_sugeridas,
      aplicada: false,
      barrio_resuelto_id: (fila.datos_normalizados as CabezalBarrio).barrio_resuelto_id ?? null,
    });
  }

  private async persistRevalidated(original: FilaExtendida[], reval: FilaProcesada[]): Promise<void> {
    for (let i = 0; i < original.length; i++) {
      const f = original[i];
      const p = reval[i];
      if (!p) continue;
      await this.pb.collection('importacion_filas').update(f.id, {
        datos_normalizados: p.datos_normalizados,
        datos_originales: p.datos_originales,
        mensajes: p.mensajes,
        mensaje: p.mensajes.join(' '),
        estado_fila: p.estado_fila,
        registro_existente_id: p.registro_existente_id ?? null,
        decision_usuario: p.decision_usuario,
        correcciones_sugeridas: p.correcciones_sugeridas,
        barrio_resuelto_id:
          p.tipo_fila === 'barrio'
            ? ((p.datos_normalizados as CabezalBarrio).barrio_resuelto_id ?? null)
            : f.barrio_resuelto_id ?? null,
      });
    }
  }

  private async recalcularContadores(importacionId: string): Promise<void> {
    const filas = await this.pb.collection('importacion_filas').getFullList<ImportacionFilasResponse>({
      filter: pbFilterImportacion(importacionId),
    });
    let ok = 0;
    let dup = 0;
    let err = 0;
    let adv = 0;
    let barrios = 0;
    let lotes = 0;
    for (const f of filas) {
      if (f.tipo_fila === 'barrio') barrios++;
      else if (f.tipo_fila === 'unidad') lotes++;
      if (f.estado_fila === 'ok') ok++;
      else if (f.estado_fila === 'duplicado') dup++;
      else if (f.estado_fila === 'error') err++;
      else if (f.estado_fila === 'advertencia') adv++;
    }
    const imp = await this.pb.collection('importaciones').getOne<ImportacionExtendida>(importacionId);
    const mapeo = { ...(imp.mapeo_geografia ?? emptyMapeo()), conteo: { barrios, lotes } };
    await this.pb.collection('importaciones').update(importacionId, {
      total_filas: filas.length,
      filas_ok: ok,
      filas_duplicado: dup,
      filas_error: err,
      filas_advertencia: adv,
      estado: 'listo_para_confirmar',
      mapeo_geografia: mapeo,
    });
  }
}

function pbFilterImportacion(importacionId: string): string {
  const safe = importacionId.replace(/'/g, "''");
  return `importacion_id = '${safe}'`;
}

function emptyMapeo(): MapeoGeografia {
  return { departamentos: [], zonas: [] };
}

function soloErrorGeo(f: FilaExtendida): boolean {
  const msgs = Array.isArray(f.mensajes) ? f.mensajes : f.mensaje ? [f.mensaje] : [];
  if (!msgs.length) return false;
  return msgs.every((m) => /sin mapear|geograf/i.test(m));
}

function pushOmision(
  list: { codigo: string; motivo: string }[],
  codigo: string,
  motivo: string
): void {
  if (list.length >= 12) return;
  list.push({ codigo, motivo });
}

function uniqueBarrios(items: { id: string; nombre: string }[]): { id: string; nombre: string }[] {
  const seen = new Set<string>();
  const out: { id: string; nombre: string }[] = [];
  for (const b of items) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    out.push(b);
  }
  return out;
}

function hydrateFila(f: FilaExtendida): FilaExtendida {
  const orig = (f.datos_originales ?? {}) as Record<string, unknown>;
  const norm = f.datos_normalizados as CabezalBarrio | FilaLote | null;
  const hoja =
    (typeof orig['_hoja'] === 'string' ? orig['_hoja'] : undefined) ??
    (norm && 'nombre_hoja' in norm ? norm.nombre_hoja : undefined);
  return { ...f, nombre_hoja: hoja };
}

function toProcesada(f: FilaExtendida): FilaProcesada {
  const orig = (f.datos_originales ?? {}) as Record<string, unknown>;
  return {
    numero_fila: f.numero_fila,
    tipo_fila: f.tipo_fila,
    datos_originales: orig,
    datos_normalizados: f.datos_normalizados as CabezalBarrio | FilaLote,
    estado_fila: f.estado_fila as EstadoFila,
    mensajes: Array.isArray(f.mensajes) ? f.mensajes : f.mensaje ? [f.mensaje] : [],
    decision_usuario: (f.decision_usuario as DecisionUsuario) ?? 'pendiente',
    registro_existente_id: f.registro_existente_id,
    ref_barrio: f.ref_barrio ?? '',
    correcciones_sugeridas: (f.correcciones_sugeridas ?? []) as CorreccionSugerida[],
    nombre_hoja: f.nombre_hoja ?? String(orig['_hoja'] ?? ''),
    fila_excel: Number(orig['_fila_excel'] ?? f.numero_fila),
  };
}

function applyCambios(p: FilaProcesada, cambios: Record<string, unknown>): FilaProcesada {
  const orig = { ...p.datos_originales };
  if (p.tipo_fila === 'barrio') {
    const c = { ...(p.datos_normalizados as CabezalBarrio) };
    if (typeof cambios['nombre'] === 'string') {
      c.nombre = cambios['nombre'];
      c.slug = toSlug(c.nombre);
      orig['nombre'] = c.nombre;
    }
    if (typeof cambios['descripcion'] === 'string') {
      c.descripcion = cambios['descripcion'];
      orig['descripcion'] = c.descripcion;
    }
    if (typeof cambios['ubicacion_texto'] === 'string') {
      c.ubicacion_texto = cambios['ubicacion_texto'];
      orig['ubicacion_texto'] = c.ubicacion_texto;
    }
    if (typeof cambios['moneda_default'] === 'string') {
      c.moneda_default = cambios['moneda_default'] as MonedaImportacion;
      orig['moneda_default'] = c.moneda_default;
    }
    if (typeof cambios['estado_default'] === 'string') {
      c.estado_default = cambios['estado_default'];
      orig['estado_default'] = c.estado_default;
    }
    if (typeof cambios['plantilla_nombre'] === 'string') c.plantilla_nombre = cambios['plantilla_nombre'];
    if ('plantilla_fila_id' in cambios) c.plantilla_fila_id = (cambios['plantilla_fila_id'] as string | null) ?? null;
    return { ...p, datos_normalizados: c, datos_originales: orig };
  }
  const u = { ...(p.datos_normalizados as FilaLote) };
  if ('codigo' in cambios || 'numero_lote' in cambios) {
    u.codigo = String(cambios['codigo'] ?? cambios['numero_lote'] ?? u.codigo);
    orig['numero_lote'] = u.codigo;
  }
  if ('metros_cuadrados' in cambios) {
    const n = Number(cambios['metros_cuadrados']);
    u.metros_cuadrados = n;
    u.area_m2 = n;
    orig['metros_cuadrados'] = n;
  }
  if ('precio' in cambios) {
    const n = Number(cambios['precio']);
    u.precio = n;
    orig['precio'] = n;
  }
  if (typeof cambios['moneda'] === 'string') {
    u.moneda = cambios['moneda'] as MonedaImportacion;
    orig['moneda'] = u.moneda;
  }
  if (typeof cambios['estado'] === 'string') {
    u.estado = cambios['estado'];
    orig['estado'] = u.estado;
  }
  if ('orientacion' in cambios) {
    u.orientacion = cambios['orientacion'] ? String(cambios['orientacion']) : undefined;
    orig['orientacion'] = u.orientacion ?? '';
  }
  return { ...p, datos_normalizados: u, datos_originales: orig };
}

function coerceCampo(campo: string, valor: string): unknown {
  if (campo === 'metros_cuadrados' || campo === 'precio') return Number(valor);
  return valor;
}

function orientacionValida(value?: string): UnidadesOrientacionOptions | undefined {
  const t = value?.trim();
  if (!t) return undefined;
  if ((ORIENTACIONES_CANONICAS as readonly string[]).includes(t)) {
    return t as UnidadesOrientacionOptions;
  }
  return undefined;
}

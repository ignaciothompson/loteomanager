import { Injectable, Signal, inject, signal } from '@angular/core';
import {
  BarriosService,
  UnidadesService,
  UsersService,
  ImportacionesService,
  ImportacionFilasService,
  DefinicionesCacheService,
  POCKETBASE,
} from '@loteomanager/shared-pb-client';
import {
  BarriosResponse,
  UnidadesResponse,
  ImportacionesResponse,
  ImportacionFilasResponse,
} from '@loteomanager/shared-types';
import { parseExcelFile, RawRow } from '../parser/excel-parser';
import { normalizeBarrioRow, normalizeUnidadRow } from '../parser/normalizer';
import { validateBarrio, validateUnidad } from '../parser/row-validator';
import { checkBarrioDuplicate, checkUnidadDuplicate } from '../parser/duplicate-detector';
import { AnalisisColumnas, MapeoColumnas, MapeoExtras, ResultadoCommit } from '../parser/types';
import PocketBase from 'pocketbase';

// ── Types for migration 1700000070 new fields (not yet in generated pocketbase-types) ──

interface ImportacionExtendida extends ImportacionesResponse {
  nombre_archivo?: string;
  mapeo_columnas?: Record<string, string | null>;
  mapeo_extras?: Record<string, string | null>;
}

interface FilaExtendida extends ImportacionFilasResponse {
  tipo_fila: 'barrio' | 'unidad';
  mensajes: string[];
  registro_creado_id?: string;
  error_aplicacion?: string;
}

// Payload shape stored in datos_normalizados for each tipo_fila
interface BarrioDatosNormalizados {
  nombre: string;
  slug: string;
  descripcion?: string;
  ubicacion_texto?: string;
  lat?: number;
  lng?: number;
  zona?: string;
  extras?: unknown; // ExtraPersistido[]
}

interface UnidadDatosNormalizados {
  tipo_unidad: 'lote' | 'casa' | 'departamento';
  codigo_interno: string;
  barrio_id?: string;
  numero_unidad?: string;
  direccion_propia?: string;
  metros_cuadrados: number;
  metros_construidos?: number;
  ambientes?: number;
  antiguedad_anios?: number;
  cocheras?: number;
  precio: number;
  moneda: 'USD' | 'ARS';
  estado: string;
  oferta?: boolean;
  precio_oferta?: number;
  destacado?: boolean;
  responsable_id?: string;
  descripcion?: string;
  extras?: unknown; // ExtraPersistido[]
}

type EstadoFila = 'ok' | 'duplicado' | 'error' | 'advertencia';

@Injectable({ providedIn: 'root' })
export class ImportadorService {
  private pb = inject(POCKETBASE) as PocketBase;
  private definicionesCacheSvc = inject(DefinicionesCacheService);
  private barriosService = inject(BarriosService);
  private unidadesService = inject(UnidadesService);
  private usersService = inject(UsersService);
  private importacionesService = inject(ImportacionesService);
  private filasService = inject(ImportacionFilasService);

  // ── Public read-only signals ────────────────────────────────────────────

  listarImportaciones(): Signal<ImportacionesResponse[]> {
    return this.importacionesService.list();
  }

  obtenerImportacion(id: string): Signal<ImportacionesResponse | null> {
    return this.importacionesService.get(id);
  }

  listarFilas(importacionId: string): Signal<ImportacionFilasResponse[]> {
    return this.filasService.list(`importacion_id='${importacionId}'`);
  }

  // ── Main analysis entry point ───────────────────────────────────────────

  async analizarExcel(file: File): Promise<string> {
    const extras = this.definicionesCacheSvc.extras();
    const estadosUnidades = this.definicionesCacheSvc.estadosActivosPara('unidades');

    // Step 1: Parse file (includes 10 MB check)
    const { rows, analisis } = await parseExcelFile(file, extras);

    // Step 2: Create importacion record with file upload
    const formData = new FormData();
    formData.append('archivo_origen', file);
    formData.append('tipo', 'barrios_con_unidades');
    formData.append('origen', 'excel');
    formData.append('estado', 'analizando');
    formData.append('nombre_archivo', file.name);
    formData.append('creado_por', this.pb.authStore.model?.['id'] ?? '');

    const importacion = await this.pb
      .collection('importaciones')
      .create<ImportacionExtendida>(formData);

    const importacionId = importacion.id;
    console.info(`[ImportadorService] Importación creada: ${importacionId} para archivo "${file.name}"`);

    // Step 3: Save mapeo_columnas and mapeo_extras
    const mapeoColumnas: MapeoColumnas = {};
    for (const [header, field] of analisis.columnasConocidas.entries()) {
      mapeoColumnas[header] = field;
    }
    for (const h of analisis.columnasDesconocidas) {
      mapeoColumnas[h] = null;
    }

    const mapeoExtras: MapeoExtras = {};
    for (const [header, extraId] of analisis.columnasExtras.entries()) {
      mapeoExtras[header] = extraId;
    }

    await this.pb.collection('importaciones').update(importacionId, {
      mapeo_columnas: mapeoColumnas,
      mapeo_extras: mapeoExtras,
    });

    // Step 4: Fetch existing barrios and unidades for duplicate detection
    const [existingBarrios, existingUnidades] = await Promise.all([
      this.barriosService.listAsync() as Promise<BarriosResponse[]>,
      this.unidadesService.listAsync() as Promise<UnidadesResponse[]>,
    ]);

    // Step 5 & 6: Process rows
    const barrioRows = rows.filter(r => String(r.data['tipo'] ?? '').toLowerCase().trim() === 'barrio');
    const unidadRows = rows.filter(r => String(r.data['tipo'] ?? '').toLowerCase().trim() === 'unidad');

    let filasOk = 0;
    let filasDuplicado = 0;
    let filasError = 0;
    let filasAdvertencia = 0;

    // Track barrios from this import (slug → fila datos_normalizados) for cross-referencing
    const barriosDeLaImportacion = new Map<string, BarrioDatosNormalizados>();
    // Track seen slugs/codigos within this batch for intra-Excel duplicate detection
    const seenBarrioSlugs = new Map<string, number>(); // slug → first numero_fila
    const seenUnidadCodigos = new Map<string, number>(); // codigo_interno → first numero_fila

    // Process barrio rows
    for (const row of barrioRows) {
      const { data, errores, advertencias } = normalizeBarrioRow(row.data, analisis, extras);
      const msgs = validateBarrio(data, errores);
      const allMessages = [...msgs, ...advertencias];

      let estadoFila: EstadoFila;
      let registroExistenteId: string | undefined;

      if (msgs.length > 0) {
        estadoFila = 'error';
      } else {
        // Check intra-Excel duplicate first
        const seenAtFila = seenBarrioSlugs.get(data.slug);
        if (seenAtFila !== undefined) {
          estadoFila = 'duplicado';
          allMessages.push(`Duplicado dentro del archivo: el barrio con código "${data.slug}" ya aparece en la fila ${seenAtFila}.`);
        } else {
          seenBarrioSlugs.set(data.slug, row.numero_fila);
          const dupResult = checkBarrioDuplicate(data.slug, existingBarrios);
          if (dupResult.isDuplicate) {
            estadoFila = 'duplicado';
            registroExistenteId = dupResult.existingId;
            allMessages.push(`El barrio con slug "${data.slug}" ya existe en el sistema (ID: ${dupResult.existingId}).`);
          } else if (advertencias.length > 0) {
            estadoFila = 'advertencia';
          } else {
            estadoFila = 'ok';
          }
        }
      }

      const barrioDatos: BarrioDatosNormalizados = {
        nombre: data.nombre,
        slug: data.slug,
        descripcion: data.descripcion,
        ubicacion_texto: data.ubicacion_texto,
        lat: data.lat,
        lng: data.lng,
        zona: data.zona,
        extras: data.extras,
      };

      if (estadoFila !== 'error') {
        barriosDeLaImportacion.set(data.codigo_interno_ref, barrioDatos);
      }

      await this.crearFila({
        importacionId,
        numeroFila: row.numero_fila,
        tipoFila: 'barrio',
        datosOriginales: row.data,
        datosNormalizados: barrioDatos,
        estadoFila,
        mensajes: allMessages,
        registroExistenteId,
      });

      if (estadoFila === 'ok') filasOk++;
      else if (estadoFila === 'duplicado') filasDuplicado++;
      else if (estadoFila === 'error') filasError++;
      else filasAdvertencia++;
    }

    // Process unidad rows
    for (const row of unidadRows) {
      const { data, errores, advertencias } = normalizeUnidadRow(row.data, analisis, extras);
      const msgs = validateUnidad(data, errores, estadosUnidades);
      const allMessages = [...msgs, ...advertencias];

      // Resolve barrio_id from existing DB or this import's barrio rows
      let resolvedBarrioId: string | undefined;
      if (data.barrio_codigo_interno_ref) {
        const dbBarrio = existingBarrios.find(b => b.slug === data.barrio_codigo_interno_ref);
        if (dbBarrio) {
          resolvedBarrioId = dbBarrio.id;
        } else {
          // May be created by this import – not resolved yet; will be resolved at commit time
          const importBarrio = barriosDeLaImportacion.get(data.barrio_codigo_interno_ref);
          if (!importBarrio) {
            allMessages.push(
              `No se encontró barrio con codigo_interno "${data.barrio_codigo_interno_ref}" en la base de datos ni en el archivo.`
            );
          }
        }
      }

      // Resolve responsable_id from email
      let resolvedResponsableId: string | undefined;
      if (data.responsable_email) {
        try {
          const safeEmail = data.responsable_email.replace(/'/g, "\\'");
          const users = await this.usersService.listAsync(`email='${safeEmail}'`);
          if (users.length > 0) {
            resolvedResponsableId = users[0].id;
          } else {
            allMessages.push(
              `No se encontró un usuario con email "${data.responsable_email}". Se usará el usuario actual como responsable.`
            );
          }
        } catch (err) {
          console.error('[ImportadorService] Error buscando responsable:', err);
          allMessages.push(`Error al buscar responsable "${data.responsable_email}".`);
        }
      }

      const unidadDatos: UnidadDatosNormalizados = {
        tipo_unidad: data.tipo_unidad,
        codigo_interno: data.codigo_interno,
        barrio_id: resolvedBarrioId,
        numero_unidad: data.numero_unidad,
        direccion_propia: data.direccion_propia,
        metros_cuadrados: data.metros_cuadrados,
        metros_construidos: data.metros_construidos,
        ambientes: data.ambientes,
        antiguedad_anios: data.antiguedad_anios,
        cocheras: data.cocheras,
        precio: data.precio,
        moneda: data.moneda,
        estado: data.estado,
        oferta: data.oferta,
        precio_oferta: data.precio_oferta,
        destacado: data.destacado,
        responsable_id: resolvedResponsableId,
        descripcion: data.descripcion,
        extras: data.extras,
      };

      let estadoFila: EstadoFila;
      let registroExistenteId: string | undefined;

      if (msgs.length > 0) {
        estadoFila = 'error';
      } else {
        // Check intra-Excel duplicate first
        const seenAtFila = seenUnidadCodigos.get(data.codigo_interno);
        if (seenAtFila !== undefined) {
          estadoFila = 'duplicado';
          allMessages.push(`Duplicado dentro del archivo: la unidad con código "${data.codigo_interno}" ya aparece en la fila ${seenAtFila}.`);
        } else {
          seenUnidadCodigos.set(data.codigo_interno, row.numero_fila);
          const dupResult = checkUnidadDuplicate(data.codigo_interno, existingUnidades);
          if (dupResult.isDuplicate) {
            estadoFila = 'duplicado';
            registroExistenteId = dupResult.existingId;
            allMessages.push(
              `La unidad con codigo_interno "${data.codigo_interno}" ya existe en el sistema (ID: ${dupResult.existingId}).`
            );
          } else if (advertencias.length > 0) {
            estadoFila = 'advertencia';
          } else {
            estadoFila = 'ok';
          }
        }
      }

      await this.crearFila({
        importacionId,
        numeroFila: row.numero_fila,
        tipoFila: 'unidad',
        datosOriginales: row.data,
        datosNormalizados: unidadDatos,
        estadoFila,
        mensajes: allMessages,
        registroExistenteId,
      });

      if (estadoFila === 'ok') filasOk++;
      else if (estadoFila === 'duplicado') filasDuplicado++;
      else if (estadoFila === 'error') filasError++;
      else filasAdvertencia++;
    }

    // Step 7: Determine final importacion estado and update stats
    const totalFilas = barrioRows.length + unidadRows.length;
    const estadoFinal: string =
      filasError > 0 && filasOk === 0 && filasAdvertencia === 0 && filasDuplicado === 0
        ? 'con_errores'
        : 'listo_para_confirmar';

    await this.pb.collection('importaciones').update(importacionId, {
      total_filas: totalFilas,
      filas_ok: filasOk,
      filas_duplicado: filasDuplicado,
      filas_error: filasError,
      filas_advertencia: filasAdvertencia,
      estado: estadoFinal,
    });

    console.info(
      `[ImportadorService] Análisis completado: ${totalFilas} filas (ok=${filasOk}, dup=${filasDuplicado}, err=${filasError}, adv=${filasAdvertencia})`
    );

    return importacionId;
  }

  // ── Mapeo management ────────────────────────────────────────────────────

  async guardarMapeoColumnas(importacionId: string, mapeo: MapeoColumnas): Promise<void> {
    await this.pb.collection('importaciones').update(importacionId, {
      mapeo_columnas: mapeo,
    });
    console.info(`[ImportadorService] mapeo_columnas guardado para importacion ${importacionId}`);
  }

  async guardarMapeoExtras(importacionId: string, mapeo: MapeoExtras): Promise<void> {
    await this.pb.collection('importaciones').update(importacionId, {
      mapeo_extras: mapeo,
    });
    console.info(`[ImportadorService] mapeo_extras guardado para importacion ${importacionId}`);
  }

  /**
   * Re-downloads the original file from PocketBase and re-processes all rows
   * using the current mapeo_columnas and mapeo_extras stored on the importacion.
   * Deletes all existing filas before re-creating them.
   */
  async reAnalizarConMapeo(importacionId: string): Promise<void> {
    const importacion = (await this.importacionesService.getAsync(
      importacionId
    )) as ImportacionExtendida;

    if (!importacion.archivo_origen) {
      throw new Error('La importación no tiene un archivo asociado.');
    }

    // Build authenticated file URL
    const fileUrl = this.pb.files.getURL(
      importacion as Parameters<typeof this.pb.files.getURL>[0],
      importacion.archivo_origen
    );
    const response = await fetch(fileUrl, {
      headers: { Authorization: this.pb.authStore.token ?? '' },
    });
    if (!response.ok) {
      throw new Error(`Error al descargar el archivo original: HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const file = new File([blob], importacion.nombre_archivo ?? importacion.archivo_origen, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Delete existing filas
    const filasExistentes = await this.pb
      .collection('importacion_filas')
      .getFullList<ImportacionFilasResponse>({
        filter: `importacion_id='${importacionId}'`,
      });

    await Promise.all(
      filasExistentes.map(f => this.pb.collection('importacion_filas').delete(f.id))
    );

    console.info(
      `[ImportadorService] Eliminadas ${filasExistentes.length} filas para re-análisis de ${importacionId}`
    );

    // Re-parse with saved mapeo
    const extras = this.definicionesCacheSvc.extras();
    const estadosUnidades = this.definicionesCacheSvc.estadosActivosPara('unidades');
    const mapeoColumnas = importacion.mapeo_columnas ?? {};
    const mapeoExtras = importacion.mapeo_extras ?? {};

    const { rows, analisis } = await parseExcelFile(file, extras, mapeoColumnas, mapeoExtras);

    const [existingBarrios, existingUnidades] = await Promise.all([
      this.barriosService.listAsync() as Promise<BarriosResponse[]>,
      this.unidadesService.listAsync() as Promise<UnidadesResponse[]>,
    ]);

    const barrioRows = rows.filter(
      r => String(r.data['tipo'] ?? '').toLowerCase().trim() === 'barrio'
    );
    const unidadRows = rows.filter(
      r => String(r.data['tipo'] ?? '').toLowerCase().trim() === 'unidad'
    );

    let filasOk = 0;
    let filasDuplicado = 0;
    let filasError = 0;
    let filasAdvertencia = 0;

    const barriosDeLaImportacion = new Map<string, BarrioDatosNormalizados>();
    const seenBarrioSlugsR = new Map<string, number>();
    const seenUnidadCodigosR = new Map<string, number>();

    for (const row of barrioRows) {
      const { data, errores, advertencias } = normalizeBarrioRow(row.data, analisis, extras);
      const msgs = validateBarrio(data, errores);
      const allMessages = [...msgs, ...advertencias];

      let estadoFila: EstadoFila;
      let registroExistenteId: string | undefined;

      if (msgs.length > 0) {
        estadoFila = 'error';
      } else {
        const seenAtFilaB = seenBarrioSlugsR.get(data.slug);
        if (seenAtFilaB !== undefined) {
          estadoFila = 'duplicado';
          allMessages.push(`Duplicado dentro del archivo: el barrio con código "${data.slug}" ya aparece en la fila ${seenAtFilaB}.`);
        } else {
          seenBarrioSlugsR.set(data.slug, row.numero_fila);
          const dupResult = checkBarrioDuplicate(data.slug, existingBarrios);
          if (dupResult.isDuplicate) {
            estadoFila = 'duplicado';
            registroExistenteId = dupResult.existingId;
            allMessages.push(
              `El barrio con slug "${data.slug}" ya existe en el sistema (ID: ${dupResult.existingId}).`
            );
          } else if (advertencias.length > 0) {
            estadoFila = 'advertencia';
          } else {
            estadoFila = 'ok';
          }
        }
      }

      const barrioDatos: BarrioDatosNormalizados = {
        nombre: data.nombre,
        slug: data.slug,
        descripcion: data.descripcion,
        ubicacion_texto: data.ubicacion_texto,
        lat: data.lat,
        lng: data.lng,
        zona: data.zona,
        extras: data.extras,
      };

      if (estadoFila !== 'error') barriosDeLaImportacion.set(data.codigo_interno_ref, barrioDatos);

      await this.crearFila({
        importacionId,
        numeroFila: row.numero_fila,
        tipoFila: 'barrio',
        datosOriginales: row.data,
        datosNormalizados: barrioDatos,
        estadoFila,
        mensajes: allMessages,
        registroExistenteId,
      });

      if (estadoFila === 'ok') filasOk++;
      else if (estadoFila === 'duplicado') filasDuplicado++;
      else if (estadoFila === 'error') filasError++;
      else filasAdvertencia++;
    }

    for (const row of unidadRows) {
      const { data, errores, advertencias } = normalizeUnidadRow(row.data, analisis, extras);
      const msgs = validateUnidad(data, errores, estadosUnidades);
      const allMessages = [...msgs, ...advertencias];

      let resolvedBarrioId: string | undefined;
      if (data.barrio_codigo_interno_ref) {
        const dbBarrio = existingBarrios.find(b => b.slug === data.barrio_codigo_interno_ref);
        if (dbBarrio) {
          resolvedBarrioId = dbBarrio.id;
        } else if (!barriosDeLaImportacion.has(data.barrio_codigo_interno_ref)) {
          allMessages.push(
            `No se encontró barrio con codigo_interno "${data.barrio_codigo_interno_ref}".`
          );
        }
      }

      let resolvedResponsableId: string | undefined;
      if (data.responsable_email) {
        try {
          const safeEmail = data.responsable_email.replace(/'/g, "\\'");
          const users = await this.usersService.listAsync(`email='${safeEmail}'`);
          if (users.length > 0) {
            resolvedResponsableId = users[0].id;
          } else {
            allMessages.push(
              `No se encontró usuario con email "${data.responsable_email}". Se usará el usuario actual.`
            );
          }
        } catch (err) {
          console.error('[ImportadorService] Error buscando responsable:', err);
        }
      }

      const unidadDatos: UnidadDatosNormalizados = {
        tipo_unidad: data.tipo_unidad,
        codigo_interno: data.codigo_interno,
        barrio_id: resolvedBarrioId,
        numero_unidad: data.numero_unidad,
        direccion_propia: data.direccion_propia,
        metros_cuadrados: data.metros_cuadrados,
        metros_construidos: data.metros_construidos,
        ambientes: data.ambientes,
        antiguedad_anios: data.antiguedad_anios,
        cocheras: data.cocheras,
        precio: data.precio,
        moneda: data.moneda,
        estado: data.estado,
        oferta: data.oferta,
        precio_oferta: data.precio_oferta,
        destacado: data.destacado,
        responsable_id: resolvedResponsableId,
        descripcion: data.descripcion,
        extras: data.extras,
      };

      let estadoFila: EstadoFila;
      let registroExistenteId: string | undefined;

      if (msgs.length > 0) {
        estadoFila = 'error';
      } else {
        const seenAtFilaR = seenUnidadCodigosR.get(data.codigo_interno);
        if (seenAtFilaR !== undefined) {
          estadoFila = 'duplicado';
          allMessages.push(`Duplicado dentro del archivo: la unidad con código "${data.codigo_interno}" ya aparece en la fila ${seenAtFilaR}.`);
        } else {
          seenUnidadCodigosR.set(data.codigo_interno, row.numero_fila);
          const dupResult = checkUnidadDuplicate(data.codigo_interno, existingUnidades);
          if (dupResult.isDuplicate) {
            estadoFila = 'duplicado';
            registroExistenteId = dupResult.existingId;
            allMessages.push(
              `La unidad "${data.codigo_interno}" ya existe en el sistema (ID: ${dupResult.existingId}).`
            );
          } else if (advertencias.length > 0) {
            estadoFila = 'advertencia';
          } else {
            estadoFila = 'ok';
          }
        }
      }

      await this.crearFila({
        importacionId,
        numeroFila: row.numero_fila,
        tipoFila: 'unidad',
        datosOriginales: row.data,
        datosNormalizados: unidadDatos,
        estadoFila,
        mensajes: allMessages,
        registroExistenteId,
      });

      if (estadoFila === 'ok') filasOk++;
      else if (estadoFila === 'duplicado') filasDuplicado++;
      else if (estadoFila === 'error') filasError++;
      else filasAdvertencia++;
    }

    const totalFilas = barrioRows.length + unidadRows.length;
    const estadoFinal: string =
      filasError > 0 && filasOk === 0 && filasAdvertencia === 0 && filasDuplicado === 0
        ? 'con_errores'
        : 'listo_para_confirmar';

    await this.pb.collection('importaciones').update(importacionId, {
      total_filas: totalFilas,
      filas_ok: filasOk,
      filas_duplicado: filasDuplicado,
      filas_error: filasError,
      filas_advertencia: filasAdvertencia,
      estado: estadoFinal,
    });

    console.info(`[ImportadorService] Re-análisis completado para ${importacionId}`);
  }

  // ── Row editing ─────────────────────────────────────────────────────────

  async editarFila(
    filaId: string,
    datosNormalizados: Record<string, unknown>
  ): Promise<void> {
    const fila = (await this.filasService.getAsync(filaId)) as FilaExtendida;
    const extras = this.definicionesCacheSvc.extras();
    const estadosUnidades = this.definicionesCacheSvc.estadosActivosPara('unidades');

    let nuevoEstado: EstadoFila = 'ok';
    let mensajes: string[] = [];

    if (fila.tipo_fila === 'barrio') {
      const rawBarrio = datosNormalizados as unknown as BarrioDatosNormalizados;
      const errores: string[] = [];
      if (!rawBarrio.nombre) errores.push('El campo "nombre" es obligatorio.');
      if (!rawBarrio.slug) errores.push('No se puede generar el slug.');
      mensajes = errores;
      nuevoEstado = errores.length > 0 ? 'error' : 'ok';
    } else {
      const rawUnidad = datosNormalizados as unknown as UnidadDatosNormalizados;
      const errores: string[] = [];
      if (!rawUnidad.codigo_interno) errores.push('El campo "codigo_interno" es obligatorio.');
      if (!rawUnidad.metros_cuadrados) errores.push('El campo "metros_cuadrados" es obligatorio.');
      if (!rawUnidad.precio && rawUnidad.precio !== 0) errores.push('El campo "precio" es obligatorio.');
      if (rawUnidad.estado) {
        const codesValidos = estadosUnidades.map(e => e.code);
        const hardcoded = ['disponible', 'bloqueado', 'reservado', 'sena', 'vendido', 'escriturado'];
        const allValidos = [...new Set([...codesValidos, ...hardcoded])];
        if (!allValidos.includes(rawUnidad.estado)) {
          errores.push(
            `El estado "${rawUnidad.estado}" no es válido. Permitidos: ${allValidos.join(', ')}.`
          );
        }
      }
      mensajes = errores;
      nuevoEstado = errores.length > 0 ? 'error' : 'ok';
    }

    await this.pb.collection('importacion_filas').update(filaId, {
      datos_normalizados: datosNormalizados,
      estado_fila: nuevoEstado,
      mensajes,
    });

    console.info(`[ImportadorService] Fila ${filaId} editada → estado ${nuevoEstado}`);
  }

  // ── Commit ──────────────────────────────────────────────────────────────

  async commitImportacion(importacionId: string): Promise<ResultadoCommit> {
    const todasLasFilas = await this.pb
      .collection('importacion_filas')
      .getFullList<ImportacionFilasResponse>({
        filter: `importacion_id='${importacionId}' && aplicada=false && decision_usuario!='omitir'`,
      });

    const filas = todasLasFilas as FilaExtendida[];

    // Sort: barrio filas first, then unidad filas
    filas.sort((a, b) => {
      if (a.tipo_fila === 'barrio' && b.tipo_fila !== 'barrio') return -1;
      if (a.tipo_fila !== 'barrio' && b.tipo_fila === 'barrio') return 1;
      return a.numero_fila - b.numero_fila;
    });

    const currentUserId = this.pb.authStore.model?.['id'] ?? '';
    let filasAplicadas = 0;
    let filasFallidas = 0;
    let filasOmitidas = 0;
    const errores: Array<{ numero_fila: number; error: string }> = [];

    // Tracks barrios created in this commit: codigo_interno → new PB id
    const barriosCreados = new Map<string, string>();

    // Fetch existing barrios for barrio_id resolution
    const existingBarrios = (await this.barriosService.listAsync()) as BarriosResponse[];

    for (const fila of filas) {
      const decision = fila.decision_usuario;
      const estadoFila = fila.estado_fila;

      // Skip error rows that have no explicit 'crear' decision
      if (estadoFila === 'error' && decision !== 'crear' && decision !== 'actualizar') {
        filasFallidas++;
        errores.push({
          numero_fila: fila.numero_fila,
          error: `Fila con errores de validación omitida. Mensajes: ${(fila.mensajes ?? []).join('; ')}`,
        });
        continue;
      }

      // Determine action
      const shouldCreate =
        decision === 'crear' ||
        (decision === 'pendiente' && (estadoFila === 'ok' || estadoFila === 'advertencia'));
      const shouldUpdate = decision === 'actualizar';

      if (!shouldCreate && !shouldUpdate) {
        filasOmitidas++;
        continue;
      }

      try {
        if (fila.tipo_fila === 'barrio') {
          await this.commitBarrioFila(
            fila,
            shouldCreate,
            shouldUpdate,
            currentUserId,
            barriosCreados
          );
          filasAplicadas++;
        } else {
          await this.commitUnidadFila(
            fila,
            shouldCreate,
            shouldUpdate,
            currentUserId,
            existingBarrios,
            barriosCreados
          );
          filasAplicadas++;
        }
      } catch (err) {
        filasFallidas++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        errores.push({ numero_fila: fila.numero_fila, error: errorMsg });
        console.error(`[ImportadorService] Error aplicando fila ${fila.numero_fila}:`, err);

        await this.pb.collection('importacion_filas').update(fila.id, {
          error_aplicacion: errorMsg,
        });
      }
    }

    // Update importacion to 'confirmada'
    await this.pb.collection('importaciones').update(importacionId, {
      estado: 'confirmada',
      confirmada_en: new Date().toISOString(),
    });

    // Write audit log directly (AuditLogService throws on create)
    try {
      await this.pb.collection('audit_log').create({
        action: 'create',
        collection_name: 'importaciones',
        record_id: importacionId,
        user_id: currentUserId,
        after: { filas_aplicadas: filasAplicadas, filas_fallidas: filasFallidas },
      });
    } catch (auditErr) {
      console.error('[ImportadorService] Error escribiendo audit_log:', auditErr);
    }

    const resultado: ResultadoCommit = {
      importacion_id: importacionId,
      filas_aplicadas: filasAplicadas,
      filas_fallidas: filasFallidas,
      filas_omitidas: filasOmitidas,
      errores,
    };

    console.info(
      `[ImportadorService] Commit completado: aplicadas=${filasAplicadas}, fallidas=${filasFallidas}, omitidas=${filasOmitidas}`
    );

    return resultado;
  }

  async descartarImportacion(importacionId: string): Promise<void> {
    await this.pb.collection('importaciones').update(importacionId, {
      estado: 'descartada',
    });
    console.info(`[ImportadorService] Importación ${importacionId} descartada.`);
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async crearFila(params: {
    importacionId: string;
    numeroFila: number;
    tipoFila: 'barrio' | 'unidad';
    datosOriginales: Record<string, unknown>;
    datosNormalizados: BarrioDatosNormalizados | UnidadDatosNormalizados;
    estadoFila: EstadoFila;
    mensajes: string[];
    registroExistenteId?: string;
  }): Promise<void> {
    await this.pb.collection('importacion_filas').create({
      importacion_id: params.importacionId,
      numero_fila: params.numeroFila,
      tipo_fila: params.tipoFila,
      datos_originales: params.datosOriginales,
      datos_normalizados: params.datosNormalizados,
      estado_fila: params.estadoFila,
      mensajes: params.mensajes,
      decision_usuario: 'pendiente',
      registro_existente_id: params.registroExistenteId ?? null,
      aplicada: false,
    });
  }

  private async commitBarrioFila(
    fila: FilaExtendida,
    shouldCreate: boolean,
    shouldUpdate: boolean,
    currentUserId: string,
    barriosCreados: Map<string, string>
  ): Promise<void> {
    const datos = fila.datos_normalizados as BarrioDatosNormalizados;

    // Build PB payload (extras stay as-is; PB handles JSON serialization)
    const payload: Record<string, unknown> = {
      nombre: datos.nombre,
      slug: datos.slug,
      descripcion: datos.descripcion ?? null,
      ubicacion_texto: datos.ubicacion_texto ?? null,
      lat: datos.lat ?? null,
      lng: datos.lng ?? null,
      zona: datos.zona ?? null,
      extras: datos.extras ?? null,
    };

    if (shouldCreate) {
      const created = await this.pb.collection('barrios').create<BarriosResponse>(payload);

      // Track for cross-referencing with unidades
      const datosOriginais = fila.datos_originales as Record<string, unknown>;
      const codigoInterno =
        String(datosOriginais['codigo_interno'] ?? datos.slug ?? '').trim();
      if (codigoInterno) barriosCreados.set(codigoInterno, created.id);

      await this.pb.collection('importacion_filas').update(fila.id, {
        aplicada: true,
        registro_creado_id: created.id,
      });
    } else if (shouldUpdate && fila.registro_existente_id) {
      await this.pb.collection('barrios').update(fila.registro_existente_id, payload);
      await this.pb.collection('importacion_filas').update(fila.id, { aplicada: true });
    }
  }

  private async commitUnidadFila(
    fila: FilaExtendida,
    shouldCreate: boolean,
    shouldUpdate: boolean,
    currentUserId: string,
    existingBarrios: BarriosResponse[],
    barriosCreados: Map<string, string>
  ): Promise<void> {
    const datos = fila.datos_normalizados as UnidadDatosNormalizados;
    const datosOriginais = fila.datos_originales as Record<string, unknown>;

    // Resolve barrio_id if not already set in datos_normalizados
    let barrio_id = datos.barrio_id;
    if (!barrio_id) {
      const codigoInternoBarrio = String(
        datosOriginais['barrio_codigo_interno'] ?? ''
      ).trim();
      if (codigoInternoBarrio) {
        // Check newly created barrios in this commit first
        const createdId = barriosCreados.get(codigoInternoBarrio);
        if (createdId) {
          barrio_id = createdId;
        } else {
          // Fall back to existing DB barrios (by slug = codigo_interno convention)
          const dbBarrio = existingBarrios.find(b => b.slug === codigoInternoBarrio);
          if (dbBarrio) barrio_id = dbBarrio.id;
        }
      }
    }

    // Fallback responsable_id to current user
    const responsable_id = datos.responsable_id || currentUserId;

    const payload: Record<string, unknown> = {
      tipo_unidad: datos.tipo_unidad,
      codigo_interno: datos.codigo_interno,
      barrio_id: barrio_id ?? null,
      numero_unidad: datos.numero_unidad ?? null,
      direccion_propia: datos.direccion_propia ?? null,
      metros_cuadrados: datos.metros_cuadrados,
      metros_construidos: datos.metros_construidos ?? null,
      ambientes: datos.ambientes ?? null,
      antiguedad_anios: datos.antiguedad_anios ?? null,
      cocheras: datos.cocheras ?? null,
      precio: datos.precio,
      moneda: datos.moneda,
      estado: datos.estado,
      oferta: datos.oferta ?? false,
      precio_oferta: datos.precio_oferta ?? null,
      destacado: datos.destacado ?? false,
      responsable_id,
      descripcion: datos.descripcion ?? null,
      extras: datos.extras ?? null,
    };

    if (shouldCreate) {
      const created = await this.pb.collection('unidades').create<UnidadesResponse>(payload);
      await this.pb.collection('importacion_filas').update(fila.id, {
        aplicada: true,
        registro_creado_id: created.id,
      });
    } else if (shouldUpdate && fila.registro_existente_id) {
      await this.pb.collection('unidades').update(fila.registro_existente_id, payload);
      await this.pb.collection('importacion_filas').update(fila.id, { aplicada: true });
    }
  }
}

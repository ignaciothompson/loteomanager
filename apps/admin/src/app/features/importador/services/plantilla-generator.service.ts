import { Injectable, inject } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { DefinicionesCacheService } from '@loteomanager/shared-pb-client';
import type { ExtrasDefinicion, EstadoDefinicion } from '@loteomanager/shared-types';
import { COLUMNAS_BARRIO, COLUMNAS_UNIDAD } from '../parser/types';

// ── Constants ────────────────────────────────────────────────────────────────

const HARDCODED_ESTADOS = [
  'disponible',
  'bloqueado',
  'reservado',
  'sena',
  'vendido',
  'escriturado',
] as const;

const NUMERIC_UNIDAD_FIELDS = new Set([
  'metros_cuadrados',
  'metros_construidos',
  'ambientes',
  'antiguedad_anios',
  'cocheras',
  'precio',
  'precio_oferta',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses the `opciones` field of an ExtrasDefinicion into a flat string array.
 * Handles: string[] | comma-separated string | Array<{ value: unknown }> | mixed.
 */
function parseOpciones(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return (raw as unknown[])
      .map((o): string => {
        if (typeof o === 'string') return o;
        if (typeof o === 'object' && o !== null && 'value' in o) {
          return String((o as { value: unknown }).value);
        }
        return String(o);
      })
      .filter(s => s.trim() !== '');
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '');
  }
  return [];
}

/** Returns a contextual example value for an extra field based on its tipo. */
function exampleValueForExtra(extra: ExtrasDefinicion): string | number {
  switch (extra.tipo) {
    case 'texto':
      return 'ejemplo texto';
    case 'numero':
      return 42;
    case 'opciones': {
      const opts = parseOpciones(extra.opciones);
      return opts.length > 0 ? opts[0] : 'opcion1';
    }
    case 'booleano':
      return 'si';
    case 'fecha':
      return new Date().toISOString().split('T')[0];
    default:
      return '';
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PlantillaGeneratorService {
  private readonly definicionesCache = inject(DefinicionesCacheService);

  /**
   * Generates and triggers the download of an Excel (.xlsx) import template.
   * Loads definition signals first if they are empty.
   */
  async generarYDescargar(): Promise<void> {
    // Ensure definitions are loaded before building the template
    if (
      this.definicionesCache.extras().length === 0 &&
      this.definicionesCache.estados().length === 0
    ) {
      try {
        await this.definicionesCache.load();
      } catch (err) {
        console.error('[PlantillaGeneratorService] Error cargando definiciones:', err);
      }
    }

    const extrasBarrios = this.definicionesCache.extrasActivosPara('barrios');
    const extrasUnidades = this.definicionesCache.extrasActivosPara('unidades');
    const estadosUnidad = this.definicionesCache.estadosActivosPara('unidades');

    console.info('[PlantillaGeneratorService] Generando plantilla…', {
      extrasBarrios: extrasBarrios.length,
      extrasUnidades: extrasUnidades.length,
      estadosUnidad: estadosUnidad.length,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LoteoManager';
    workbook.created = new Date();

    this.buildDatosSheet(workbook, extrasBarrios, extrasUnidades, estadosUnidad);
    this.buildInstruccionesSheet(workbook, extrasBarrios, extrasUnidades);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla-importador-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.info('[PlantillaGeneratorService] Plantilla descargada.');
  }

  // ── Sheet 1: Datos ─────────────────────────────────────────────────────────

  private buildDatosSheet(
    workbook: ExcelJS.Workbook,
    extrasBarrios: ExtrasDefinicion[],
    extrasUnidades: ExtrasDefinicion[],
    estadosUnidad: EstadoDefinicion[]
  ): void {
    const sheet = workbook.addWorksheet('Datos');

    interface ColSpec {
      header: string;
      key: string;
      width: number;
    }

    const cols: ColSpec[] = [];
    // Maps a column key → 1-based column index for efficient dropdown targeting
    const colByKey = new Map<string, number>();

    const addCol = (spec: ColSpec): void => {
      colByKey.set(spec.key, cols.length + 1);
      cols.push(spec);
    };

    // ── Column definitions (order follows spec) ────────────────────────────

    addCol({ header: 'tipo', key: 'tipo', width: 12 });
    addCol({ header: 'codigo_interno', key: 'codigo_interno', width: 18 });

    // Barrio columns (preserves object key order; codigo_interno excluded)
    const barrioFields = Object.keys(COLUMNAS_BARRIO).filter(k => k !== 'codigo_interno');
    for (const field of barrioFields) {
      const width =
        field === 'descripcion' ? 35 : field === 'lat' || field === 'lng' ? 15 : 20;
      addCol({ header: field, key: `b_${field}`, width });
    }

    // Unidad columns (preserves object key order; codigo_interno excluded)
    const unidadFields = Object.keys(COLUMNAS_UNIDAD).filter(k => k !== 'codigo_interno');
    for (const field of unidadFields) {
      const width =
        field === 'descripcion' ? 35 : NUMERIC_UNIDAD_FIELDS.has(field) ? 15 : 20;
      addCol({ header: field, key: `u_${field}`, width });
    }

    // Extra columns: barrios first, then unidades
    for (const extra of extrasBarrios) {
      addCol({ header: `Extra: ${extra.nombre}`, key: `xb_${extra.id}`, width: 22 });
    }
    for (const extra of extrasUnidades) {
      addCol({ header: `Extra: ${extra.nombre}`, key: `xu_${extra.id}`, width: 22 });
    }

    // ExcelJS accepts Partial<Column>[] for the columns setter
    sheet.columns = cols as Partial<ExcelJS.Column>[];

    // ── Row 1: Header styling ──────────────────────────────────────────────

    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFB8CCE4' },
      };
      cell.font = { bold: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    headerRow.height = 20;

    // ── Row 2: Barrio example ──────────────────────────────────────────────

    const barrioRow: Record<string, string | number> = {
      tipo: 'barrio',
      codigo_interno: 'B-001',
      b_nombre: 'Barrio Las Palmeras',
      b_slug: 'barrio-las-palmeras',
      b_descripcion: 'Un barrio residencial',
      b_ubicacion_texto: 'Ruta 9 km 12',
      b_lat: -34.5,
      b_lng: -58.3,
      b_zona: 'Norte',
    };
    for (const extra of extrasBarrios) {
      barrioRow[`xb_${extra.id}`] = exampleValueForExtra(extra);
    }
    sheet.addRow(barrioRow);

    // ── Row 3: Unidad example ──────────────────────────────────────────────

    const unidadRow: Record<string, string | number> = {
      tipo: 'unidad',
      codigo_interno: 'L-001',
      u_barrio_codigo_interno: 'B-001',
      u_tipo_unidad: 'lote',
      u_numero_unidad: '42',
      u_metros_cuadrados: 250,
      u_precio: 50000,
      u_moneda: 'USD',
      u_estado: 'disponible',
      u_oferta: 'no',
      u_destacado: 'no',
      u_cocheras: 0,
    };
    for (const extra of extrasUnidades) {
      unidadRow[`xu_${extra.id}`] = exampleValueForExtra(extra);
    }
    sheet.addRow(unidadRow);

    // ── Data validations (rows 2–1000) ─────────────────────────────────────

    const applyDropdown = (key: string, formulae: string[]): void => {
      const col = colByKey.get(key);
      if (col == null) return;
      for (let row = 2; row <= 1000; row++) {
        sheet.getCell(row, col).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae,
        };
      }
    };

    applyDropdown('tipo', ['"barrio,unidad"']);
    applyDropdown('u_tipo_unidad', ['"lote,casa,departamento"']);
    applyDropdown('u_moneda', ['"USD,ARS"']);
    applyDropdown('u_oferta', ['"si,no"']);
    applyDropdown('u_destacado', ['"si,no"']);

    // Merge hardcoded estados with any dynamic ones from DefinicionesCacheService
    const allEstados = [
      ...new Set([...HARDCODED_ESTADOS, ...estadosUnidad.map(e => e.code)]),
    ];
    applyDropdown('u_estado', [`"${allEstados.join(',')}"`]);

    // Extra dropdowns
    for (const extra of extrasBarrios) {
      if (extra.tipo === 'opciones') {
        const opts = parseOpciones(extra.opciones);
        if (opts.length > 0) {
          applyDropdown(`xb_${extra.id}`, [`"${opts.join(',')}"`]);
        }
      } else if (extra.tipo === 'booleano') {
        applyDropdown(`xb_${extra.id}`, ['"si,no"']);
      }
    }
    for (const extra of extrasUnidades) {
      if (extra.tipo === 'opciones') {
        const opts = parseOpciones(extra.opciones);
        if (opts.length > 0) {
          applyDropdown(`xu_${extra.id}`, [`"${opts.join(',')}"`]);
        }
      } else if (extra.tipo === 'booleano') {
        applyDropdown(`xu_${extra.id}`, ['"si,no"']);
      }
    }
  }

  // ── Sheet 2: Instrucciones ─────────────────────────────────────────────────

  private buildInstruccionesSheet(
    workbook: ExcelJS.Workbook,
    extrasBarrios: ExtrasDefinicion[],
    extrasUnidades: ExtrasDefinicion[]
  ): void {
    const sheet = workbook.addWorksheet('Instrucciones');

    const addTitle = (text: string): void => {
      const row = sheet.addRow([text]);
      row.getCell(1).font = { bold: true, size: 14 };
      sheet.mergeCells(row.number, 1, row.number, 3);
      row.height = 24;
    };

    const addSection = (text: string): void => {
      sheet.addRow([]);
      const row = sheet.addRow([text]);
      row.getCell(1).font = { bold: true, size: 12 };
      sheet.mergeCells(row.number, 1, row.number, 3);
      row.height = 20;
    };

    const addItem = (label: string, desc = ''): void => {
      sheet.addRow([label, desc]);
    };

    // ── Title ──────────────────────────────────────────────────────────────

    addTitle('Instrucciones de uso de la plantilla');

    // ── Obligatory columns ─────────────────────────────────────────────────

    addSection('Columnas obligatorias');
    addItem('tipo', 'Tipo de registro: "barrio" o "unidad". Obligatorio en cada fila.');
    addItem(
      'codigo_interno',
      'Código único del registro. Para barrios es referenciado por unidades en el campo barrio_codigo_interno. Para unidades es el identificador único de la unidad.'
    );

    // ── Barrio columns ─────────────────────────────────────────────────────

    addSection('Columnas de barrio');
    addItem('nombre', 'Nombre del barrio (obligatorio).');
    addItem(
      'slug',
      'Identificador URL amigable (ej: barrio-las-palmeras). Se genera automáticamente desde el nombre si se omite.'
    );
    addItem('descripcion', 'Descripción libre del barrio.');
    addItem('ubicacion_texto', 'Descripción textual de la ubicación (ej: Ruta 9 km 12).');
    addItem('lat', 'Latitud geográfica (número decimal, ej: -34.5).');
    addItem('lng', 'Longitud geográfica (número decimal, ej: -58.3).');
    addItem('zona', 'Zona o sector del barrio (ej: Norte, Sur, Centro).');

    // ── Unidad columns ─────────────────────────────────────────────────────

    addSection('Columnas de unidad');
    addItem(
      'barrio_codigo_interno',
      'Código interno del barrio al que pertenece la unidad. Debe coincidir con un barrio del archivo o existente en el sistema.'
    );
    addItem('tipo_unidad', 'Tipo de unidad. Valores válidos: lote, casa, departamento.');
    addItem('numero_unidad', 'Número o identificador de la unidad (ej: 42, A-101).');
    addItem('direccion_propia', 'Dirección particular de la unidad si difiere del barrio.');
    addItem('metros_cuadrados', 'Superficie total en m² (obligatorio).');
    addItem('metros_construidos', 'Superficie construida en m².');
    addItem('ambientes', 'Cantidad de ambientes (número entero).');
    addItem('antiguedad_anios', 'Antigüedad en años (número entero).');
    addItem('cocheras', 'Cantidad de cocheras (número entero).');
    addItem('precio', 'Precio de la unidad (obligatorio).');
    addItem('moneda', 'Moneda del precio. Valores válidos: USD, ARS.');
    addItem(
      'estado',
      'Estado de la unidad. Valores válidos: disponible, bloqueado, reservado, sena, vendido, escriturado (más estados personalizados del sistema).'
    );
    addItem('oferta', 'Indica si está en oferta. Valores válidos: si, no.');
    addItem('precio_oferta', 'Precio especial de oferta (número).');
    addItem('destacado', 'Indica si la unidad está destacada. Valores válidos: si, no.');
    addItem(
      'responsable_email',
      'Email del usuario responsable de la unidad. Debe existir en el sistema.'
    );
    addItem('descripcion', 'Descripción libre de la unidad.');

    // ── Extra columns ──────────────────────────────────────────────────────

    if (extrasBarrios.length > 0 || extrasUnidades.length > 0) {
      addSection('Columnas de extras');
      addItem(
        'Formato: "Extra: <nombre del extra>"',
        'Rellene según el tipo de dato requerido. Las columnas de extras de barrio solo aplican a filas "barrio"; las de unidad solo a filas "unidad".'
      );
      for (const extra of extrasBarrios) {
        addItem(
          `Extra: ${extra.nombre}`,
          `(barrio) Tipo: ${extra.tipo}${extra.descripcion ? ' — ' + extra.descripcion : ''}`
        );
      }
      for (const extra of extrasUnidades) {
        addItem(
          `Extra: ${extra.nombre}`,
          `(unidad) Tipo: ${extra.tipo}${extra.descripcion ? ' — ' + extra.descripcion : ''}`
        );
      }
    }

    // ── Important notes ────────────────────────────────────────────────────

    addSection('Notas importantes');
    addItem('• El archivo debe tener extensión .xlsx (formato Excel moderno).');
    addItem('• Tamaño máximo de archivo: 10 MB.');
    addItem('• No modificar los encabezados de la fila 1.');
    addItem('• Las filas de ejemplo (2 y 3) pueden eliminarse o reemplazarse con datos reales.');
    addItem('• Cada fila debe tener "tipo" (barrio o unidad) y "codigo_interno" completos.');

    // Column widths for readability
    sheet.getColumn(1).width = 38;
    sheet.getColumn(2).width = 65;
  }
}

import { Injectable, inject } from '@angular/core';
import * as ExcelJS from 'exceljs';
import {
  BarriosService,
  DepartamentosService,
  UnidadesService,
  VendedorAccesoService,
  ZonasService,
} from '@loteomanager/shared-pb-client';
import type { BarriosResponse, UnidadesResponse } from '@loteomanager/shared-types';
import { COLUMNAS_LOTES } from '../../importador/parser/types';

export type ExportadorBarrioOpt = { label: string; value: string };

@Injectable({ providedIn: 'root' })
export class ExportadorService {
  private barriosSvc = inject(BarriosService);
  private unidadesSvc = inject(UnidadesService);
  private zonasSvc = inject(ZonasService);
  private departamentosSvc = inject(DepartamentosService);
  private vendedorAcceso = inject(VendedorAccesoService);

  /** Barrios accesibles para el usuario actual (admin: todos). */
  async listarBarriosAccesibles(): Promise<BarriosResponse[]> {
    const { barrioIds } = this.vendedorAcceso.resolveBarrioIds();
    return this.barriosSvc.listVisibles(barrioIds);
  }

  /**
   * Excel formato plantilla v3 (1 hoja por barrio) — mismo layout que el importador.
   * Ciclo: exportar → editar → reimportar.
   */
  async exportarExcel(barrioIds: string[]): Promise<void> {
    if (!barrioIds.length) {
      throw new Error('Seleccioná al menos un barrio para exportar.');
    }

    const accesibles = await this.listarBarriosAccesibles();
    const idsSet = new Set(barrioIds);
    const barrios = accesibles
      .filter((b) => idsSet.has(b.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (!barrios.length) {
      throw new Error('No hay barrios accesibles para exportar.');
    }

    const zonaIds = [...new Set(barrios.map((b) => b.zona_id).filter(Boolean))];
    const zonas = zonaIds.length
      ? await this.zonasSvc.listAsync(zonaIds.map((id) => `id="${id}"`).join(' || '))
      : [];
    const zonaMap = new Map(zonas.map((z) => [z.id, z]));

    const deptoIds = [...new Set(zonas.map((z) => z.departamento_id).filter(Boolean))];
    const deptos = deptoIds.length
      ? await this.departamentosSvc.listAsync(deptoIds.map((id) => `id="${id}"`).join(' || '))
      : [];
    const deptoMap = new Map(deptos.map((d) => [d.id, d.nombre]));

    const unidades = await this.unidadesSvc.listByBarrios(
      barrios.map((b) => b.id),
      undefined,
      { sort: 'codigo' },
    );
    const unidadesPorBarrio = new Map<string, UnidadesResponse[]>();
    for (const u of unidades) {
      if (!u.barrio_id) continue;
      const list = unidadesPorBarrio.get(u.barrio_id) ?? [];
      list.push(u);
      unidadesPorBarrio.set(u.barrio_id, list);
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'LoteoManager';
    wb.created = new Date();

    this.buildInstrucciones(wb.addWorksheet('Instrucciones'));

    const usedNames = new Set<string>(['instrucciones']);
    for (const barrio of barrios) {
      const zona = zonaMap.get(barrio.zona_id);
      const deptoNombre = zona ? (deptoMap.get(zona.departamento_id) ?? '') : '';
      const lotes = unidadesPorBarrio.get(barrio.id) ?? [];
      const sheetName = uniqueSheetName(barrio.nombre, usedNames);
      this.buildHojaBarrio(wb, {
        sheetName,
        nombre: barrio.nombre,
        departamento: deptoNombre,
        zona: zona?.nombre ?? '',
        tipos_unidad: barrio.tipos_unidad?.length ? barrio.tipos_unidad : ['lote_vacio'],
        descripcion: stripHtml(barrio.descripcion ?? ''),
        ubicacion_texto: barrio.ubicacion_texto ?? '',
        lotes,
      });
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fecha = new Date().toISOString().slice(0, 10);
    a.download = `export-barrios-lotes-${fecha}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private buildHojaBarrio(
    wb: ExcelJS.Workbook,
    opts: {
      sheetName: string;
      nombre: string;
      departamento: string;
      zona: string;
      tipos_unidad: string[];
      descripcion: string;
      ubicacion_texto: string;
      lotes: UnidadesResponse[];
    },
  ): void {
    const sheet = wb.addWorksheet(opts.sheetName, {
      views: [{ state: 'frozen', ySplit: 15 }],
    });

    sheet.getColumn(1).width = 28;
    sheet.getColumn(2).width = 28;
    sheet.getColumn(3).width = 16;
    sheet.getColumn(4).width = 14;
    sheet.getColumn(5).width = 14;
    sheet.getColumn(6).width = 16;

    sheet.getCell('A1').value = 'LOTEOMANAGER · IMPORTACIÓN DE BARRIO';
    sheet.getCell('A1').font = { bold: true, size: 12 };
    sheet.getCell('F1').value = 'fmt v3';
    sheet.getCell('F1').font = { color: { argb: 'FF888888' }, italic: true };
    sheet.getCell('F1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };

    const { monedaDefault, estadoDefault } = inferDefaults(opts.lotes);

    const fillCabezal: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EEF5' },
    };
    const cabezal: [number, string, string][] = [
      [3, 'Nombre del barrio', opts.nombre],
      [4, 'Departamento', opts.departamento],
      [5, 'Zona', opts.zona],
      [6, 'Tipos de unidad', opts.tipos_unidad.join(', ')],
      [7, 'Descripción', opts.descripcion],
      [8, 'Ubicación (texto)', opts.ubicacion_texto],
    ];
    for (const [row, label, value] of cabezal) {
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`A${row}`).font = { bold: true };
      sheet.getCell(`A${row}`).fill = fillCabezal;
      sheet.getCell(`B${row}`).value = value;
      sheet.getCell(`B${row}`).fill = fillCabezal;
    }

    sheet.getCell('A10').value = '── Valores por defecto de los lotes ──';
    sheet.getCell('A10').font = { bold: true, italic: true };
    sheet.getCell('A11').value = 'Moneda por defecto';
    sheet.getCell('A11').font = { bold: true };
    sheet.getCell('A11').fill = fillCabezal;
    sheet.getCell('B11').value = monedaDefault;
    sheet.getCell('B11').fill = fillCabezal;
    sheet.getCell('A12').value = 'Estado por defecto';
    sheet.getCell('A12').font = { bold: true };
    sheet.getCell('A12').fill = fillCabezal;
    sheet.getCell('B12').value = estadoDefault;
    sheet.getCell('B12').fill = fillCabezal;

    sheet.getCell('A14').value = 'LOTES';
    sheet.getCell('A14').font = { bold: true };

    COLUMNAS_LOTES.forEach((h, i) => {
      const cell = sheet.getCell(15, i + 1);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD1FAE5' },
      };
    });

    for (const u of opts.lotes) {
      const m2 = u.metros_cuadrados ?? u.area_m2 ?? '';
      sheet.addRow([
        u.codigo ?? '',
        m2,
        u.precio ?? '',
        u.moneda ?? '',
        u.estado ?? '',
        u.orientacion ?? '',
      ]);
    }
  }

  private buildInstrucciones(sheet: ExcelJS.Worksheet): void {
    sheet.getColumn(1).width = 28;
    sheet.getColumn(2).width = 78;
    const rows: [string, string][] = [
      [
        'Exportación v3',
        'Una hoja por barrio (mismo formato que la plantilla de importación). Esta hoja Instrucciones se ignora al importar.',
      ],
      [
        'Cabezal',
        'Las etiquetas de la columna A (Nombre del barrio, Departamento, Zona…) se leen por texto. Podés editar y reimportar.',
      ],
      [
        'Lotes',
        'Columnas: numero_lote, metros_cuadrados, precio, moneda, estado, orientacion. Moneda: USD o UYU.',
      ],
      ['fmt v3', 'No borres la celda "fmt v3" de la fila 1.'],
    ];
    rows.forEach((r, i) => {
      const row = sheet.getRow(i + 1);
      row.getCell(1).value = r[0];
      row.getCell(1).font = { bold: true };
      row.getCell(2).value = r[1];
    });
  }
}

function inferDefaults(lotes: UnidadesResponse[]): {
  monedaDefault: string;
  estadoDefault: string;
} {
  if (!lotes.length) {
    return { monedaDefault: 'USD', estadoDefault: 'disponible' };
  }
  return {
    monedaDefault: modeOf(lotes.map((u) => String(u.moneda || '')).filter(Boolean)) || 'USD',
    estadoDefault:
      modeOf(lotes.map((u) => String(u.estado || '')).filter(Boolean)) || 'disponible',
  };
}

function modeOf(values: string[]): string | null {
  if (!values.length) return null;
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = values[0];
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

function sheetNameSafe(nombre: string): string {
  const cleaned = nombre.replace(/[:\\/?*[\]]/g, ' ').trim();
  return (cleaned || 'Barrio').slice(0, 31);
}

function uniqueSheetName(nombre: string, used: Set<string>): string {
  let base = sheetNameSafe(nombre);
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${i})`;
    candidate = (base.slice(0, 31 - suffix.length) + suffix).slice(0, 31);
    i++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

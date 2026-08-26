import { Injectable, inject } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { DefinicionesCacheService } from '@loteomanager/shared-pb-client';
import { COLUMNAS_LOTES } from '../parser/types';

export interface BarrioPlantillaOpts {
  nombre: string;
  departamento: string;
  zona: string;
  tipos_unidad?: string[];
  descripcion?: string;
  ubicacion_texto?: string;
}

@Injectable({ providedIn: 'root' })
export class PlantillaService {
  private definicionesCache = inject(DefinicionesCacheService);

  async generarYDescargar(opciones?: { barrio?: BarrioPlantillaOpts }): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'LoteoManager';
    wb.created = new Date();

    this.buildInstrucciones(wb.addWorksheet('Instrucciones'));

    const estados = this.estadoList();
    if (opciones?.barrio) {
      this.buildHojaBarrio(wb, opciones.barrio, estados, { protegerCabezal: true, ejemplos: false });
    } else {
      this.buildHojaBarrio(
        wb,
        {
          nombre: 'Las Acacias',
          departamento: 'Montevideo',
          zona: 'Pocitos',
          tipos_unidad: ['lote_vacio'],
          descripcion: 'Barrio cerrado de 40 lotes',
          ubicacion_texto: 'Av. Italia 4500',
        },
        estados,
        { protegerCabezal: false, ejemplos: true }
      );
      this.buildHojaBarrio(
        wb,
        {
          nombre: 'El Roble',
          departamento: 'Montevideo',
          zona: 'Carrasco',
          tipos_unidad: ['lote_vacio'],
          descripcion: 'Residencial de ejemplo — copiá esta hoja para otro barrio',
        },
        estados,
        { protegerCabezal: false, ejemplos: true, sheetName: 'El Roble' }
      );
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = opciones?.barrio
      ? `plantilla-lotes-${slugFile(opciones.barrio.nombre)}.xlsx`
      : 'plantilla-importacion-barrios-lotes.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  private estadoList(): string[] {
    const estados = this.definicionesCache
      .estadosActivosPara('unidades')
      .map((e) => e.code)
      .filter(Boolean);
    return estados.length ? estados : ['disponible', 'bloqueado', 'reservado'];
  }

  private buildHojaBarrio(
    wb: ExcelJS.Workbook,
    barrio: BarrioPlantillaOpts,
    estados: string[],
    opts: { protegerCabezal: boolean; ejemplos: boolean; sheetName?: string }
  ): void {
    const name = sheetNameSafe(opts.sheetName ?? barrio.nombre);
    const sheet = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 15 }] });

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

    const cabezal: [number, string, string][] = [
      [3, 'Nombre del barrio', barrio.nombre],
      [4, 'Departamento', barrio.departamento],
      [5, 'Zona', barrio.zona],
      [6, 'Tipos de unidad', (barrio.tipos_unidad ?? ['lote_vacio']).join(', ')],
      [7, 'Descripción', barrio.descripcion ?? ''],
      [8, 'Ubicación (texto)', barrio.ubicacion_texto ?? ''],
    ];
    const fillCabezal: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EEF5' },
    };
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
    sheet.getCell('B11').value = 'USD';
    sheet.getCell('B11').fill = fillCabezal;
    sheet.getCell('A12').value = 'Estado por defecto';
    sheet.getCell('A12').font = { bold: true };
    sheet.getCell('A12').fill = fillCabezal;
    sheet.getCell('B12').value = 'disponible';
    sheet.getCell('B12').fill = fillCabezal;

    this.applyListValidation(sheet, 'B11', '"USD,UYU"');
    this.applyListValidation(sheet, 'B12', `"${estados.join(',')}"`);

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

    if (opts.ejemplos) {
      sheet.addRow(['L-001', 300, 45000, '', '', '']);
      sheet.addRow(['L-002', 320, 48000, '', '', 'Norte']);
    }

    const monedaCol = 'D';
    const estadoCol = 'E';
    for (let row = 16; row <= 515; row++) {
      sheet.getCell(`${monedaCol}${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"USD,UYU"'],
      };
      sheet.getCell(`${estadoCol}${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${estados.join(',')}"`],
      };
      if (opts.protegerCabezal) {
        for (let c = 1; c <= 6; c++) {
          sheet.getCell(row, c).protection = { locked: false };
        }
      }
    }

    if (opts.protegerCabezal) {
      for (let r = 1; r <= 15; r++) {
        sheet.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
          cell.protection = { locked: true };
        });
      }
      void sheet.protect('', {
        selectLockedCells: true,
        selectUnlockedCells: true,
      });
    }
  }

  private applyListValidation(sheet: ExcelJS.Worksheet, addr: string, formulae: string): void {
    sheet.getCell(addr).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [formulae],
    };
  }

  private buildInstrucciones(sheet: ExcelJS.Worksheet): void {
    sheet.getColumn(1).width = 28;
    sheet.getColumn(2).width = 78;
    const rows: [string, string][] = [
      ['Plantilla v3', 'Una hoja por barrio. Esta hoja Instrucciones se ignora al importar.'],
      ['Cabezal', 'Las etiquetas de la columna A (Nombre del barrio, Departamento, Zona…) se leen por texto, no por número de fila. Podés insertar filas sin romper nada.'],
      ['Hojas', 'Copiá una hoja de barrio y cambiá el cabezal para agregar otro barrio al mismo archivo.'],
      ['Valores por defecto', 'Moneda y estado del cabezal se aplican a las filas de lote que dejen esas celdas vacías.'],
      ['Departamento y Zona', 'Tienen que existir en el sistema. El importador te pide confirmar el mapeo; nunca crea una zona sola.'],
      ['Lotes', 'Columnas: numero_lote, metros_cuadrados, precio, moneda, estado, orientacion. Moneda: USD o UYU.'],
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

function sheetNameSafe(nombre: string): string {
  const cleaned = nombre.replace(/[:\\/?*[\]]/g, ' ').trim();
  return (cleaned || 'Barrio').slice(0, 31);
}

function slugFile(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'barrio';
}

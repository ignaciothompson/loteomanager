import { Injectable, inject } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { DefinicionesCacheService } from '@loteomanager/shared-pb-client';
import { COLUMNAS_EXCEL } from '../parser/types';

@Injectable({ providedIn: 'root' })
export class PlantillaService {
  private definicionesCache = inject(DefinicionesCacheService);

  async generarYDescargar(): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'LoteoManager';
    wb.created = new Date();

    const datos = wb.addWorksheet('Datos', { views: [{ state: 'frozen', ySplit: 1 }] });
    const instrucciones = wb.addWorksheet('Instrucciones');

    datos.columns = COLUMNAS_EXCEL.map((key) => ({
      header: key,
      key,
      width: key === 'descripcion' ? 28 : 16,
    }));

    datos.addRow({
      tipo: 'barrio',
      codigo: 'B001',
      nombre: 'Barrio Las Acacias',
      slug: 'barrio-las-acacias',
      zona: 'Pocitos',
      descripcion: 'Ejemplo barrio',
      codigo_barrio: '',
      numero_lote: '',
      metros_cuadrados: '',
      precio: '',
      moneda: '',
      estado: '',
      orientacion: '',
    });

    datos.addRow({
      tipo: 'unidad',
      codigo: '',
      nombre: '',
      slug: '',
      zona: '',
      descripcion: '',
      codigo_barrio: 'B001',
      numero_lote: 'L-001',
      metros_cuadrados: 300,
      precio: 45000,
      moneda: 'USD',
      estado: 'disponible',
      orientacion: 'Norte',
    });

    const headerRow = datos.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EEF5' },
    };

    this.applyDropdown(datos, 'tipo', '"barrio,unidad"');
    this.applyDropdown(datos, 'moneda', '"USD,ARS"');

    const estados = this.definicionesCache
      .estadosActivosPara('unidades')
      .map((e) => e.code)
      .filter(Boolean);
    const estadoList = estados.length ? estados.join(',') : 'disponible,bloqueado,reservado';
    this.applyDropdown(datos, 'estado', `"${estadoList}"`);

    this.buildInstrucciones(instrucciones);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-importacion-barrios-lotes.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  private applyDropdown(sheet: ExcelJS.Worksheet, columnKey: string, formulae: string): void {
    const colIdx = COLUMNAS_EXCEL.indexOf(columnKey as (typeof COLUMNAS_EXCEL)[number]) + 1;
    if (colIdx <= 0) return;
    const colLetter = sheet.getColumn(colIdx).letter;
    for (let row = 2; row <= 500; row++) {
      sheet.getCell(`${colLetter}${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formulae],
      };
    }
  }

  private buildInstrucciones(sheet: ExcelJS.Worksheet): void {
    sheet.getColumn(1).width = 22;
    sheet.getColumn(2).width = 70;
    const rows: [string, string][] = [
      ['Columna', 'Descripción'],
      ['tipo', 'barrio o unidad'],
      ['codigo', 'Clave interna del barrio en el archivo (solo filas barrio)'],
      ['nombre', 'Nombre del barrio (obligatorio en filas barrio)'],
      ['slug', 'Opcional. Si falta se genera desde nombre'],
      ['zona', 'Texto libre. Si no existe se crea bajo departamento Todo'],
      ['descripcion', 'Opcional'],
      ['codigo_barrio', 'Debe coincidir con codigo de una fila barrio (filas unidad)'],
      ['numero_lote', 'Código del lote → unidades.codigo (obligatorio)'],
      ['metros_cuadrados', 'Área del lote (obligatorio)'],
      ['precio', 'Precio (obligatorio)'],
      ['moneda', 'USD o ARS. Default USD'],
      ['estado', 'Code de estado. Default disponible'],
      ['orientacion', 'Opcional'],
      ['', ''],
      ['Errores comunes', ''],
      ['codigo_barrio inválido', 'No hay fila barrio con ese codigo en el mismo archivo'],
      ['Barrio duplicado', 'Slug ya existe en PB — se reutiliza el barrio existente'],
      ['Lote duplicado', 'Mismo numero_lote en barrio existente — se omite por defecto'],
    ];
    rows.forEach((r, i) => {
      const row = sheet.getRow(i + 1);
      row.getCell(1).value = r[0];
      row.getCell(2).value = r[1];
      if (i === 0) row.font = { bold: true };
    });
  }
}

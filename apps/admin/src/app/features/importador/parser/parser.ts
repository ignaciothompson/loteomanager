import * as ExcelJS from 'exceljs';
import { BarriosService, UnidadesService } from '@loteomanager/shared-pb-client';
import { ImportacionFilasEstadoFilaOptions } from '@loteomanager/shared-types';

export interface ParsedRow {
  numero_fila: number;
  datos_originales: Record<string, any>;
  datos_normalizados: Record<string, any>;
  estado_fila: ImportacionFilasEstadoFilaOptions;
  mensaje?: string;
  registro_existente_id?: string;
}

export async function parseBarriosUnidades(
  file: File, 
  barriosService: BarriosService, 
  unidadesService: UnidadesService
): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const rows: ParsedRow[] = [];

  const processRow = async (row: ExcelJS.Row, tipo: 'barrio' | 'unidad', rowIndex: number) => {
    const data: Record<string, any> = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      // Very basic column name mapping assuming headers are in row 1
      const header = row.worksheet.getRow(1).getCell(colNumber).value?.toString().toLowerCase().trim();
      if (header) {
        data[header] = cell.value;
      }
    });

    if (Object.keys(data).length === 0) return;

    let estado_fila: ImportacionFilasEstadoFilaOptions = 'ok';
    let mensaje = '';
    let registro_existente_id = undefined;
    const normalizados: Record<string, any> = { ...data };

    if (tipo === 'barrio') {
      if (!data['slug'] || !data['nombre']) {
        estado_fila = 'error';
        mensaje = 'Faltan campos requeridos: slug y nombre';
      } else {
        try {
          const existing = await barriosService.listAsync(`slug = '${data['slug']}'`);
          if (existing && existing.length > 0) {
            estado_fila = 'duplicado';
            registro_existente_id = existing[0].id;
            mensaje = 'El barrio ya existe';
          }
        } catch (e) {
          // ignore
        }
      }
    } else {
      if (!data['codigo_interno'] || !data['metros_cuadrados'] || !data['precio'] || !data['moneda']) {
        estado_fila = 'error';
        mensaje = 'Faltan campos requeridos (codigo_interno, metros_cuadrados, precio, moneda)';
      } else {
        try {
          const existing = await unidadesService.listAsync(`codigo_interno = '${data['codigo_interno']}'`);
          if (existing && existing.length > 0) {
            estado_fila = 'duplicado';
            registro_existente_id = existing[0].id;
            mensaje = 'La unidad ya existe';
          }
        } catch (e) {
          // ignore
        }
      }
    }

    rows.push({
      numero_fila: rowIndex,
      datos_originales: data,
      datos_normalizados: normalizados,
      estado_fila,
      mensaje,
      registro_existente_id
    });
  };

  // Formato 2: Dos hojas separadas (Barrios, Unidades)
  const barriosSheet = workbook.getWorksheet('Barrios');
  const unidadesSheet = workbook.getWorksheet('Unidades');

  if (barriosSheet || unidadesSheet) {
    if (barriosSheet) {
      for (let i = 2; i <= barriosSheet.rowCount; i++) {
        await processRow(barriosSheet.getRow(i), 'barrio', i);
      }
    }
    if (unidadesSheet) {
      for (let i = 2; i <= unidadesSheet.rowCount; i++) {
        await processRow(unidadesSheet.getRow(i), 'unidad', i);
      }
    }
  } else {
    // Formato 1: Una sola hoja
    const sheet = workbook.worksheets[0];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const tipoCell = row.getCell(1).value?.toString().toLowerCase(); // Assume column 1 is 'tipo'
      if (tipoCell === 'barrio' || tipoCell === 'unidad') {
         await processRow(row, tipoCell as 'barrio' | 'unidad', i);
      }
    }
  }

  return rows;
}

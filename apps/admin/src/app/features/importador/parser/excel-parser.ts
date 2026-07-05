import * as ExcelJS from 'exceljs';
import { COLUMNAS_REQUERIDAS, type RawRow } from './types';

export async function parseExcelFile(file: File): Promise<{ headers: string[]; rows: RawRow[] }> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error(
      `El archivo supera el límite de 10 MB (tamaño: ${(file.size / 1024 / 1024).toFixed(1)} MB).`
    );
  }

  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.getWorksheet('Datos') ?? workbook.worksheets[0];
  if (!sheet) throw new Error('El archivo no contiene hojas de datos.');

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  const colIndexMap = new Map<number, string>();

  headerRow.eachCell({ includeEmpty: false }, (cell, colIdx) => {
    const h = cell.value?.toString().trim() ?? '';
    if (h) {
      headers.push(h);
      colIndexMap.set(colIdx, h);
    }
  });

  const headerLower = new Set(headers.map((h) => h.toLowerCase().trim()));
  const faltantes = COLUMNAS_REQUERIDAS.filter((c) => !headerLower.has(c));
  if (faltantes.length) {
    throw new Error(
      `Faltan columnas obligatorias en la hoja Datos: ${faltantes.join(', ')}.`
    );
  }

  const rows: RawRow[] = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const data: Record<string, unknown> = {};
    let hasData = false;

    row.eachCell({ includeEmpty: true }, (cell, colIdx) => {
      const header = colIndexMap.get(colIdx);
      if (!header) return;
      const val = getCellValue(cell);
      data[header] = val;
      if (val !== null && val !== undefined && val !== '') hasData = true;
    });

    if (hasData) {
      rows.push({ numero_fila: i, data: normalizeRowKeys(data, headers) });
    }
  }

  return { headers, rows };
}

function normalizeRowKeys(
  data: Record<string, unknown>,
  headers: string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const h of headers) {
    const key = h.toLowerCase().trim();
    out[key] = data[h] ?? data[key];
  }
  return out;
}

function getCellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && 'result' in v) return (v as ExcelJS.CellFormulaValue).result;
  if (typeof v === 'object' && 'richText' in v) {
    return (v as ExcelJS.CellRichTextValue).richText
      .map((rt: { text?: string }) => rt.text ?? '')
      .join('');
  }
  if (typeof v === 'object' && 'text' in v) return (v as ExcelJS.CellHyperlinkValue).text;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return v;
}



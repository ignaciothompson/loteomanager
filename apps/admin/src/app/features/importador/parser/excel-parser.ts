import * as ExcelJS from 'exceljs';
import { ExtrasDefinicion } from '@loteomanager/shared-types';
import { AnalisisColumnas, COLUMNAS_CONOCIDAS_ALL } from './types';

export interface RawRow {
  numero_fila: number; // 1-based data row index (header = row 1, first data = 1)
  data: Record<string, unknown>;
}

/** Normalizes a string for fuzzy matching: lowercase, no accents, trimmed spaces. */
export function normalizeStr(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Parses the Excel file. Returns headers and raw data rows.
 * Throws if >10MB or missing required columns.
 */
export async function parseExcelFile(
  file: File,
  extrasDefiniciones: ExtrasDefinicion[],
  mapeoColumnasExistente?: Record<string, string | null>,
  mapeoExtrasExistente?: Record<string, string | null>
): Promise<{ headers: string[]; rows: RawRow[]; analisis: AnalisisColumnas }> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error(
      `El archivo supera el límite de 10 MB (tamaño: ${(file.size / 1024 / 1024).toFixed(1)} MB). Por favor reducí el tamaño del archivo.`
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

  const headerLower = headers.map(h => h.toLowerCase());
  if (!headerLower.includes('tipo')) {
    throw new Error('La columna "tipo" es obligatoria y no se encontró en el archivo.');
  }
  if (!headerLower.includes('codigo_interno')) {
    throw new Error('La columna "codigo_interno" es obligatoria y no se encontró en el archivo.');
  }

  const analisis = analyzeColumns(
    headers,
    extrasDefiniciones,
    mapeoColumnasExistente,
    mapeoExtrasExistente
  );

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
      rows.push({ numero_fila: i - 1, data });
    }
  }

  return { headers, rows, analisis };
}

function getCellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && 'result' in v) return (v as ExcelJS.CellFormulaValue).result;
  // CellRichTextValue: join all richText segments
  if (typeof v === 'object' && 'richText' in v) {
    return (v as ExcelJS.CellRichTextValue).richText
      .map((rt: { text?: string }) => rt.text ?? '')
      .join('');
  }
  // CellHyperlinkValue: use display text
  if (typeof v === 'object' && 'text' in v) return (v as ExcelJS.CellHyperlinkValue).text;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return v;
}

function analyzeColumns(
  headers: string[],
  extrasDefiniciones: ExtrasDefinicion[],
  mapeoColumnasExistente?: Record<string, string | null>,
  mapeoExtrasExistente?: Record<string, string | null>
): AnalisisColumnas {
  const columnasConocidas = new Map<string, string>();
  const columnasExtras = new Map<string, string | null>();
  const columnasDesconocidas: string[] = [];

  for (const h of headers) {
    const hLower = h.toLowerCase().trim();

    if (/^extra\s*:/i.test(h)) {
      if (mapeoExtrasExistente && h in mapeoExtrasExistente) {
        columnasExtras.set(h, mapeoExtrasExistente[h]);
        continue;
      }
      const extraName = h.replace(/^extra\s*:\s*/i, '').trim();
      const extraNorm = normalizeStr(extraName);
      const matches = extrasDefiniciones.filter(
        e => e.activo && normalizeStr(e.nombre) === extraNorm
      );
      columnasExtras.set(h, matches.length === 1 ? matches[0].id : null);
      continue;
    }

    if (COLUMNAS_CONOCIDAS_ALL.has(hLower)) {
      columnasConocidas.set(h, hLower);
      continue;
    }

    if (mapeoColumnasExistente && h in mapeoColumnasExistente) {
      const target = mapeoColumnasExistente[h];
      if (target) {
        columnasConocidas.set(h, target);
      } else {
        columnasDesconocidas.push(h);
      }
      continue;
    }

    columnasDesconocidas.push(h);
  }

  return {
    columnasConocidas,
    columnasExtras,
    columnasDesconocidas,
    necesitaMapeoColumnas: columnasDesconocidas.length > 0,
    necesitaMapeoExtras: [...columnasExtras.values()].some(v => v === null),
  };
}

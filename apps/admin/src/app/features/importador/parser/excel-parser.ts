import * as ExcelJS from 'exceljs';
import { ETIQUETAS_CABEZAL, ImportadorFormatoError, type HojaBarrioRaw, type RawLoteRow } from './types';
import { cellStr, normalizeLabel } from './text';

const FMT_RE = /^fmt\s*v(\d+)$/i;
const V2_MSG = 'Este archivo usa la plantilla vieja. Descargá la plantilla nueva.';
const EXPORT_MSG =
  'Este es un archivo del exportador, que usa otro formato. La plantilla de importación arma una hoja por barrio.';
const VACIO_MSG =
  'No encontramos ninguna hoja con lotes. Cada hoja debe tener una fila de encabezados que incluya numero_lote.';

export async function parseWorkbook(
  file: File,
  onProgress?: (msg: string) => void
): Promise<HojaBarrioRaw[]> {
  if (file.size > 10 * 1024 * 1024) {
    throw new ImportadorFormatoError(
      `El archivo supera 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
      'SIZE'
    );
  }

  onProgress?.('Leyendo archivo…');
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheetNames = workbook.worksheets.map((s) => normalizeLabel(s.name));
  const hasBarrios = sheetNames.includes('barrios');
  const hasUnidades = sheetNames.includes('unidades');
  if (hasBarrios && hasUnidades) {
    throw new ImportadorFormatoError(EXPORT_MSG, 'EXPORTADOR');
  }

  const total = workbook.worksheets.length;
  const hojas: HojaBarrioRaw[] = [];
  let i = 0;
  for (const sheet of workbook.worksheets) {
    i++;
    if (total > 1) onProgress?.(`Leyendo hoja ${i} de ${total}…`);
    const parsed = parseHojaBarrio(sheet);
    if (parsed) hojas.push(parsed);
  }

  if (!hojas.length) {
    throw new ImportadorFormatoError(VACIO_MSG, 'VACIO');
  }

  return hojas;
}

function parseHojaBarrio(sheet: ExcelJS.Worksheet): HojaBarrioRaw | null {
  const headerInfo = findLotesHeader(sheet);
  if (!headerInfo) return null;

  const { headerRowIdx, colMap, headersNorm } = headerInfo;

  if (headersNorm.has('tipo') || headersNorm.has('codigo_barrio')) {
    throw new ImportadorFormatoError(V2_MSG, 'V2');
  }

  const fmtVersion = readFmtVersion(sheet);
  if (fmtVersion !== null && fmtVersion < 3) {
    throw new ImportadorFormatoError(V2_MSG, 'V2');
  }

  const cabezal = readCabezal(sheet, headerRowIdx);
  const lotes = readLotes(sheet, headerRowIdx, colMap);

  return {
    nombre_hoja: sheet.name,
    fmt_version: fmtVersion,
    cabezal,
    lotes,
  };
}

function findLotesHeader(sheet: ExcelJS.Worksheet): {
  headerRowIdx: number;
  colMap: Map<number, string>;
  headersNorm: Set<string>;
} | null {
  const maxRow = Math.min(sheet.rowCount || 0, 80);
  for (let r = 1; r <= maxRow; r++) {
    const row = sheet.getRow(r);
    const colMap = new Map<number, string>();
    const headersNorm = new Set<string>();
    let foundNumero = false;
    row.eachCell({ includeEmpty: false }, (cell, colIdx) => {
      const label = normalizeLabel(cellStr(getCellValue(cell)));
      if (!label) return;
      colMap.set(colIdx, label);
      headersNorm.add(label);
      if (label === 'numero_lote') foundNumero = true;
    });
    if (foundNumero) {
      return { headerRowIdx: r, colMap, headersNorm };
    }
  }
  return null;
}

function readFmtVersion(sheet: ExcelJS.Worksheet): number | null {
  const row = sheet.getRow(1);
  let found: number | null = null;
  row.eachCell({ includeEmpty: false }, (cell) => {
    const t = cellStr(getCellValue(cell));
    const m = t.match(FMT_RE);
    if (m) found = Number(m[1]);
  });
  return found;
}

function readCabezal(sheet: ExcelJS.Worksheet, headerRowIdx: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (let r = 1; r < headerRowIdx; r++) {
    const row = sheet.getRow(r);
    const labelRaw = cellStr(getCellValue(row.getCell(1)));
    if (!labelRaw) continue;
    const key = normalizeLabel(labelRaw) as keyof typeof ETIQUETAS_CABEZAL;
    if (!(key in ETIQUETAS_CABEZAL)) continue;
    const campo = ETIQUETAS_CABEZAL[key];
    out[campo] = cellStr(getCellValue(row.getCell(2)));
  }
  return out;
}

function readLotes(
  sheet: ExcelJS.Worksheet,
  headerRowIdx: number,
  colMap: Map<number, string>
): RawLoteRow[] {
  const rows: RawLoteRow[] = [];
  for (let i = headerRowIdx + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const data: Record<string, unknown> = {};
    let hasData = false;
    colMap.forEach((header, colIdx) => {
      const val = getCellValue(row.getCell(colIdx));
      data[header] = val;
      if (val !== null && val !== undefined && val !== '') hasData = true;
    });
    if (hasData) {
      rows.push({ fila_excel: i, data });
    }
  }
  return rows;
}

export function getCellValue(cell: ExcelJS.Cell): unknown {
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

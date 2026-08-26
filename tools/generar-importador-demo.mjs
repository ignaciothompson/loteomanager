/**
 * Genera apps/admin/src/app/features/importador/demos/importador-demo-barrios-lotes.xlsx
 * Uso: node tools/generar-importador-demo.mjs
 */
import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'apps/admin/src/app/features/importador/demos');
const outFile = join(outDir, 'importador-demo-barrios-lotes.xlsx');

function addHoja(wb, barrio) {
  const sheet = wb.addWorksheet(barrio.sheet, { views: [{ state: 'frozen', ySplit: 15 }] });
  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 28;
  sheet.getCell('A1').value = 'LOTEOMANAGER · IMPORTACIÓN DE BARRIO';
  sheet.getCell('F1').value = 'fmt v3';
  const rows = [
    [3, 'Nombre del barrio', barrio.nombre],
    [4, 'Departamento', barrio.departamento],
    [5, 'Zona', barrio.zona],
    [6, 'Tipos de unidad', 'lote_vacio'],
    [7, 'Descripción', barrio.descripcion],
    [8, 'Ubicación (texto)', barrio.ubicacion ?? ''],
    [11, 'Moneda por defecto', 'USD'],
    [12, 'Estado por defecto', 'disponible'],
  ];
  for (const [r, label, value] of rows) {
    sheet.getCell(`A${r}`).value = label;
    sheet.getCell(`B${r}`).value = value;
  }
  sheet.getCell('A10').value = '── Valores por defecto de los lotes ──';
  sheet.getCell('A14').value = 'LOTES';
  const headers = ['numero_lote', 'metros_cuadrados', 'precio', 'moneda', 'estado', 'orientacion'];
  headers.forEach((h, i) => {
    sheet.getCell(15, i + 1).value = h;
  });
  for (const lote of barrio.lotes) {
    sheet.addRow(lote);
  }
}

const wb = new ExcelJS.Workbook();
wb.creator = 'LoteoManager';

const instr = wb.addWorksheet('Instrucciones');
instr.getColumn(1).width = 22;
instr.getColumn(2).width = 72;
instr.addRow(['Archivo demo v3', '3 hojas de barrio + esta de instrucciones (se ignora)']);
instr.addRow(['Valores por defecto', 'Moneda USD / estado disponible si la fila los deja vacíos']);
instr.addRow(['Re-importar', 'Segunda carga → lotes existentes se omiten; el barrio se reutiliza']);

addHoja(wb, {
  sheet: 'Las Acacias',
  nombre: 'Barrio Las Acacias',
  departamento: 'Montevideo',
  zona: 'Pocitos',
  descripcion: 'Demo — barrio norte',
  ubicacion: 'Av. Italia 4500',
  lotes: [
    ['A-001', 320, 52000, '', '', 'Norte'],
    ['A-002', 300, 48500, '', '', 'Norte'],
    ['B-001', 280, 45000, '', 'reservado', 'Este'],
    ['B-002', 295, 47200, '', '', 'Oeste'],
  ],
});

addHoja(wb, {
  sheet: 'El Roble',
  nombre: 'Residencial El Roble',
  departamento: 'Montevideo',
  zona: 'Carrasco',
  descripcion: 'Demo — barrio sur',
  lotes: [
    ['L-101', 400, 68000, '', '', 'Sur'],
    ['L-102', 380, 65000, '', '', 'Noreste'],
    ['L-103', 350, 61000, '', '', 'Noroeste'],
  ],
});

addHoja(wb, {
  sheet: 'Los Pinos',
  nombre: 'Los Pinos',
  departamento: 'Canelones',
  zona: 'Solymar',
  descripcion: 'Tercer barrio de la demo',
  lotes: [
    ['P-01', 250, 39000, '', '', ''],
    ['P-02', 260, 40500, 'UYU', '', 'Este'],
  ],
});

await mkdir(outDir, { recursive: true });
const buffer = await wb.xlsx.writeBuffer();
await writeFile(outFile, buffer);

console.log(`Demo generado: ${outFile}`);

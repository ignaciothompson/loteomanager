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

const HEADERS = [
  'tipo',
  'codigo',
  'nombre',
  'slug',
  'zona',
  'descripcion',
  'codigo_barrio',
  'numero_lote',
  'metros_cuadrados',
  'precio',
  'moneda',
  'estado',
  'orientacion',
];

const ROWS = [
  {
    tipo: 'barrio',
    codigo: 'B001',
    nombre: 'Barrio Las Acacias',
    slug: 'barrio-las-acacias',
    zona: 'Pocitos',
    descripcion: 'Demo — barrio norte, lotes en manzana A y B',
    codigo_barrio: '',
    numero_lote: '',
    metros_cuadrados: '',
    precio: '',
    moneda: '',
    estado: '',
    orientacion: '',
  },
  {
    tipo: 'barrio',
    codigo: 'B002',
    nombre: 'Residencial El Roble',
    slug: 'residencial-el-roble',
    zona: 'Carrasco',
    descripcion: 'Demo — barrio sur, lotes esquina',
    codigo_barrio: '',
    numero_lote: '',
    metros_cuadrados: '',
    precio: '',
    moneda: '',
    estado: '',
    orientacion: '',
  },
  // Las Acacias — 4 lotes
  {
    tipo: 'unidad',
    codigo: '',
    nombre: '',
    slug: '',
    zona: '',
    descripcion: '',
    codigo_barrio: 'B001',
    numero_lote: 'A-001',
    metros_cuadrados: 320,
    precio: 52000,
    moneda: 'USD',
    estado: 'disponible',
    orientacion: 'Norte',
  },
  {
    tipo: 'unidad',
    codigo: '',
    nombre: '',
    slug: '',
    zona: '',
    descripcion: '',
    codigo_barrio: 'B001',
    numero_lote: 'A-002',
    metros_cuadrados: 300,
    precio: 48500,
    moneda: 'USD',
    estado: 'disponible',
    orientacion: 'Norte',
  },
  {
    tipo: 'unidad',
    codigo: '',
    nombre: '',
    slug: '',
    zona: '',
    descripcion: '',
    codigo_barrio: 'B001',
    numero_lote: 'B-001',
    metros_cuadrados: 280,
    precio: 45000,
    moneda: 'USD',
    estado: 'reservado',
    orientacion: 'Este',
  },
  {
    tipo: 'unidad',
    codigo: '',
    nombre: '',
    slug: '',
    zona: '',
    descripcion: '',
    codigo_barrio: 'B001',
    numero_lote: 'B-002',
    metros_cuadrados: 295,
    precio: 47200,
    moneda: 'USD',
    estado: 'disponible',
    orientacion: 'Oeste',
  },
  // El Roble — 3 lotes
  {
    tipo: 'unidad',
    codigo: '',
    nombre: '',
    slug: '',
    zona: '',
    descripcion: '',
    codigo_barrio: 'B002',
    numero_lote: 'L-101',
    metros_cuadrados: 400,
    precio: 68000,
    moneda: 'USD',
    estado: 'disponible',
    orientacion: 'Sur',
  },
  {
    tipo: 'unidad',
    codigo: '',
    nombre: '',
    slug: '',
    zona: '',
    descripcion: '',
    codigo_barrio: 'B002',
    numero_lote: 'L-102',
    metros_cuadrados: 380,
    precio: 65000,
    moneda: 'USD',
    estado: 'disponible',
    orientacion: 'Noreste',
  },
  {
    tipo: 'unidad',
    codigo: '',
    nombre: '',
    slug: '',
    zona: '',
    descripcion: '',
    codigo_barrio: 'B002',
    numero_lote: 'L-103',
    metros_cuadrados: 350,
    precio: 61000,
    moneda: 'ARS',
    estado: 'disponible',
    orientacion: 'Noroeste',
  },
];

const wb = new ExcelJS.Workbook();
wb.creator = 'LoteoManager';
const sheet = wb.addWorksheet('Datos', { views: [{ state: 'frozen', ySplit: 1 }] });

sheet.columns = HEADERS.map((h) => ({ header: h, key: h, width: h === 'descripcion' ? 36 : 16 }));
const headerRow = sheet.getRow(1);
headerRow.font = { bold: true };
headerRow.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE8EEF5' },
};

for (const row of ROWS) {
  sheet.addRow(row);
}

const instr = wb.addWorksheet('Instrucciones');
instr.getColumn(1).width = 22;
instr.getColumn(2).width = 72;
instr.addRow(['Archivo demo', '2 barrios (B001, B002) + 7 lotes vacíos para probar /importador/nueva']);
instr.addRow(['Re-importar', 'Segunda carga → barrios/lotes quedan duplicado/omitir']);
instr.addRow(['Error de prueba', 'Cambiar codigo_barrio a B999 en una fila unidad para ver error de join']);

await mkdir(outDir, { recursive: true });
const buffer = await wb.xlsx.writeBuffer();
await writeFile(outFile, buffer);

console.log(`Demo generado: ${outFile}`);

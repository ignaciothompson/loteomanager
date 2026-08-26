import { describe, expect, it } from 'vitest';
import { inferirPatronCodigo } from './patron-codigo';
import { sugerirNumero, sugerirMoneda, sugerirOrientacion } from './autocorrect';
import { normalizeCompare, levenshtein, normalizeLabel } from './text';
import { buildMapeoGeografia } from './geo-matcher';
import { analyzeHojas } from './analyze';
import type { HojaBarrioRaw } from './types';

describe('inferirPatronCodigo', () => {
  it('reemplaza el bloque final de dígitos por {n}', () => {
    expect(inferirPatronCodigo('L-001')).toBe('L-{n}');
    expect(inferirPatronCodigo('MZ2-14')).toBe('MZ2-{n}');
  });
  it('sin dígitos finales usa {codigo}-{n}', () => {
    expect(inferirPatronCodigo('LOTE')).toBe('LOTE-{n}');
  });
});

describe('sugerirNumero', () => {
  it('parsea coma decimal y miles', () => {
    expect(sugerirNumero('300,5')?.valor).toBe(300.5);
    expect(sugerirNumero('1.250,00')?.valor).toBe(1250);
    expect(sugerirNumero('$ 45.000')?.valor).toBe(45000);
  });
  it('número ya canónico no pide motivo', () => {
    expect(sugerirNumero(300)?.motivo).toBe('');
  });
});

describe('sugerirMoneda', () => {
  it('alias y ARS', () => {
    expect(sugerirMoneda('dolares').sugerido?.valor_sugerido).toBe('USD');
    expect(sugerirMoneda('pesos').sugerido?.valor_sugerido).toBe('UYU');
    expect(sugerirMoneda('ARS').arsConvertida).toBe(true);
    expect(sugerirMoneda('ARS').valor).toBe('USD');
  });
});

describe('sugerirOrientacion', () => {
  it('alias canónicos', () => {
    expect(sugerirOrientacion('N').valor).toBe('Norte');
    expect(sugerirOrientacion('noreste').valor).toBe('Noreste');
  });
});

describe('text helpers', () => {
  it('normaliza etiquetas', () => {
    expect(normalizeLabel('Nombre del barrio')).toBe('nombre_del_barrio');
    expect(normalizeLabel('Ubicación (texto)')).toBe('ubicacion_texto');
    expect(normalizeCompare('Pocitós ')).toBe('pocitos');
    expect(levenshtein('pocitos', 'pocito')).toBe(1);
  });
});

describe('geo matcher', () => {
  it('matchea exacto y agrupa valores repetidos', () => {
    const mapeo = buildMapeoGeografia(
      [
        { departamento: 'Montevideo', zona: 'Pocitos' },
        { departamento: 'Montevideo', zona: 'Pocitos' },
      ],
      {
        departamentos: [{ id: 'd1', nombre: 'Montevideo', slug: 'montevideo' }],
        zonas: [{ id: 'z1', nombre: 'Pocitos', slug: 'pocitos', departamento_id: 'd1' }],
      }
    );
    expect(mapeo.departamentos).toHaveLength(1);
    expect(mapeo.zonas).toHaveLength(1);
    expect(mapeo.departamentos[0].estado).toBe('confirmado');
    expect(mapeo.zonas[0].zona_id).toBe('z1');
  });
});

describe('analyzeHojas', () => {
  const hoja = (nombre: string, lotes: HojaBarrioRaw['lotes']): HojaBarrioRaw => ({
    nombre_hoja: nombre,
    fmt_version: 3,
    cabezal: {
      nombre,
      departamento: 'Montevideo',
      zona: 'Pocitos',
      moneda_default: 'USD',
      estado_default: 'disponible',
    },
    lotes,
  });

  it('hereda moneda del cabezal y resuelve barrio existente', () => {
    const { filas } = analyzeHojas(
      [
        hoja('Las Acacias', [
          { fila_excel: 16, data: { numero_lote: 'L-001', metros_cuadrados: 300, precio: 45000 } },
        ]),
      ],
      {
        existingBarrios: [{ id: 'b1', slug: 'las-acacias', nombre: 'Las Acacias' } as never],
        existingUnidades: [],
        catalog: {
          departamentos: [{ id: 'd1', nombre: 'Montevideo', slug: 'montevideo' }],
          zonas: [{ id: 'z1', nombre: 'Pocitos', slug: 'pocitos', departamento_id: 'd1' }],
        },
        estados: [{ code: 'disponible', nombre: 'Disponible', activo: true } as never],
      }
    );
    const lote = filas.find((f) => f.tipo_fila === 'unidad');
    const barrio = filas.find((f) => f.tipo_fila === 'barrio');
    expect((lote?.datos_normalizados as { moneda: string }).moneda).toBe('USD');
    expect((barrio?.datos_normalizados as { barrio_existente: boolean }).barrio_existente).toBe(true);
    expect(barrio?.registro_existente_id).toBe('b1');
  });

  it('atajo multihoja tira error', () => {
    expect(() =>
      analyzeHojas([hoja('A', []), hoja('B', [])], {
        existingBarrios: [],
        existingUnidades: [],
        catalog: { departamentos: [], zonas: [] },
        estados: [],
        barrioDestino: { id: 'b1', nombre: 'X', slug: 'x' } as never,
      })
    ).toThrow(/varios barrios/);
  });
});

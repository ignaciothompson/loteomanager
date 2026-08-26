import type { EstadoDefinicion } from '@loteomanager/shared-types';
import type { CorreccionSugerida, MonedaImportacion, OrientacionCanon } from './types';
import { ORIENTACIONES_CANONICAS } from './types';
import { cellStr, levenshtein, normalizeCompare } from './text';

const MONEDA_USD = new Set(['usd', 'dolares', 'dolar', 'u$s', 'us$', 'uss']);
const MONEDA_UYU = new Set(['uyu', 'pesos', '$u', 'uy', 'peso', 'pesos uruguayos']);

const ORIENTACION_ALIAS: Record<string, OrientacionCanon> = {
  n: 'Norte',
  norte: 'Norte',
  s: 'Sur',
  sur: 'Sur',
  e: 'Este',
  este: 'Este',
  o: 'Oeste',
  oeste: 'Oeste',
  w: 'Oeste',
  west: 'Oeste',
  ne: 'Noreste',
  noreste: 'Noreste',
  'nor-este': 'Noreste',
  nw: 'Noroeste',
  no: 'Noroeste',
  noroeste: 'Noroeste',
  'nor-oeste': 'Noroeste',
  se: 'Sureste',
  sureste: 'Sureste',
  'sur-este': 'Sureste',
  sudeste: 'Sureste',
  sw: 'Suroeste',
  so: 'Suroeste',
  suroeste: 'Suroeste',
  'sur-oeste': 'Suroeste',
  sudoeste: 'Suroeste',
};

export function sugerirNumero(raw: unknown): { valor: number; sugerido: string; motivo: string } | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { valor: raw, sugerido: String(raw), motivo: '' };
  }
  const s = cellStr(raw);
  if (!s) return null;

  let t = s.replace(/\s/g, '');
  const teniaSimbolo = /[$€]|u\$s|usd|uyu|ars/i.test(t);
  t = t.replace(/usd|uyu|ars|u\$s|us\$/gi, '').replace(/[$€]/g, '');
  if (!t) return null;

  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  let normalized = t;

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = t.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = t.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const after = t.length - lastComma - 1;
    if (after <= 2 && !t.slice(0, lastComma).includes(',')) {
      normalized = t.replace(',', '.');
    } else {
      normalized = t.replace(/,/g, '');
    }
  } else if (lastDot >= 0) {
    const after = t.length - lastDot - 1;
    const groups = t.split('.');
    const thousands = groups.length > 2 || (groups.length === 2 && groups[1].length === 3 && groups[0].length <= 3);
    if (thousands && after === 3) {
      normalized = t.replace(/\./g, '');
    }
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;

  const originalSimple = s.replace(/\s/g, '');
  const alreadyCanonical = originalSimple === String(n) || originalSimple === n.toFixed(1) || originalSimple === n.toFixed(2);
  if (alreadyCanonical && !teniaSimbolo) {
    return { valor: n, sugerido: String(n), motivo: '' };
  }

  const motivo = teniaSimbolo ? 'separadores y símbolos' : 'separadores y símbolos';
  return { valor: n, sugerido: String(n), motivo };
}

export function sugerirMoneda(
  raw: unknown
): { valor: MonedaImportacion; sugerido?: CorreccionSugerida; arsConvertida?: boolean } {
  const s = cellStr(raw);
  if (!s) return { valor: 'USD' };
  const n = normalizeCompare(s).replace(/\s/g, '');
  if (n === 'usd') return { valor: 'USD' };
  if (n === 'uyu') return { valor: 'UYU' };
  if (n === 'ars') {
    return {
      valor: 'USD',
      arsConvertida: true,
      sugerido: {
        campo: 'moneda',
        valor_original: s,
        valor_sugerido: 'USD',
        motivo: 'moneda discontinuada',
      },
    };
  }
  const compact = n.replace(/[^a-z$]/g, '');
  if (MONEDA_USD.has(n) || MONEDA_USD.has(compact)) {
    return {
      valor: 'USD',
      sugerido: { campo: 'moneda', valor_original: s, valor_sugerido: 'USD', motivo: 'moneda' },
    };
  }
  if (MONEDA_UYU.has(n) || MONEDA_UYU.has(compact)) {
    return {
      valor: 'UYU',
      sugerido: { campo: 'moneda', valor_original: s, valor_sugerido: 'UYU', motivo: 'moneda' },
    };
  }
  return { valor: 'USD' };
}

export function monedaEsValida(raw: unknown): boolean {
  const s = cellStr(raw);
  if (!s) return true;
  const n = normalizeCompare(s).replace(/\s/g, '');
  if (n === 'usd' || n === 'uyu' || n === 'ars') return true;
  const compact = n.replace(/[^a-z$]/g, '');
  return MONEDA_USD.has(n) || MONEDA_USD.has(compact) || MONEDA_UYU.has(n) || MONEDA_UYU.has(compact);
}

export function sugerirEstado(
  raw: unknown,
  estados: EstadoDefinicion[]
): { code: string | null; sugerido?: CorreccionSugerida } {
  const s = cellStr(raw);
  if (!s) return { code: null };
  const n = normalizeCompare(s);
  const activos = estados.filter((e) => e.activo !== false);

  for (const e of activos) {
    if (normalizeCompare(e.code) === n) {
      if (e.code === s) return { code: e.code };
      return {
        code: e.code,
        sugerido: {
          campo: 'estado',
          valor_original: s,
          valor_sugerido: e.code,
          motivo: 'estado por nombre',
        },
      };
    }
    if (normalizeCompare(e.nombre) === n) {
      return {
        code: e.code,
        sugerido: {
          campo: 'estado',
          valor_original: s,
          valor_sugerido: e.code,
          motivo: 'estado por nombre',
        },
      };
    }
  }

  let best: { code: string; d: number } | null = null;
  for (const e of activos) {
    const dCode = levenshtein(n, normalizeCompare(e.code));
    const dName = levenshtein(n, normalizeCompare(e.nombre));
    const d = Math.min(dCode, dName);
    if (d <= 2 && (!best || d < best.d)) best = { code: e.code, d };
  }
  if (best) {
    return {
      code: best.code,
      sugerido: {
        campo: 'estado',
        valor_original: s,
        valor_sugerido: best.code,
        motivo: 'estado con typo',
      },
    };
  }
  return { code: null };
}

export function sugerirOrientacion(
  raw: unknown
): { valor: OrientacionCanon | ''; sugerido?: CorreccionSugerida; desconocida?: boolean } {
  const s = cellStr(raw);
  if (!s) return { valor: '' };
  const n = normalizeCompare(s).replace(/\s/g, '').replace(/_/g, '-');
  const exact = ORIENTACIONES_CANONICAS.find((o) => normalizeCompare(o) === normalizeCompare(s));
  if (exact) {
    if (exact === s) return { valor: exact };
    return {
      valor: exact,
      sugerido: { campo: 'orientacion', valor_original: s, valor_sugerido: exact, motivo: 'orientación' },
    };
  }
  const alias = ORIENTACION_ALIAS[n];
  if (alias) {
    return {
      valor: alias,
      sugerido: { campo: 'orientacion', valor_original: s, valor_sugerido: alias, motivo: 'orientación' },
    };
  }
  let best: { o: OrientacionCanon; d: number } | null = null;
  for (const o of ORIENTACIONES_CANONICAS) {
    const d = levenshtein(normalizeCompare(s), normalizeCompare(o));
    if (d <= 2 && (!best || d < best.d)) best = { o, d };
  }
  if (best) {
    return {
      valor: best.o,
      sugerido: { campo: 'orientacion', valor_original: s, valor_sugerido: best.o, motivo: 'orientación' },
    };
  }
  return { valor: s as OrientacionCanon, desconocida: true };
}

export function sugerirTrim(raw: unknown, campo: 'numero_lote'): CorreccionSugerida | null {
  const s = String(raw ?? '');
  const t = s.trim();
  if (t && t !== s) {
    return { campo, valor_original: s, valor_sugerido: t, motivo: 'formato' };
  }
  return null;
}

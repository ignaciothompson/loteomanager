import type { MapeoEntradaDepto, MapeoEntradaZona, MapeoGeografia } from './types';
import { bestMatch, normalizeCompare } from './text';

export interface GeoDepto {
  id: string;
  nombre: string;
  slug: string;
}

export interface GeoZona {
  id: string;
  nombre: string;
  slug: string;
  departamento_id: string;
}

export interface GeoCatalog {
  departamentos: GeoDepto[];
  zonas: GeoZona[];
}

export function buildMapeoGeografia(
  pares: Array<{ departamento: string; zona: string }>,
  catalog: GeoCatalog,
  barrioDestinoId?: string
): MapeoGeografia {
  const deptosUnicos = uniqueNonEmpty(pares.map((p) => p.departamento));
  const zonasKeys = uniquePairs(pares);

  const deptoUsos = countBy(pares.map((p) => p.departamento));
  const departamentos: MapeoEntradaDepto[] = deptosUnicos.map((valor) => {
    const usos = deptoUsos.get(normalizeCompare(valor)) ?? 1;
    const match = bestMatch(valor, catalog.departamentos.filter((d) => d.slug !== 'todo'), (d) => d.nombre);
    if (match?.exact) {
      return {
        valor_excel: valor,
        departamento_id: match.item.id,
        estado: 'confirmado',
        nombre_sugerido: match.item.nombre,
        usos,
      };
    }
    if (match && match.distance <= 2) {
      return {
        valor_excel: valor,
        departamento_id: match.item.id,
        estado: 'sugerencia',
        nombre_sugerido: match.item.nombre,
        usos,
      };
    }
    return { valor_excel: valor, departamento_id: null, estado: 'sin_resolver', usos };
  });

  const deptoIdByExcel = new Map(departamentos.map((d) => [normalizeCompare(d.valor_excel), d]));

  const zonaUsos = countPairs(pares);
  const zonas: MapeoEntradaZona[] = zonasKeys.map(({ departamento, zona }) => {
    const usos = zonaUsos.get(`${normalizeCompare(departamento)}::${normalizeCompare(zona)}`) ?? 1;
    const deptoEntry = deptoIdByExcel.get(normalizeCompare(departamento));
    const deptoId = deptoEntry?.departamento_id ?? null;
    const candidatas = catalog.zonas.filter((z) => z.slug !== 'todo' && (!deptoId || z.departamento_id === deptoId));
    const match = bestMatch(zona, candidatas, (z) => z.nombre);
    if (match?.exact) {
      return {
        valor_excel: zona,
        departamento_excel: departamento,
        zona_id: match.item.id,
        estado: 'confirmado',
        nombre_sugerido: match.item.nombre,
        usos,
      };
    }
    if (match && match.distance <= 2) {
      return {
        valor_excel: zona,
        departamento_excel: departamento,
        zona_id: match.item.id,
        estado: 'sugerencia',
        nombre_sugerido: match.item.nombre,
        usos,
      };
    }
    return {
      valor_excel: zona,
      departamento_excel: departamento,
      zona_id: null,
      estado: 'sin_resolver',
      usos,
    };
  });

  return { barrio_destino_id: barrioDestinoId, departamentos, zonas };
}

export function zonaIdResuelta(mapeo: MapeoGeografia, departamentoExcel: string, zonaExcel: string): string | null {
  const z = mapeo.zonas.find(
    (e) =>
      normalizeCompare(e.valor_excel) === normalizeCompare(zonaExcel) &&
      normalizeCompare(e.departamento_excel) === normalizeCompare(departamentoExcel)
  );
  return z?.zona_id ?? null;
}

export function deptoIdResuelto(mapeo: MapeoGeografia, departamentoExcel: string): string | null {
  const d = mapeo.departamentos.find((e) => normalizeCompare(e.valor_excel) === normalizeCompare(departamentoExcel));
  return d?.departamento_id ?? null;
}

export function geoSinResolver(
  mapeo: MapeoGeografia,
  departamentoExcel: string,
  zonaExcel: string
): boolean {
  if (!departamentoExcel.trim() || !zonaExcel.trim()) return true;
  const depto = mapeo.departamentos.find(
    (e) => normalizeCompare(e.valor_excel) === normalizeCompare(departamentoExcel)
  );
  const zona = mapeo.zonas.find(
    (e) =>
      normalizeCompare(e.valor_excel) === normalizeCompare(zonaExcel) &&
      normalizeCompare(e.departamento_excel) === normalizeCompare(departamentoExcel)
  );
  return !depto?.departamento_id || !zona?.zona_id;
}

export function mapeoPendiente(mapeo: MapeoGeografia | null | undefined): boolean {
  if (!mapeo || mapeo.barrio_destino_id) return false;
  return (
    mapeo.departamentos.some((d) => d.estado !== 'confirmado' || !d.departamento_id) ||
    mapeo.zonas.some((z) => z.estado !== 'confirmado' || !z.zona_id)
  );
}

function countBy(values: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    const k = normalizeCompare(t);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function countPairs(pares: Array<{ departamento: string; zona: string }>): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of pares) {
    const d = p.departamento.trim();
    const z = p.zona.trim();
    if (!z) continue;
    const k = `${normalizeCompare(d)}::${normalizeCompare(z)}`;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    const k = normalizeCompare(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function uniquePairs(pares: Array<{ departamento: string; zona: string }>): Array<{
  departamento: string;
  zona: string;
}> {
  const seen = new Set<string>();
  const out: Array<{ departamento: string; zona: string }> = [];
  for (const p of pares) {
    const d = p.departamento.trim();
    const z = p.zona.trim();
    if (!z) continue;
    const k = `${normalizeCompare(d)}::${normalizeCompare(z)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ departamento: d, zona: z });
  }
  return out;
}

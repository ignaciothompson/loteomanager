import type {
  BoolFilter,
  ColumnDef,
  ColumnFilterValue,
  ColumnFilters,
  DateRangeFilter,
  ListadoOrden,
  NumberRangeFilter,
  SelectFilter,
  TextFilter
} from './column-def';

const ACCENT_MAP: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  ü: 'u',
  ñ: 'n',
  Á: 'a',
  É: 'e',
  Í: 'i',
  Ó: 'o',
  Ú: 'u',
  Ü: 'u',
  Ñ: 'n'
};

export function normalizeText(value: unknown): string {
  const s = String(value ?? '')
    .toLowerCase()
    .replace(/[áéíóúüñÁÉÍÓÚÜÑ]/g, (c) => ACCENT_MAP[c] ?? c);
  return s;
}

export function isFilterActive(value: ColumnFilterValue | undefined): boolean {
  if (value == null || value === '' || value === 'all') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    const r = value as NumberRangeFilter | DateRangeFilter;
    return (
      ('min' in r && (r.min != null || r.max != null)) ||
      ('from' in r && (!!r.from || !!r.to))
    );
  }
  return true;
}

export function countActiveFilters(filters: ColumnFilters): number {
  return Object.values(filters).filter(isFilterActive).length;
}

function matchText(cell: unknown, filter: TextFilter): boolean {
  const q = normalizeText(filter).trim();
  if (!q) return true;
  return normalizeText(cell).includes(q);
}

function matchBool(cell: unknown, filter: BoolFilter): boolean {
  if (filter === 'all') return true;
  const truthy = !!cell;
  return filter === 'yes' ? truthy : !truthy;
}

function matchSelect(cell: unknown, filter: SelectFilter, tags: boolean): boolean {
  if (!filter.length) return true;
  if (tags) {
    const arr = Array.isArray(cell) ? cell.map(String) : [];
    return filter.some((v) => arr.includes(v));
  }
  return filter.includes(String(cell ?? ''));
}

function matchNumber(cell: unknown, filter: NumberRangeFilter): boolean {
  const n = typeof cell === 'number' ? cell : Number(cell);
  if (cell == null || cell === '' || Number.isNaN(n)) {
    return filter.min == null && filter.max == null;
  }
  if (filter.min != null && n < filter.min) return false;
  if (filter.max != null && n > filter.max) return false;
  return true;
}

function toDateMs(value: unknown): number | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  const ms = d.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function matchDate(cell: unknown, filter: DateRangeFilter): boolean {
  const ms = toDateMs(cell);
  if (ms == null) return !filter.from && !filter.to;
  if (filter.from) {
    const from = toDateMs(filter.from);
    if (from != null && ms < from) return false;
  }
  if (filter.to) {
    const to = toDateMs(filter.to);
    if (to != null) {
      // inclusive end of day
      const end = to + 24 * 60 * 60 * 1000 - 1;
      if (ms > end) return false;
    }
  }
  return true;
}

export function rowMatchesFilters<T>(
  row: T,
  columns: ColumnDef<T>[],
  filters: ColumnFilters,
  search: string
): boolean {
  const q = normalizeText(search).trim();
  if (q) {
    const hay = columns.some((col) => {
      const text = col.getSearchText?.(row) ?? String(col.getValue(row) ?? '');
      return normalizeText(text).includes(q);
    });
    if (!hay) return false;
  }

  for (const col of columns) {
    if (!col.filtrable) continue;
    const f = filters[col.id];
    if (!isFilterActive(f)) continue;
    const value = col.getValue(row);
    switch (col.tipo) {
      case 'text':
        if (!matchText(col.getSearchText?.(row) ?? value, f as TextFilter)) return false;
        break;
      case 'bool':
        if (!matchBool(value, f as BoolFilter)) return false;
        break;
      case 'select':
      case 'state':
        if (!matchSelect(value, f as SelectFilter, false)) return false;
        break;
      case 'tags':
        if (!matchSelect(value, f as SelectFilter, true)) return false;
        break;
      case 'number':
        if (!matchNumber(value, f as NumberRangeFilter)) return false;
        break;
      case 'date':
        if (!matchDate(value, f as DateRangeFilter)) return false;
        break;
      default:
        break;
    }
  }
  return true;
}

function isEmptySortValue(v: unknown): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

export function sortRows<T>(rows: T[], columns: ColumnDef<T>[], orden: ListadoOrden): T[] {
  if (!orden) return rows;
  const col = columns.find((c) => c.id === orden.campo);
  if (!col || !col.ordenable) return rows;
  const dir = orden.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = col.getSortValue?.(a) ?? col.getValue(a);
    const vb = col.getSortValue?.(b) ?? col.getValue(b);
    const ea = isEmptySortValue(va);
    const eb = isEmptySortValue(vb);
    if (ea && eb) return 0;
    if (ea) return 1;
    if (eb) return -1;

    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * dir;
    }
    if (col.tipo === 'date' || col.tipo === 'bool') {
      const na = toDateMs(va) ?? Number(va);
      const nb = toDateMs(vb) ?? Number(vb);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return (na - nb) * dir;
    }
    return String(va).localeCompare(String(vb), 'es', { numeric: true }) * dir;
  });
}

export function formatDateShort(value: unknown): string {
  const ms = toDateMs(value);
  if (ms == null) return '';
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export function formatNumber(value: unknown, locale = 'es-UY'): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (value == null || value === '' || Number.isNaN(n)) return '';
  return n.toLocaleString(locale);
}

export function formatMoney(value: unknown, moneda: string | null | undefined): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (value == null || value === '' || Number.isNaN(n)) return '';
  const formatted = formatNumber(n);
  if (moneda === 'UYU' || moneda === '$') return `$ ${formatted}`;
  return `US$ ${formatted}`;
}

export function filterButtonLabel(
  tipo: ColumnDef['tipo'],
  value: ColumnFilterValue | undefined,
  opciones?: { label: string; value: string }[]
): string {
  if (!isFilterActive(value)) {
    return 'Todos';
  }
  if (tipo === 'text') {
    const t = String(value ?? '').trim();
    return t || 'Todos';
  }
  if (tipo === 'bool') return value === 'yes' ? 'Sí' : 'No';
  if (tipo === 'select' || tipo === 'state' || tipo === 'tags') {
    const arr = value as SelectFilter;
    if (arr.length === 1) {
      const opt = opciones?.find((o) => o.value === arr[0]);
      return opt?.label ?? arr[0];
    }
    return `${arr.length} sel.`;
  }
  if (tipo === 'number') {
    const r = value as NumberRangeFilter;
    if (r.min != null && r.max != null) return `${r.min}–${r.max}`;
    if (r.min != null) return `≥ ${r.min}`;
    if (r.max != null) return `≤ ${r.max}`;
  }
  if (tipo === 'date') {
    const r = value as DateRangeFilter;
    const from = r.from ? formatDateShort(r.from) : '';
    const to = r.to ? formatDateShort(r.to) : '';
    if (from && to) return `${from}–${to}`;
    if (from) return `≥ ${from}`;
    if (to) return `≤ ${to}`;
  }
  return 'Todos';
}

export function defaultVisibleIds<T>(catalog: ColumnDef<T>[]): string[] {
  return catalog.filter((c) => c.default).map((c) => c.id);
}

export function sanitizeColumnIds<T>(ids: string[] | null | undefined, catalog: ColumnDef<T>[]): string[] {
  const known = new Set(catalog.map((c) => c.id));
  const cleaned = (ids ?? []).filter((id) => known.has(id));
  return cleaned.length ? cleaned : defaultVisibleIds(catalog);
}

export function extrasToColumns<T extends { extras?: unknown }>(
  extras: {
    id: string;
    code: string;
    nombre: string;
    tipo: string;
    opciones?: unknown;
  }[],
  grupo: string
): ColumnDef<T>[] {
  return extras.map((ex) => {
    const tipo =
      ex.tipo === 'numero'
        ? 'number'
        : ex.tipo === 'booleano'
          ? 'bool'
          : ex.tipo === 'opciones'
            ? 'select'
            : ex.tipo === 'fecha'
              ? 'date'
              : 'text';
    const opciones: { label: string; value: string }[] = [];
    if (Array.isArray(ex.opciones)) {
      for (const o of ex.opciones) {
        if (typeof o === 'string') opciones.push({ label: o, value: o });
        else if (o && typeof o === 'object') {
          const obj = o as { label?: string; value?: string; nombre?: string };
          const value = String(obj.value ?? obj.label ?? obj.nombre ?? '');
          if (value) opciones.push({ label: String(obj.label ?? obj.nombre ?? value), value });
        }
      }
    }
    const labelWidth = Math.min(220, Math.max(120, ex.nombre.length * 9));
    return {
      id: `extra:${ex.code}`,
      label: ex.nombre,
      grupo,
      grupoHint: 'de extras_definiciones',
      tipo,
      ancho: labelWidth,
      default: false,
      filtrable: true,
      ordenable: true,
      extra: true,
      opciones: tipo === 'select' ? opciones : undefined,
      getValue: (row) => {
        const raw = row.extras;
        if (!Array.isArray(raw)) return null;
        const hit = raw.find(
          (x) =>
            x &&
            typeof x === 'object' &&
            ((x as { code?: string }).code === ex.code ||
              (x as { extra_id?: string }).extra_id === ex.id)
        ) as { valor?: unknown } | undefined;
        return hit?.valor ?? null;
      }
    } satisfies ColumnDef<T>;
  });
}

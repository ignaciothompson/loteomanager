export type ColumnTipo =
  | 'text'
  | 'number'
  | 'date'
  | 'bool'
  | 'select'
  | 'state'
  | 'tags'
  | 'compuesta';

export type ColumnFormato = 'money' | 'm2' | 'ha' | 'pct' | 'raw';

export type ColumnOption = { label: string; value: string };

export type ColumnDef<T = any> = {
  id: string;
  label: string;
  grupo: string;
  grupoHint?: string;
  tipo: ColumnTipo;
  ancho?: number;
  flex?: boolean;
  formato?: ColumnFormato;
  alineacion?: 'left' | 'right';
  default: boolean;
  filtrable: boolean;
  ordenable: boolean;
  /** Extra dinámico */
  extra?: boolean;
  opciones?: ColumnOption[];
  /** Resolver valor crudo / display */
  getValue: (row: T) => unknown;
  /** Texto para búsqueda global y filtro text */
  getSearchText?: (row: T) => string;
  /** Valor para orden (default: getValue) */
  getSortValue?: (row: T) => unknown;
};

export type ListadoOrden = { campo: string; dir: 'asc' | 'desc' } | null;

export type TextFilter = string;
export type BoolFilter = 'all' | 'yes' | 'no';
export type SelectFilter = string[];
export type NumberRangeFilter = { min: number | null; max: number | null };
export type DateRangeFilter = { from: string | null; to: string | null };

export type ColumnFilterValue =
  | TextFilter
  | BoolFilter
  | SelectFilter
  | NumberRangeFilter
  | DateRangeFilter
  | null;

export type ColumnFilters = Record<string, ColumnFilterValue>;

export const CHECK_COL_WIDTH = 44;
export const ACTIONS_COL_WIDTH = 160;
export const FLEX_COL_MIN = 220;

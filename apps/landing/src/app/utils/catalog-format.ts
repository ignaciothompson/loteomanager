/** Formato rango m² para cards catálogo. */
export function formatAreaRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null && min !== max) return `${formatM2(min)} - ${formatM2(max)}`;
  const v = min ?? max;
  return v != null ? formatM2(v) : '—';
}

export function formatM2(value: number): string {
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value)} m²`;
}

export function formatPrecioDesde(precio: number | null, moneda: string | null): string | null {
  if (precio == null) return null;
  const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(precio);
  return `${moneda ?? 'USD'} ${num}+`;
}

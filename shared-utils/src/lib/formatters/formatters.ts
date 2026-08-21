export function formatCurrency(amount: number, currency: 'USD' | 'ARS'): string {
  return formatPrecio(amount, currency);
}

/**
 * Precio display admin/landing-style: `US$ 52.000` / `$U 1.850.000`.
 * Enteros sin decimales; fracciones solo si el valor las tiene.
 */
export function formatPrecio(amount: number, currency: string = 'USD'): string {
  const cur = (currency || 'USD').toUpperCase();
  const prefix = cur === 'ARS' ? '$U' : 'US$';
  const isInt = Number.isFinite(amount) && Math.abs(amount % 1) < 1e-9;
  const num = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: isInt ? 0 : 2,
  }).format(amount);
  return `${prefix} ${num}`;
}

export function formatDate(date: Date | string, formatStyle: 'short' | 'long' = 'short'): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;

  if (formatStyle === 'long') {
    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  }

  return new Intl.DateTimeFormat('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

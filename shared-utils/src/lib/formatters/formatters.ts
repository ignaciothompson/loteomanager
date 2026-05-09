export function formatCurrency(amount: number, currency: 'USD' | 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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

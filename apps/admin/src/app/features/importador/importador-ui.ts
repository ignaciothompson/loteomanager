export const ESTADO_IMPORTACION_LABEL: Record<string, string> = {
  analizando: 'Analizando',
  listo_para_confirmar: 'Lista para confirmar',
  confirmada: 'Confirmada',
  confirmando: 'Confirmando',
  descartada: 'Descartada',
  con_errores: 'Con errores',
};

export function labelEstadoImportacion(estado: string): string {
  return ESTADO_IMPORTACION_LABEL[estado] ?? estado.replace(/_/g, ' ');
}

export function plural(n: number, uno: string, muchos: string): string {
  return `${n} ${n === 1 ? uno : muchos}`;
}

export function fraseBarriosLotes(barrios: number, lotes: number): string {
  const partes: string[] = [];
  if (barrios > 0) partes.push(plural(barrios, 'barrio', 'barrios'));
  if (lotes > 0) partes.push(plural(lotes, 'lote', 'lotes'));
  if (!partes.length) {
    if (barrios === 0 && lotes === 0) return '0 lotes';
    return 'nada';
  }
  if (partes.length === 1) return partes[0];
  return `${partes[0]} y ${partes[1]}`;
}

export function tiempoRelativo(iso: string | undefined | null, now = Date.now()): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.round((now - t) / 1000);
  if (s < 45) return 'hace un momento';
  if (s < 90) return 'hace 1 min';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 5400) return 'hace 1 h';
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  if (s < 172800) return 'hace 1 día';
  if (s < 86400 * 30) return `hace ${Math.round(s / 86400)} días`;
  return new Date(iso).toLocaleDateString('es-UY');
}

export function formatAbsoluto(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-UY', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatPrecio(n: number | null | undefined, moneda?: string): string {
  if (n == null || Number.isNaN(n)) return '—';
  const formatted = new Intl.NumberFormat('es-UY', {
    maximumFractionDigits: 0,
  }).format(n);
  return moneda ? `${moneda} ${formatted}` : formatted;
}

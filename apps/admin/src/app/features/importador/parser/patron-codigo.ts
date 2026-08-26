/**
 * Infere `patron_codigo` desde un numero_lote.
 * `L-001` → `L-{n}`; `MZ2-14` → `MZ2-{n}`; sin dígitos finales → `{codigo}-{n}`.
 */
export function inferirPatronCodigo(numeroLote: string): string {
  const raw = numeroLote.trim();
  if (!raw) return '{codigo}-{n}';
  const m = raw.match(/^(.*?)(\d+)$/);
  if (!m) return `${raw}-{n}`;
  const prefix = m[1];
  return `${prefix}{n}`;
}

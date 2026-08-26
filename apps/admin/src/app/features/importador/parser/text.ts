export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Minúsculas, sin acentos, trim, espacios colapsados. */
export function normalizeCompare(s: string): string {
  return stripAccents(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Minúsculas, sin acentos, espacios → `_`. Para etiquetas de cabezal y headers. */
export function normalizeLabel(s: string): string {
  return stripAccents(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function bestMatch<T>(
  needle: string,
  items: T[],
  getName: (item: T) => string
): { item: T; distance: number; exact: boolean } | null {
  const n = normalizeCompare(needle);
  if (!n) return null;
  let best: { item: T; distance: number; exact: boolean } | null = null;
  for (const item of items) {
    const name = normalizeCompare(getName(item));
    if (!name) continue;
    if (name === n) return { item, distance: 0, exact: true };
    const d = levenshtein(n, name);
    if (!best || d < best.distance) best = { item, distance: d, exact: false };
  }
  return best;
}

export function cellStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

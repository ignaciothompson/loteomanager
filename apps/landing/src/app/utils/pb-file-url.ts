/**
 * PocketBase file fields store a bare filename. Admin UI / some exports show a full
 * `/api/files/.../name?token=` URL — never concatenate that into another files URL.
 */
export function pbFileName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  if (/^https?:\/\//i.test(s)) {
    try {
      const seg = new URL(s).pathname.split('/').filter(Boolean).pop();
      return seg ? decodeURIComponent(seg) : null;
    } catch {
      return null;
    }
  }

  const noQuery = s.split('?')[0]?.split('#')[0] ?? s;
  const base = noQuery.includes('/') ? noQuery.split('/').pop() : noQuery;
  return base || null;
}

/** Browser-reachable PocketBase file URL (collection name, not pbc_* id). */
export function publicPbFileUrl(
  pbUrl: string,
  collection: string,
  recordId: string,
  file: unknown,
): string | null {
  const name = pbFileName(file);
  if (!name || !recordId) return null;
  const base = pbUrl.replace(/\/+$/, '');
  return `${base}/api/files/${collection}/${recordId}/${name}`;
}

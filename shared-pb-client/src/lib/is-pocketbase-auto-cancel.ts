/** PocketBase JS SDK aborta requests duplicados (auto-cancellation). No es un 404. */
export function isPocketBaseAutoCancel(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string; name?: string };
  const msg = (e.message ?? '').toLowerCase();
  if (msg.includes('autocancel') || msg.includes('aborted')) return true;
  if (e.name === 'AbortError') return true;
  return e.status === 0 && msg.includes('request was aborted');
}

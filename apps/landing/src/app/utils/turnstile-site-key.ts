/** Resolve Cloudflare Turnstile site key from browser env. */
export function resolveTurnstileSiteKey(): string {
  if (typeof window === 'undefined') return '';

  const host = window.location.hostname;
  // Local: never load Cloudflare widget (401 / Brunhilde hangs submit).
  if (host === 'localhost' || host === '127.0.0.1') {
    console.log('[turnstile] host=%s → skip widget (dev)', host);
    return '';
  }

  const fromEnv = window.__env?.TURNSTILE_SITE_KEY;
  if (fromEnv?.trim()) {
    console.log('[turnstile] site key from __env (len=%d)', fromEnv.trim().length);
    return fromEnv.trim();
  }
  const legacy = (window as unknown as { TURNSTILE_SITE_KEY?: string }).TURNSTILE_SITE_KEY;
  const key = legacy?.trim() || '';
  console.log('[turnstile] site key legacy/empty → "%s"', key ? `len=${key.length}` : '(none)');
  return key;
}

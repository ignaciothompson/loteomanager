import PocketBase from 'pocketbase';
import type { TypedPocketBase } from '@loteomanager/shared-types';

let _pb: TypedPocketBase | null = null;
let _authAttempted = false;

/**
 * Singleton PocketBase client for server-side use.
 * Authenticates with PB_SERVICE_USER/PB_SERVICE_PASSWORD when set.
 * Auth failure does NOT abort — public list/view still work anonymous.
 * ONLY use server-side — never import from browser code.
 */
export async function getPocketBaseClient(): Promise<TypedPocketBase> {
  if (_pb) {
    return _pb;
  }

  // Local default 8090: matches apps/landing/public/env.js and PB_HOST_PORT
  // (8080 often taken — e.g. NVIDIA Broadcast on this host).
  const url =
    process.env['PB_INTERNAL_URL'] ??
    process.env['POCKETBASE_URL'] ??
    'http://localhost:8090';

  _pb = new PocketBase(url) as TypedPocketBase;

  const user = process.env['PB_SERVICE_USER'];
  const password = process.env['PB_SERVICE_PASSWORD'];
  if (user && password && !_authAttempted) {
    _authAttempted = true;
    try {
      await _pb.collection('users').authWithPassword(user, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[pb] service auth failed (${msg}). Continuing anonymous. Fix PB_SERVICE_USER / PB_SERVICE_PASSWORD in Dokploy.`,
      );
    }
  }

  return _pb;
}

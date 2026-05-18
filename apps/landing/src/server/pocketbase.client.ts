import PocketBase from 'pocketbase';
import type { TypedPocketBase } from '@loteomanager/shared-types';

let _pb: TypedPocketBase | null = null;

/**
 * Returns a singleton PocketBase client for server-side use.
 *
 * Authentication priority:
 * 1. PB_SERVICE_TOKEN env var (if set — use for superuser-level operations)
 * 2. No auth (works because public collections have open view/create rules)
 *
 * ONLY use server-side — never import from browser code.
 */
export function getPocketBaseClient(): TypedPocketBase {
  if (_pb) return _pb;

  const url =
    process.env['PB_INTERNAL_URL'] ??
    process.env['POCKETBASE_URL'] ??
    'http://localhost:8080';

  _pb = new PocketBase(url) as TypedPocketBase;

  const token = process.env['PB_SERVICE_TOKEN'];
  if (token) {
    _pb.authStore.save(token, null);
  }
  // No token? Public collection rules handle access.

  return _pb;
}

import { createHash } from 'node:crypto';

const IP_HASH_SALT = process.env['IP_HASH_SALT'] ?? 'loteo-landing-salt-v1';

export function hashIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  return createHash('sha256')
    .update(IP_HASH_SALT + ip)
    .digest('hex');
}

import { inject, InjectionToken } from '@angular/core';
import PocketBase from 'pocketbase';

/**
 * URL del backend PocketBase (origen sin trailing slash).
 *
 * El consumidor (app shell) debe proveerla en bootstrap. En el admin se
 * resuelve a partir de `window.__env.POCKETBASE_URL` (inyectado por
 * `public/env.js`, generado por el entrypoint del contenedor a partir de la
 * env var `POCKETBASE_URL`). Esto permite usar la misma imagen en dev y en
 * cualquier deploy sin rebuild.
 *
 * Si no se provee, el fallback es `http://localhost:8080` (dev local).
 */
export const POCKETBASE_URL = new InjectionToken<string>('POCKETBASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:8080',
});

export const POCKETBASE = new InjectionToken<PocketBase>('POCKETBASE', {
  providedIn: 'root',
  factory: () => new PocketBase(inject(POCKETBASE_URL)),
});

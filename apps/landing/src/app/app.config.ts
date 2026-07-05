import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { POCKETBASE_URL } from '@loteomanager/shared-pb-client';

declare global {
  interface Window {
    __env?: { POCKETBASE_URL?: string };
  }
}

function resolvePocketbaseUrl(): string {
  const fromWindow = typeof window !== 'undefined' ? window.__env?.POCKETBASE_URL : undefined;
  return (fromWindow?.trim() || 'http://localhost:8080').replace(/\/+$/, '');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withFetch()),
    { provide: POCKETBASE_URL, useFactory: resolvePocketbaseUrl },
  ],
};

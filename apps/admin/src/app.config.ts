/**
 * Application-level configuration for the admin panel.
 *
 * - Uses Aura theme from PrimeNG with emerald primary color.
 * - Dark mode selector uses '.app-dark' CSS class (Sakai convention).
 * - Dark mode defaults to ON, but respects localStorage preference (see LayoutService).
 * - Zoneless change detection for optimal performance with Angular Signals.
 * - PocketBase URL is read at runtime from `window.__env.POCKETBASE_URL`
 *   (provided by `public/env.js`, regenerado por el entrypoint del contenedor
 *   a partir de la env var POCKETBASE_URL). Permite usar la misma imagen
 *   buildeada en cualquier entorno.
 */
import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';
import { POCKETBASE_URL } from '@loteomanager/shared-pb-client';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { appRoutes } from './app.routes';

declare global {
    interface Window {
        __env?: {
            POCKETBASE_URL?: string;
            LANDING_URL?: string;
        };
    }
}

function resolvePocketbaseUrl(): string {
    const fromWindow = typeof window !== 'undefined' ? window.__env?.POCKETBASE_URL : undefined;
    const url = fromWindow?.trim() || 'http://localhost:8080';
    return url.replace(/\/+$/, '');
}

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(
            appRoutes,
            withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
            withEnabledBlockingInitialNavigation()
        ),
        provideHttpClient(withFetch()),
        provideZonelessChangeDetection(),
        providePrimeNG({
            theme: {
                preset: Aura,
                options: { darkModeSelector: '.app-dark' }
            }
        }),
        { provide: POCKETBASE_URL, useFactory: resolvePocketbaseUrl }
    ]
};

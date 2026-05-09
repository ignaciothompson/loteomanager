/**
 * Application-level configuration for the admin panel.
 *
 * - Uses Aura theme from PrimeNG with emerald primary color.
 * - Dark mode selector uses '.app-dark' CSS class (Sakai convention).
 * - Dark mode defaults to ON, but respects localStorage preference (see LayoutService).
 * - Zoneless change detection for optimal performance with Angular Signals.
 */
import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { appRoutes } from './app.routes';

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
        })
    ]
};

/**
 * Admin panel route definitions.
 *
 * All pages inside AppLayout use the Sakai sidebar + topbar chrome.
 * Pages marked with TODO are placeholders for Etapa 1 development.
 */
import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';

export const appRoutes: Routes = [
    {
        path: '',
        component: AppLayout,
        children: [
            {
                path: '',
                loadComponent: () => import('./app/pages/dashboard/dashboard').then(m => m.Dashboard)
            },
            // --- Inventario ---
            {
                path: 'barrios',
                loadComponent: () => import('./app/pages/placeholder.page').then(m => m.PlaceholderPage),
                data: { title: 'Barrios' }
            },
            {
                path: 'lotes',
                loadComponent: () => import('./app/pages/placeholder.page').then(m => m.PlaceholderPage),
                data: { title: 'Lotes' }
            },
            // --- Ventas ---
            {
                path: 'interesados',
                loadComponent: () => import('./app/pages/placeholder.page').then(m => m.PlaceholderPage),
                data: { title: 'Interesados' }
            },
            {
                path: 'enlaces',
                loadComponent: () => import('./app/pages/placeholder.page').then(m => m.PlaceholderPage),
                data: { title: 'Enlaces Compartibles' }
            },
            // --- Directorio ---
            {
                path: 'arquitectos',
                loadComponent: () => import('./app/pages/placeholder.page').then(m => m.PlaceholderPage),
                data: { title: 'Arquitectos' }
            },
            {
                path: 'usuarios',
                loadComponent: () => import('./app/pages/placeholder.page').then(m => m.PlaceholderPage),
                data: { title: 'Usuarios' }
            }
        ]
    },
    {
        path: 'notfound',
        loadComponent: () => import('./app/pages/notfound/notfound').then(m => m.Notfound)
    },
    { path: '**', redirectTo: '/notfound' }
];

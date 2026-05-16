/**
 * Admin panel route definitions.
 *
 * All pages inside AppLayout use the Sakai sidebar + topbar chrome.
 * Pages marked with TODO are placeholders for Etapa 1 development.
 */
import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { authGuard } from './app/core/guards/auth.guard';

export const appRoutes: Routes = [
    {
        path: '',
        component: AppLayout,
        canActivate: [authGuard],
        children: [
            {
                path: '',
                loadComponent: () => import('./app/features/dashboard/dashboard').then(m => m.Dashboard)
            },
            // --- Inventario ---
            {
                path: 'barrios',
                loadComponent: () => import('./app/features/barrios/barrios.component').then(m => m.BarriosComponent),
                data: { title: 'Barrios' }
            },
            {
                path: 'lotes',
                loadComponent: () => import('./app/features/unidades/unidades.component').then(m => m.UnidadesComponent),
                data: { title: 'Lotes' }
            },
            // --- Ventas ---
            {
                path: 'interesados',
                loadComponent: () => import('./app/features/interesados/interesados.component').then(m => m.InteresadosComponent),
                data: { title: 'Interesados' }
            },
            {
                path: 'enlaces',
                loadComponent: () => import('./app/features/comparativas/comparativas.component').then(m => m.ComparativasComponent),
                data: { title: 'Enlaces Compartibles' }
            },
            {
                path: 'config/extras',
                loadComponent: () => import('./app/features/admin/extras/extras-admin.component').then(m => m.ExtrasAdminComponent),
                data: { title: 'Extras' }
            },
            {
                path: 'config/estados',
                loadComponent: () => import('./app/features/admin/estados/estados-admin.component').then(m => m.EstadosAdminComponent),
                data: { title: 'Estados' }
            },
            // --- Directorio ---
            // {
            //     path: 'arquitectos',
            //     loadComponent: () => import('./app/features/arquitectos/arquitectos.component').then(m => m.ArquitectosComponent),
            //     data: { title: 'Arquitectos' }
            // },
            // {
            //     path: 'usuarios',
            //     loadComponent: () => import('./app/features/usuarios/usuarios.component').then(m => m.UsuariosComponent),
            //     data: { title: 'Usuarios' }
            // }
        ]
    },
    {
        path: 'notfound',
        loadComponent: () => import('./app/features/notfound/notfound').then(m => m.Notfound)
    },
    {
        path: 'login',
        loadComponent: () => import('./app/features/auth/login').then(m => m.Login)
    },
    { path: '**', redirectTo: '/notfound' }
];

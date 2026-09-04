/**
 * Admin panel route definitions.
 *
 * All pages inside AppLayout use the Sakai sidebar + topbar chrome.
 * Pages marked with TODO are placeholders for Etapa 1 development.
 */
import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { authGuard } from './app/core/guards/auth.guard';
import { permisoGuard } from './app/core/guards/permiso.guard';
import { mustNotChangePasswordGuard } from './app/core/guards/must-change-password.guard';

export const appRoutes: Routes = [
    {
        path: '',
        component: AppLayout,
        canActivate: [authGuard, mustNotChangePasswordGuard],
        children: [
            {
                path: '',
                loadComponent: () => import('./app/features/dashboard/dashboard').then(m => m.Dashboard)
            },
            // --- Inventario ---
            {
                path: 'barrios',
                loadComponent: () => import('./app/features/barrios/listado/barrios.component').then(m => m.BarriosComponent),
                data: { title: 'Barrios' }
            },
            {
                path: 'barrios/:id',
                loadComponent: () => import('./app/features/barrios/ingreso/barrio-ingreso-page.component').then(m => m.BarrioIngresoPageComponent),
                data: { title: 'Ingreso barrio' }
            },
            {
                path: 'actualizacion-masiva',
                canActivate: [authGuard, permisoGuard('unidades.bulk_edit')],
                loadComponent: () =>
                    import('./app/features/actualizacion-masiva/actualizacion-masiva.component').then(
                        (m) => m.ActualizacionMasivaComponent
                    ),
                data: { title: 'Actualización masiva' }
            },
            {
                path: 'publicacion-web',
                canActivate: [authGuard, permisoGuard('web.publish')],
                loadComponent: () =>
                    import('./app/features/publicacion-web/publicacion-web.component').then(
                        (m) => m.PublicacionWebComponent
                    ),
                data: { title: 'Publicación web' }
            },
            {
                path: 'actualizacion-web',
                redirectTo: 'publicacion-web',
                pathMatch: 'full'
            },
            {
                path: 'lotes',
                redirectTo: 'barrios',
                pathMatch: 'full'
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
                path: 'config/departamentos',
                canActivate: [authGuard, permisoGuard('departamentos.manage')],
                loadComponent: () => import('./app/features/admin/departamentos/departamentos.component').then(m => m.DepartamentosComponent),
                data: { title: 'Departamentos' }
            },
            {
                path: 'config/zonas',
                canActivate: [authGuard, permisoGuard('zonas.manage')],
                loadComponent: () => import('./app/features/admin/zonas/zonas.component').then(m => m.ZonasComponent),
                data: { title: 'Zonas' }
            },
            {
                path: 'config/extras',
                canActivate: [authGuard, permisoGuard('extras.crud')],
                loadComponent: () => import('./app/features/admin/extras/extras-admin.component').then(m => m.ExtrasAdminComponent),
                data: { title: 'Extras' }
            },
            {
                path: 'config/estados',
                canActivate: [authGuard, permisoGuard('estados.crud')],
                loadComponent: () => import('./app/features/admin/estados/estados-admin.component').then(m => m.EstadosAdminComponent),
                data: { title: 'Estados' }
            },
            // --- Directorio ---
            {
                path: 'arquitectos',
                loadComponent: () => import('./app/features/arquitectos/arquitectos.component').then(m => m.ArquitectosComponent),
                data: { title: 'Arquitectos' }
            },
            {
                path: 'usuarios',
                canActivate: [authGuard, permisoGuard('users.crud')],
                loadComponent: () => import('./app/features/usuarios/usuarios-list/usuarios-list.component').then(m => m.UsuariosListComponent),
                data: { title: 'Usuarios' }
            },
            {
                path: 'importador',
                canActivate: [authGuard, mustNotChangePasswordGuard, permisoGuard('importador.use')],
                loadChildren: () => import('./app/features/importador/importador.routes').then(m => m.importadorRoutes),
            },
            {
                path: 'exportador',
                canActivate: [authGuard, mustNotChangePasswordGuard, permisoGuard('importador.use')],
                loadChildren: () => import('./app/features/exportador/exportador.routes').then(m => m.exportadorRoutes),
            },
            {
                path: 'mi-perfil',
                loadComponent: () => import('./app/features/usuarios/mi-perfil/mi-perfil.component').then(m => m.MiPerfilComponent),
                data: { title: 'Mi Perfil' }
            },
            {
                path: 'forbidden',
                loadComponent: () => import('./app/features/auth/forbidden/forbidden.component').then(m => m.ForbiddenComponent)
            },
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
    {
        path: 'auth/cambiar-password-inicial',
        canActivate: [authGuard],
        loadComponent: () => import('./app/features/auth/cambiar-password-inicial/cambiar-password-inicial.component').then(m => m.CambiarPasswordInicialComponent)
    },
    {
        path: 'auth/recuperar',
        loadComponent: () => import('./app/features/auth/recuperar-password/recuperar-password.component').then(m => m.RecuperarPasswordComponent)
    },
    {
        path: 'auth/reset',
        loadComponent: () => import('./app/features/auth/resetear-password/resetear-password.component').then(m => m.ResetearPasswordComponent)
    },
    { path: '**', redirectTo: '/notfound' }
];

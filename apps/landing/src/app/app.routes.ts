import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'barrios',
    loadComponent: () =>
      import('./pages/barrios.component').then(m => m.BarriosComponent),
  },
  {
    path: 'barrios/:slug',
    loadComponent: () =>
      import('./pages/barrio-detail.component').then(m => m.BarrioDetailComponent),
  },
  {
    path: 'lotes/:id',
    loadComponent: () =>
      import('./pages/lote-detail.component').then(m => m.LoteDetailComponent),
  },
  {
    path: 'c/:token',
    loadComponent: () =>
      import('./pages/comparativa-publica/comparativa-publica.component').then(
        m => m.ComparativaPublicaComponent,
      ),
  },
  {
    path: 'expirada',
    loadComponent: () =>
      import('./pages/expirada/expirada.component').then(m => m.ExpiradaComponent),
  },
  {
    path: '404',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
  {
    path: '**',
    redirectTo: '404',
  },
];

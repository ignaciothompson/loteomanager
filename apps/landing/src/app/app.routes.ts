import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'barrios',
    loadComponent: () =>
      import('./pages/barrios.component').then((m) => m.BarriosComponent),
  },
  {
    path: 'barrios/:slug',
    loadComponent: () =>
      import('./pages/barrio-detail.component').then(
        (m) => m.BarrioDetailComponent
      ),
  },
  {
    path: 'lotes/:id',
    loadComponent: () =>
      import('./pages/lote-detail.component').then(
        (m) => m.LoteDetailComponent
      ),
  },
];

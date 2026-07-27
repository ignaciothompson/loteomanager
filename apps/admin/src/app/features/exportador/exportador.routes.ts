import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { mustNotChangePasswordGuard } from '../../core/guards/must-change-password.guard';
import { permisoGuard } from '../../core/guards/permiso.guard';

export const exportadorRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard, mustNotChangePasswordGuard, permisoGuard('importador.use')],
    loadComponent: () =>
      import('./exportador-page.component').then(m => m.ExportadorPageComponent),
  },
];

import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { mustNotChangePasswordGuard } from '../../core/guards/must-change-password.guard';
import { permisoGuard } from '../../core/guards/permiso.guard';

export const importadorRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard, mustNotChangePasswordGuard, permisoGuard('importador.use')],
    loadComponent: () =>
      import('./pages/importador-list.component').then(m => m.ImportadorListComponent),
  },
  {
    path: 'nueva',
    canActivate: [authGuard, mustNotChangePasswordGuard, permisoGuard('importador.use')],
    loadComponent: () =>
      import('./pages/importador-upload.component').then(m => m.ImportadorUploadComponent),
  },
  {
    path: ':id/revision',
    canActivate: [authGuard, mustNotChangePasswordGuard, permisoGuard('importador.use')],
    loadComponent: () =>
      import('./pages/importador-review.component').then(m => m.ImportadorReviewComponent),
  },
];

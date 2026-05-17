import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermisosService, Permiso } from '@loteomanager/shared-pb-client';

export function permisoGuard(...permisos: Permiso[]): CanActivateFn {
  return () => {
    const permisosService = inject(PermisosService);
    const router = inject(Router);

    if (permisosService.canAll(...permisos)) return true;

    return router.parseUrl('/forbidden');
  };
}

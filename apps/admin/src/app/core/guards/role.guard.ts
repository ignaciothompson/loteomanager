import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@loteomanager/shared-pb-client';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const currentRole = authService.currentRole();

    if (currentRole && allowedRoles.includes(currentRole)) {
      return true;
    }

    return router.parseUrl('/unauthorized');
  };
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@loteomanager/shared-pb-client';

export const mustNotChangePasswordGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.currentUser();
  if ((user as Record<string, unknown> | null)?.['must_change_password'] === true) {
    return router.parseUrl('/auth/cambiar-password-inicial');
  }
  return true;
};

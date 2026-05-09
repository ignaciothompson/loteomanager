import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { POCKETBASE } from './pocketbase.config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const pb = inject(POCKETBASE);
  
  if (pb.authStore.isValid && pb.authStore.token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${pb.authStore.token}`,
      },
    });
  }

  return next(req);
};


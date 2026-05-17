import { Injectable, Signal, computed, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { PERMISOS_POR_ROL, Permiso, Role } from './permisos.constants';

@Injectable({ providedIn: 'root' })
export class PermisosService {
  private auth = inject(AuthService);

  can(permiso: Permiso): boolean {
    const user = this.auth.currentUser();
    if (!user) return false;
    const perms = PERMISOS_POR_ROL[user['role'] as Role] ?? [];
    return (perms as unknown[]).includes('*') || perms.includes(permiso);
  }

  canSignal(permiso: Permiso): Signal<boolean> {
    return computed(() => this.can(permiso));
  }

  canAll(...permisos: Permiso[]): boolean {
    return permisos.every(p => this.can(p));
  }

  canAny(...permisos: Permiso[]): boolean {
    return permisos.some(p => this.can(p));
  }
}

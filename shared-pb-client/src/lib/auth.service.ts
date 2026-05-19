import { Injectable, inject, signal, computed } from '@angular/core';
import { POCKETBASE } from './pocketbase.config';
import { DefinicionesCacheService } from './services/definiciones-cache.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private pb = inject(POCKETBASE);
  private definicionesCache = inject(DefinicionesCacheService);

  public currentUser = signal<Record<string, unknown> | null>(this.pb.authStore.model as Record<string, unknown> | null);
  public isAuthenticated = signal<boolean>(this.pb.authStore.isValid);
  public currentRole = computed(() => {
    const user = this.currentUser();
    return user ? (user['role'] as string) : null;
  });

  constructor() {
    this.pb.authStore.onChange((_token, model) => {
      this.currentUser.set(model);
      this.isAuthenticated.set(this.pb.authStore.isValid);
      if (this.pb.authStore.isValid) {
        void this.definicionesCache.load();
      } else {
        this.definicionesCache.extras.set([]);
        this.definicionesCache.estados.set([]);
      }
    });
    if (this.pb.authStore.isValid) {
      void this.definicionesCache.load();
    }
  }

  async login(email: string, pass: string): Promise<{ mustChangePassword: boolean }> {
    const authData = await this.pb.collection('users').authWithPassword(email, pass);
    await this.definicionesCache.load().catch(() => undefined);
    const mustChangePassword = (authData.record as Record<string, unknown>)['must_change_password'] === true;
    return { mustChangePassword };
  }

  logout() {
    this.pb.authStore.clear();
  }
}

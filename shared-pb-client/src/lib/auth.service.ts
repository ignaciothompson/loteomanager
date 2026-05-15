import { Injectable, inject, signal, computed } from '@angular/core';
import { POCKETBASE } from './pocketbase.config';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private pb = inject(POCKETBASE);

  public currentUser = signal<Record<string, unknown> | null>(this.pb.authStore.model as Record<string, unknown> | null);
  public isAuthenticated = signal<boolean>(this.pb.authStore.isValid);
  public currentRole = computed(() => {
    const user = this.currentUser();
    return user ? (user['role'] as string) : null;
  });

  constructor() {
    this.pb.authStore.onChange((token, model) => {
      this.currentUser.set(model);
      this.isAuthenticated.set(this.pb.authStore.isValid);
    });
  }

  async login(email: string, pass: string) {
    const authData = await this.pb.collection('users').authWithPassword(email, pass);
    return authData;
  }

  logout() {
    this.pb.authStore.clear();
  }
}

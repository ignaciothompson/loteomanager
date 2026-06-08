import { CommonModule } from '@angular/common';
import { Component, computed, inject, isDevMode, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@loteomanager/shared-pb-client';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';

import { LayoutService } from '../../layout/service/layout.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    PasswordModule,
    RippleModule
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  private authService = inject(AuthService);
  private router = inject(Router);
  private layoutService = inject(LayoutService);

  email = '';
  password = '';
  rememberMe = false;

  loading = signal(false);
  errorMsg = signal('');

  isDark = computed(() => this.layoutService.layoutConfig().darkTheme);
  themeIcon = computed(() => (this.isDark() ? 'pi pi-sun' : 'pi pi-moon'));

  currentYear = new Date().getFullYear();
  readonly isDev = isDevMode();

  fillDevCredentials(): void {
    this.email = 'admin@loteomanager.com';
    this.password = 'admin1234';
  }

  toggleTheme(): void {
    this.layoutService.layoutConfig.update((state) => ({
      ...state,
      darkTheme: !state.darkTheme
    }));
  }

  async login(): Promise<void> {
    if (!this.email || !this.password) {
      this.errorMsg.set('Completá todos los campos.');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');

    try {
      const { mustChangePassword } = await this.authService.login(this.email, this.password);

      // TODO: implementar persistencia de sesión cuando rememberMe = true
      // (PocketBase ya persiste el authStore en localStorage por default; este flag
      // queda para distinguir entre "session-only" vs "persistent" si se decide acotar).

      if (mustChangePassword) {
        this.router.navigate(['/auth/cambiar-password-inicial']);
      } else {
        this.router.navigate(['/']);
      }
    } catch (err: unknown) {
      void err;
      this.errorMsg.set('Credenciales inválidas. Verificá tu email y contraseña.');
    } finally {
      this.loading.set(false);
    }
  }
}

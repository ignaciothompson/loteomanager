import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@loteomanager/shared-pb-client';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { MessageModule } from 'primeng/message';

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
    RippleModule,
    MessageModule
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  loading = signal(false);
  errorMsg = signal('');

  async login() {
    if (!this.email || !this.password) {
      this.errorMsg.set('Completá todos los campos.');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');

    try {
      const { mustChangePassword } = await this.authService.login(this.email, this.password);
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

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, POCKETBASE } from '@loteomanager/shared-pb-client';

import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-cambiar-password-inicial',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, PasswordModule, MessageModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="flex justify-center items-center min-h-screen surface-ground px-4">
      <div class="surface-card p-6 border-round shadow-4 w-full" style="max-width: 440px">
        <div class="text-center mb-5">
          <i class="pi pi-lock text-primary text-5xl mb-3 block"></i>
          <h2 class="text-900 font-bold text-2xl m-0">Establecé tu contraseña</h2>
          <p class="text-500 text-sm mt-2 mb-0">
            Esta es tu primera vez ingresando. Por seguridad, tenés que
            cambiar la contraseña temporal.
          </p>
        </div>

        @if (errorMsg()) {
          <p-message severity="error" [text]="errorMsg()!" styleClass="w-full mb-4" />
        }

        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="font-medium text-sm">Contraseña actual (la temporal)</label>
            <p-password
              [(ngModel)]="passwordActual"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
              placeholder="Tu contraseña temporal"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-medium text-sm">Nueva contraseña</label>
            <p-password
              [(ngModel)]="nuevaPassword"
              [feedback]="true"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-medium text-sm">Confirmar nueva contraseña</label>
            <p-password
              [(ngModel)]="confirmarPassword"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
              placeholder="Repetí la nueva contraseña"
            />
          </div>

          <p-button
            label="Guardar y entrar"
            icon="pi pi-arrow-right"
            iconPos="right"
            styleClass="w-full"
            [loading]="loading()"
            (click)="submit()"
          />
        </div>
      </div>
    </div>
  `,
})
export class CambiarPasswordInicialComponent {
  private pb = inject(POCKETBASE);
  private auth = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  passwordActual = '';
  nuevaPassword = '';
  confirmarPassword = '';
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  async submit(): Promise<void> {
    this.errorMsg.set(null);

    if (!this.passwordActual || !this.nuevaPassword || !this.confirmarPassword) {
      this.errorMsg.set('Completá todos los campos.');
      return;
    }
    if (this.nuevaPassword.length < 8) {
      this.errorMsg.set('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (this.nuevaPassword === this.passwordActual) {
      this.errorMsg.set('La nueva contraseña debe ser diferente a la actual.');
      return;
    }
    if (this.nuevaPassword.endsWith('1234')) {
      this.errorMsg.set('La nueva contraseña no puede terminar en "1234". Elegí una contraseña más segura.');
      return;
    }
    if (this.nuevaPassword !== this.confirmarPassword) {
      this.errorMsg.set('Las contraseñas no coinciden.');
      return;
    }

    const user = this.auth.currentUser();
    if (!user) {
      this.errorMsg.set('Sesión expirada. Por favor, volvé a iniciar sesión.');
      return;
    }

    this.loading.set(true);
    try {
      await this.pb.collection('users').update(user['id'] as string, {
        password: this.nuevaPassword,
        passwordConfirm: this.confirmarPassword,
        oldPassword: this.passwordActual,
        must_change_password: false,
      });

      // PocketBase invalida el token al cambiar password — re-autenticar
      await this.pb.collection('users').authWithPassword(
        user['email'] as string,
        this.nuevaPassword,
      );

      this.messageService.add({
        severity: 'success',
        summary: 'Contraseña actualizada',
        detail: 'Bienvenido al sistema.',
        life: 3000,
      });

      await this.router.navigate(['/']);
    } catch {
      this.errorMsg.set('No se pudo cambiar la contraseña. Verificá que la contraseña actual sea correcta.');
    } finally {
      this.loading.set(false);
    }
  }
}

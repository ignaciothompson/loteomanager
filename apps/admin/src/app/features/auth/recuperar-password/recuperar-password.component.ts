import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { POCKETBASE } from '@loteomanager/shared-pb-client';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule],
  templateUrl: './recuperar-password.component.html',
  styleUrls: ['./recuperar-password.component.css'],
})
export class RecuperarPasswordComponent {
  private pb = inject(POCKETBASE);

  email = '';
  loading = signal(false);
  sent = signal(false);
  error = signal<string | null>(null);

  async enviar() {
    if (!this.email) {
      this.error.set('Ingresá tu email.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.pb.collection('users').requestPasswordReset(this.email);
      this.sent.set(true);
    } catch {
      this.sent.set(true); // don't leak user existence
    } finally {
      this.loading.set(false);
    }
  }
}

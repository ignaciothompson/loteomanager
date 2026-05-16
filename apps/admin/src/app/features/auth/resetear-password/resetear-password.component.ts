import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { POCKETBASE } from '@loteomanager/shared-pb-client';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-resetear-password',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonModule, PasswordModule, MessageModule],
  templateUrl: './resetear-password.component.html',
  styleUrls: ['./resetear-password.component.css'],
})
export class ResetearPasswordComponent {
  private pb = inject(POCKETBASE);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  password = '';
  confirm = '';
  loading = signal(false);
  done = signal(false);
  error = signal<string | null>(null);

  async resetear() {
    if (!this.password || this.password !== this.confirm) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.pb.collection('users').confirmPasswordReset(token, this.password, this.confirm);
      this.done.set(true);
    } catch {
      this.error.set('El enlace expiró o es inválido. Solicitá uno nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}

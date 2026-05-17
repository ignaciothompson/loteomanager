import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

export interface PasswordTemporalInfo {
  name: string;
  email: string;
  password: string;
}

@Component({
  selector: 'app-password-temporal-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <p-dialog
      header="✓ Usuario creado correctamente"
      [visible]="visible"
      [modal]="true"
      [closable]="false"
      [dismissableMask]="false"
      [style]="{ width: '480px' }"
    >
      @if (info) {
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <span class="text-500 text-sm">Nombre</span>
            <span class="font-semibold">{{ info.name }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-500 text-sm">Email</span>
            <span class="font-semibold">{{ info.email }}</span>
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-500 text-sm">Contraseña temporal</span>
            <div class="flex items-center gap-2 border-1 border-round p-3 surface-100">
              <span class="font-mono text-xl font-bold flex-1 select-all">{{ info.password }}</span>
              <p-button
                icon="pi pi-copy"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                pTooltip="Copiar al portapapeles"
                (click)="copiar()"
              />
            </div>
          </div>

          <div class="flex gap-2 align-items-start p-3 border-round surface-50 border-1 border-yellow-400">
            <i class="pi pi-exclamation-triangle text-yellow-500 text-xl mt-1"></i>
            <div class="flex flex-col gap-1">
              <span class="font-semibold text-yellow-700">IMPORTANTE</span>
              <span class="text-sm text-700">
                Compartí esta contraseña con el usuario por un canal seguro
                (WhatsApp, mensaje directo, en persona). En su primer login
                se le pedirá obligatoriamente que la cambie.
              </span>
            </div>
          </div>
        </div>
      }

      <ng-template pTemplate="footer">
        <p-button
          label="Entendido"
          icon="pi pi-check"
          (click)="onConfirmar()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class PasswordTemporalDialogComponent {
  @Input() visible = false;
  @Input() info: PasswordTemporalInfo | null = null;
  @Output() confirmed = new EventEmitter<void>();

  private messageService = inject(MessageService);

  async copiar(): Promise<void> {
    if (!this.info) return;
    try {
      await navigator.clipboard.writeText(this.info.password);
      this.messageService.add({
        severity: 'success',
        summary: 'Copiado',
        detail: 'Contraseña copiada al portapapeles.',
        life: 2000,
      });
    } catch {
      this.messageService.add({
        severity: 'warn',
        summary: 'No se pudo copiar',
        detail: 'Copiá la contraseña manualmente.',
        life: 3000,
      });
    }
  }

  onConfirmar(): void {
    this.confirmed.emit();
  }
}

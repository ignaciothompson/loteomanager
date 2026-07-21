import { Component, input, signal, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  ContactoContextualFormComponent,
} from '../contacto-contextual-form/contacto-contextual-form.component';

/**
 * FAB flotante + dialog con formulario contextual.
 * Reemplaza contactar-fab / contactar-unidad-fab.
 */
@Component({
  selector: 'contacto-fab',
  standalone: true,
  imports: [CommonModule, DialogModule, ToastModule, ContactoContextualFormComponent],
  providers: [MessageService],
  template: `
    <button
      (click)="abrirModal()"
      class="contactar-fab fixed bottom-6 right-6 lg:bottom-8 lg:right-8 z-50
             px-5 py-3 lg:px-6 lg:py-4
             bg-primary text-white rounded-full shadow-2xl
             flex items-center gap-2
             hover:scale-105 active:scale-95 transition-transform"
      aria-label="Contactar"
    >
      <i class="pi pi-comments text-lg"></i>
      <span class="font-medium">Contactar</span>
    </button>

    <p-dialog
      [(visible)]="modalAbierto"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [closable]="!formRef?.enviando()"
      [style]="{ width: '90vw', maxWidth: '500px' }"
    >
      <ng-template pTemplate="header">
        <h2 class="text-xl font-semibold">Solicitar más información</h2>
      </ng-template>

      <contacto-contextual-form
        #formRef
        [barrioId]="barrioId()"
        [unidadId]="unidadId()"
        [comparativaId]="comparativaId()"
        [showCancel]="true"
        (cancel)="cerrarModal()"
        (success)="onSuccess()"
      />
    </p-dialog>

    <p-toast position="top-center" />
  `,
})
export class ContactoFabComponent {
  readonly barrioId = input<string | undefined>(undefined);
  readonly unidadId = input<string | undefined>(undefined);
  readonly comparativaId = input<string | undefined>(undefined);

  @ViewChild('formRef') formRef?: ContactoContextualFormComponent;

  private toast = inject(MessageService);

  modalAbierto = false;

  abrirModal(): void {
    this.modalAbierto = true;
    setTimeout(() => {
      this.formRef?.resetForm();
      this.formRef?.prepareTurnstile();
    }, 50);
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.formRef?.resetForm();
  }

  onSuccess(): void {
    this.toast.add({
      severity: 'success',
      summary: '¡Gracias!',
      detail: 'Nos pondremos en contacto pronto.',
      life: 4000,
    });
    this.cerrarModal();
  }
}

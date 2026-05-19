import { Component, Input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'descargar-pdf-fab',
  standalone: true,
  imports: [CommonModule, ToastModule],
  providers: [MessageService],
  template: `
    <button (click)="descargar()"
            [disabled]="generando()"
            class="descargar-pdf-fab fixed bottom-6 left-6 lg:bottom-8 lg:left-8 z-50
                   p-3 lg:p-4
                   bg-surface-0 text-surface-700 rounded-full shadow-xl
                   border border-surface-200
                   flex items-center gap-2
                   hover:scale-105 active:scale-95 transition-transform
                   disabled:opacity-60 disabled:cursor-not-allowed"
            [attr.aria-label]="generando() ? 'Generando PDF...' : 'Descargar PDF'">
      <i [class]="generando() ? 'pi pi-spin pi-spinner' : 'pi pi-file-pdf'" class="text-lg"></i>
      <span class="text-sm font-medium hidden lg:inline">
        {{ generando() ? 'Generando...' : 'Descargar PDF' }}
      </span>
    </button>

    <p-toast position="top-center" />
  `,
})
export class DescargarPdfFabComponent {
  @Input({ required: true }) token!: string;

  private toast = inject(MessageService);
  readonly generando = signal(false);

  async descargar() {
    if (this.generando()) return;
    this.generando.set(true);

    try {
      const resp = await fetch(`/api/comparativas/${this.token}/pdf`);
      if (!resp.ok) throw new Error('Error al generar el PDF');

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `propuesta-${this.token}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      this.toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo descargar el PDF. Intentá de nuevo.',
        life: 4000,
      });
    } finally {
      this.generando.set(false);
    }
  }
}

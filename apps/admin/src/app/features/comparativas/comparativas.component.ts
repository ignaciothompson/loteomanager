import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ComparativasService,
  InteresadosService,
  UnidadesService,
  AuthService
} from '@loteomanager/shared-pb-client';
import { ComparativasRecord, ComparativasResponse } from '@loteomanager/shared-types';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import {
  ComparativaFormDialogComponent,
  type ComparativaFormSavePayload
} from './dialogs/comparativa-form-dialog.component';

@Component({
  selector: 'app-comparativas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
    TooltipModule,
    ComparativaFormDialogComponent
  ],
  providers: [MessageService],
  templateUrl: './comparativas.component.html',
  styleUrl: './comparativas.component.css'
})
export class ComparativasComponent {
  @ViewChild(ComparativaFormDialogComponent)
  private formDialog?: ComparativaFormDialogComponent;

  private comparativasService = inject(ComparativasService);
  private interesadosService = inject(InteresadosService);
  private unidadesService = inject(UnidadesService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  comparativas = this.comparativasService.list(undefined, { sort: '-created' });
  interesados = this.interesadosService.list();
  unidades = this.unidadesService.list();

  filterCliente = signal('');
  filterTitulo = signal('');

  displayDialog = signal(false);

  unidadesDisponibles = computed(() =>
    this.unidades().filter((u) => u.estado === 'disponible')
  );

  comparativasFiltradas = computed(() => {
    let rows = this.comparativas();
    const cliente = this.filterCliente().trim().toLowerCase();
    const titulo = this.filterTitulo().trim().toLowerCase();
    if (cliente) {
      rows = rows.filter((c) =>
        (c.cliente_destinatario_nombre || '').toLowerCase().includes(cliente)
      );
    }
    if (titulo) rows = rows.filter((c) => (c.titulo || '').toLowerCase().includes(titulo));
    return rows;
  });

  hasActiveFilters = computed(
    () => !!this.filterCliente().trim() || !!this.filterTitulo().trim()
  );

  clearFilters(): void {
    this.filterCliente.set('');
    this.filterTitulo.set('');
  }

  openNew(): void {
    this.displayDialog.set(true);
  }

  async onSave(payload: ComparativaFormSavePayload): Promise<void> {
    try {
      const interesado = this.interesados().find((i) => i.id === payload.interesadoId);
      const body: Partial<ComparativasRecord> = {
        creado_por: this.authService.currentUser()?.['id'] as string,
        tipo: 'comparacion_multiple',
        titulo: 'Comparativa de Lotes',
        unidades_ids: payload.unidades_ids,
        mensaje_personalizado: payload.mensaje_personalizado || '',
        token_publico: Math.random().toString(36).substring(2, 15)
      };
      if (interesado) {
        body.cliente_destinatario_nombre = interesado.nombre;
        body.cliente_destinatario_email = interesado.email;
      }

      const response = await this.comparativasService.crear(
        body as Omit<ComparativasRecord, 'id'>
      );

      if (payload.interesadoId) {
        await this.interesadosService.update(payload.interesadoId, {
          comparativa_id: response.record.id
        });
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Comparativa generada',
        detail: response.url,
        life: 10000
      });
      this.displayDialog.set(false);
      this.comparativas.reload();
    } catch (err: unknown) {
      this.formDialog?.stopSaving();
      const msg = err instanceof Error ? err.message : 'Error al generar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async deleteComparativa(comp: ComparativasResponse): Promise<void> {
    if (!confirm('¿Estás seguro de eliminar este enlace comparativo?')) return;
    try {
      await this.comparativasService.delete(comp.id);
      this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Comparativa eliminada' });
      this.comparativas.reload();
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar' });
    }
  }

  copyLink(token: string): void {
    void navigator.clipboard.writeText(this.publicUrl(token)).then(() => {
      this.messageService.add({
        severity: 'info',
        summary: 'Copiado',
        detail: 'Enlace copiado al portapapeles'
      });
    });
  }

  publicUrl(token: string): string {
    return `${this.comparativasService.getLandingBaseUrl()}/c/${token}`;
  }
}

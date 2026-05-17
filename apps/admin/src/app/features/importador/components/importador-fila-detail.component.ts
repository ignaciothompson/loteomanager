import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { ImportacionFilasResponse } from '@loteomanager/shared-types';
import { ImportadorService } from '../services/importador.service';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

export interface FilaExtendida extends ImportacionFilasResponse {
  tipo_fila: 'barrio' | 'unidad';
  mensajes: string[];
  registro_creado_id?: string;
  error_aplicacion?: string;
}

@Component({
  selector: 'app-importador-fila-detail',
  standalone: true,
  imports: [JsonPipe, DialogModule, ButtonModule],
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="close()"
      [header]="'Detalle fila #' + (fila?.numero_fila ?? '')"
      [modal]="true"
      [style]="{ width: '70vw' }"
      [draggable]="false"
      [resizable]="false"
    >
      @if (fila) {
        <!-- Mensajes -->
        @if (fila.mensajes?.length) {
          <div class="mb-4">
            <h6 class="mt-0 mb-2">Mensajes</h6>
            <ul class="pl-3 m-0">
              @for (msg of fila.mensajes; track msg) {
                <li class="text-sm mb-1">
                  <i class="pi pi-info-circle mr-1 text-400"></i>
                  {{ msg }}
                </li>
              }
            </ul>
          </div>
        }

        <div class="grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <!-- Datos originales -->
          <div>
            <h6 class="mt-0 mb-2">Datos originales</h6>
            <pre class="surface-100 border-round p-3 text-xs overflow-auto" style="max-height: 300px; white-space: pre-wrap; word-break: break-all;">{{ fila.datos_originales | json }}</pre>
          </div>
          <!-- Datos normalizados -->
          <div>
            <h6 class="mt-0 mb-2">Datos normalizados</h6>
            <pre class="surface-100 border-round p-3 text-xs overflow-auto" style="max-height: 300px; white-space: pre-wrap; word-break: break-all;">{{ fila.datos_normalizados | json }}</pre>
          </div>
        </div>

        <!-- Error de aplicación -->
        @if (fila.error_aplicacion) {
          <div class="mt-3 p-3 border-round" style="background: #fef2f2; border: 1px solid #fca5a5;">
            <i class="pi pi-times-circle mr-2 text-red-500"></i>
            <span class="text-sm text-red-700">{{ fila.error_aplicacion }}</span>
          </div>
        }
      }

      <ng-template pTemplate="footer">
        <p-button
          label="Cerrar"
          severity="secondary"
          [text]="true"
          (click)="close()"
        />
        <p-button
          label="Guardar cambios"
          icon="pi pi-check"
          [loading]="saving()"
          (click)="guardar()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class ImportadorFilaDetailComponent implements OnChanges {
  @Input() visible = false;
  @Input() fila: FilaExtendida | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  private importadorService = inject(ImportadorService);
  private messageService = inject(MessageService);

  saving = signal(false);
  editedData = signal<Record<string, unknown>>({});

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fila'] && this.fila) {
      this.editedData.set({ ...(this.fila.datos_normalizados as Record<string, unknown>) });
    }
  }

  async guardar(): Promise<void> {
    if (!this.fila) return;
    this.saving.set(true);
    try {
      await this.importadorService.editarFila(this.fila.id, this.editedData());
      this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Fila actualizada correctamente.' });
      this.saved.emit();
      this.close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar la fila.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      console.error('[ImportadorFilaDetailComponent] guardar:', err);
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.visibleChange.emit(false);
  }
}

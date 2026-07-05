import { JsonPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FilaExtendida } from '../importador-types';
import type { BarrioNormalizado, UnidadNormalizado } from '../parser/types';
import { ImportadorService } from '../services/importador.service';
import { MessageService } from 'primeng/api';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-detalle-drawer',
  standalone: true,
  imports: [
    JsonPipe,
    FormsModule,
    DrawerModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
  ],
  template: `
    <p-drawer
      [visible]="visible"
      (visibleChange)="visibleChange.emit($event)"
      [header]="'Fila #' + (fila?.numero_fila ?? '') + ' — ' + (fila?.tipo_fila ?? '')"
      position="right"
      [style]="{ width: 'min(28rem, 95vw)' }"
    >
      @if (fila) {
        @if (mensajesFila().length) {
          <ul class="pl-3 mt-0 mb-4 text-sm">
            @for (msg of mensajesFila(); track msg) {
              <li class="mb-1">{{ msg }}</li>
            }
          </ul>
        }

        <h6 class="mt-0">Datos originales (Excel)</h6>
        <pre class="surface-100 border-round p-2 text-xs mb-4 overflow-auto" style="max-height: 8rem;">{{ fila.datos_originales | json }}</pre>

        <h6>Datos a guardar</h6>
        @if (fila.tipo_fila === 'barrio' && barrioDraft()) {
          <div class="flex flex-col gap-3">
            <div>
              <label class="text-sm font-semibold block mb-1">Nombre</label>
              <input pInputText class="w-full" [(ngModel)]="barrioDraft()!.nombre" />
            </div>
            <div>
              <label class="text-sm font-semibold block mb-1">Slug</label>
              <input pInputText class="w-full" [(ngModel)]="barrioDraft()!.slug" />
            </div>
            <div>
              <label class="text-sm font-semibold block mb-1">Zona (texto)</label>
              <input pInputText class="w-full" [(ngModel)]="barrioDraft()!.zona" />
            </div>
            <div>
              <label class="text-sm font-semibold block mb-1">Descripción</label>
              <input pInputText class="w-full" [(ngModel)]="barrioDraft()!.descripcion" />
            </div>
          </div>
        } @else if (fila.tipo_fila === 'unidad' && unidadDraft()) {
          <div class="flex flex-col gap-3">
            <div>
              <label class="text-sm font-semibold block mb-1">Número lote</label>
              <input pInputText class="w-full" [(ngModel)]="unidadDraft()!.codigo" />
            </div>
            <div>
              <label class="text-sm font-semibold block mb-1">m²</label>
              <p-inputNumber class="w-full" [(ngModel)]="unidadDraft()!.metros_cuadrados" [minFractionDigits]="0" />
            </div>
            <div>
              <label class="text-sm font-semibold block mb-1">Precio</label>
              <p-inputNumber class="w-full" [(ngModel)]="unidadDraft()!.precio" [minFractionDigits]="0" />
            </div>
            <div>
              <label class="text-sm font-semibold block mb-1">Moneda</label>
              <p-select
                [options]="monedaOpts"
                [(ngModel)]="unidadDraft()!.moneda"
                optionLabel="label"
                optionValue="value"
                appendTo="body"
                class="w-full"
              />
            </div>
            <div>
              <label class="text-sm font-semibold block mb-1">Estado</label>
              <input pInputText class="w-full" [(ngModel)]="unidadDraft()!.estado" />
            </div>
            <div>
              <label class="text-sm font-semibold block mb-1">Orientación</label>
              <input pInputText class="w-full" [(ngModel)]="unidadDraft()!.orientacion" />
            </div>
          </div>
        }

        @if (fila.error_aplicacion) {
          <p class="text-red-600 text-sm mt-3">{{ fila.error_aplicacion }}</p>
        }

        <div class="flex gap-2 mt-4 pt-3 border-top-1 surface-border">
          <p-button label="Cerrar" [text]="true" (click)="visibleChange.emit(false)" />
          <p-button label="Guardar cambios" icon="pi pi-check" [loading]="saving()" (click)="guardar()" />
        </div>
      }
    </p-drawer>
  `,
})
export class DetalleDrawerComponent implements OnChanges {
  @Input() visible = false;
  @Input() fila: FilaExtendida | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  private importadorService = inject(ImportadorService);
  private messageService = inject(MessageService);

  saving = signal(false);
  barrioDraft = signal<BarrioNormalizado | null>(null);
  unidadDraft = signal<UnidadNormalizado | null>(null);

  readonly monedaOpts = [
    { label: 'USD', value: 'USD' as const },
    { label: 'ARS', value: 'ARS' as const },
  ];

  mensajesFila(): string[] {
    const raw = this.fila?.mensajes;
    if (Array.isArray(raw)) return raw.filter((m): m is string => typeof m === 'string');
    return this.fila?.mensaje ? [this.fila.mensaje] : [];
  }

  ngOnChanges(): void {
    if (!this.fila) {
      this.barrioDraft.set(null);
      this.unidadDraft.set(null);
      return;
    }
    const norm = this.fila.datos_normalizados;
    if (this.fila.tipo_fila === 'barrio') {
      this.barrioDraft.set({ ...(norm as BarrioNormalizado) });
      this.unidadDraft.set(null);
    } else {
      this.unidadDraft.set({ ...(norm as UnidadNormalizado) });
      this.barrioDraft.set(null);
    }
  }

  async guardar(): Promise<void> {
    if (!this.fila) return;
    this.saving.set(true);
    try {
      const payload =
        this.fila.tipo_fila === 'barrio'
          ? (this.barrioDraft() as BarrioNormalizado)
          : (this.unidadDraft() as UnidadNormalizado);
      if (this.fila.tipo_fila === 'unidad' && payload) {
        const u = payload as UnidadNormalizado;
        u.area_m2 = u.metros_cuadrados;
      }
      await this.importadorService.editarFila(this.fila.id, payload);
      this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Fila revalidada.' });
      this.saved.emit();
      this.visibleChange.emit(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.saving.set(false);
    }
  }
}

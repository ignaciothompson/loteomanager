import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImportacionesResponse } from '@loteomanager/shared-types';
import { DefinicionesCacheService } from '@loteomanager/shared-pb-client';
import { MapeoExtras } from '../parser/types';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';

interface ImportacionExtendida extends ImportacionesResponse {
  mapeo_extras?: Record<string, string | null>;
}

interface SelectOpcion {
  label: string;
  value: string | null;
}

@Component({
  selector: 'app-mapeo-extras-dialog',
  standalone: true,
  imports: [FormsModule, DialogModule, ButtonModule, SelectModule],
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="close()"
      header="Mapeo de extras no reconocidos"
      [modal]="true"
      [style]="{ width: '50vw' }"
      [draggable]="false"
      [resizable]="false"
    >
      <p class="text-500 text-sm mt-0 mb-4">
        Las siguientes columnas de extras no fueron asociadas a un extra del sistema.
        Asigná el extra correspondiente o "Ignorar" si no aplica.
      </p>

      @if (extrasParaMapear().length === 0) {
        <p class="text-500 text-center py-4">No hay extras sin mapear.</p>
      } @else {
        <div class="flex flex-column gap-3">
          @for (header of extrasParaMapear(); track header) {
            <div class="flex align-items-center gap-3">
              <span class="flex-1 font-mono text-sm surface-100 border-round px-2 py-1">{{ header }}</span>
              <p-select
                [options]="opciones()"
                [ngModel]="mapeoLocal()[header]"
                (ngModelChange)="setMapeoExtra(header, $event)"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccionar extra del sistema…"
                styleClass="flex-1"
              />
            </div>
          }
        </div>
      }

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" severity="secondary" [text]="true" (click)="close()" />
        <p-button label="Guardar mapeo" icon="pi pi-check" (click)="guardar()" />
      </ng-template>
    </p-dialog>
  `,
})
export class MapeoExtrasDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() importacion: ImportacionesResponse | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() guardado = new EventEmitter<MapeoExtras>();

  private definicionesCacheService = inject(DefinicionesCacheService);

  mapeoLocal = signal<MapeoExtras>({});

  extrasDisponibles = computed(() =>
    this.definicionesCacheService.extras().filter(e => e.activo)
  );

  opciones = computed<SelectOpcion[]>(() => [
    { label: 'Ignorar este extra', value: null },
    ...this.extrasDisponibles().map(e => ({
      label: `${e.nombre} (${e.entidad})`,
      value: e.id,
    })),
  ]);

  extrasParaMapear = computed(() => {
    const m = this.mapeoLocal();
    return Object.keys(m).filter(k => m[k] === null);
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['importacion'] && this.importacion) {
      const mapeo = (this.importacion as ImportacionExtendida).mapeo_extras ?? {};
      const pendientes: MapeoExtras = {};
      for (const [key, value] of Object.entries(mapeo)) {
        if (value === null) {
          pendientes[key] = null;
        }
      }
      this.mapeoLocal.set(pendientes);
    }
  }

  setMapeoExtra(header: string, extraId: string | null): void {
    this.mapeoLocal.update(m => ({ ...m, [header]: extraId }));
  }

  guardar(): void {
    this.guardado.emit({ ...this.mapeoLocal() });
    this.close();
  }

  close(): void {
    this.visibleChange.emit(false);
  }
}

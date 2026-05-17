import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImportacionesResponse } from '@loteomanager/shared-types';
import { MapeoColumnas, COLUMNAS_BARRIO, COLUMNAS_UNIDAD } from '../parser/types';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';

interface ImportacionExtendida extends ImportacionesResponse {
  mapeo_columnas?: Record<string, string | null>;
}

interface SelectOpcion {
  label: string;
  value: string | null;
}

@Component({
  selector: 'app-mapeo-columnas-dialog',
  standalone: true,
  imports: [FormsModule, DialogModule, ButtonModule, SelectModule],
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="close()"
      header="Mapeo de columnas no reconocidas"
      [modal]="true"
      [style]="{ width: '50vw' }"
      [draggable]="false"
      [resizable]="false"
    >
      <p class="text-500 text-sm mt-0 mb-4">
        Las siguientes columnas del archivo Excel no fueron reconocidas automáticamente.
        Asigná el campo destino correspondiente o "Ignorar" si no aplica.
      </p>

      @if (columnasParaMapear().length === 0) {
        <p class="text-500 text-center py-4">No hay columnas sin mapear.</p>
      } @else {
        <div class="flex flex-column gap-3">
          @for (col of columnasParaMapear(); track col) {
            <div class="flex align-items-center gap-3">
              <span class="flex-1 font-mono text-sm surface-100 border-round px-2 py-1">{{ col }}</span>
              <p-select
                [options]="opciones"
                [ngModel]="mapeoLocal()[col]"
                (ngModelChange)="setMapeoColumna(col, $event)"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccionar campo destino…"
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
export class MapeoColumnasDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() importacion: ImportacionesResponse | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() guardado = new EventEmitter<MapeoColumnas>();

  mapeoLocal = signal<MapeoColumnas>({});

  readonly camposDisponibles = [
    'tipo',
    ...new Set([...Object.keys(COLUMNAS_BARRIO), ...Object.keys(COLUMNAS_UNIDAD)]),
  ];

  readonly opciones: SelectOpcion[] = [
    { label: 'Ignorar columna', value: null },
    ...this.camposDisponibles.map(f => ({ label: f, value: f })),
  ];

  columnasParaMapear = computed(() => {
    const m = this.mapeoLocal();
    return Object.keys(m).filter(k => m[k] === null);
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['importacion'] && this.importacion) {
      const mapeo = (this.importacion as ImportacionExtendida).mapeo_columnas ?? {};
      const pendientes: MapeoColumnas = {};
      for (const [key, value] of Object.entries(mapeo)) {
        if (value === null) {
          pendientes[key] = null;
        }
      }
      this.mapeoLocal.set(pendientes);
    }
  }

  setMapeoColumna(columna: string, campo: string | null): void {
    this.mapeoLocal.update(m => ({ ...m, [columna]: campo }));
  }

  guardar(): void {
    this.guardado.emit({ ...this.mapeoLocal() });
    this.close();
  }

  close(): void {
    this.visibleChange.emit(false);
  }
}

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { previewPatronRango, TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
import type { TipoUnidadIngreso } from '@loteomanager/shared-types';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ButtonModule } from 'primeng/button';
import type { PlantillaDraft } from './ingreso-unidades.types';
import { newLocalId } from './ingreso-unidades.types';

@Component({
  selector: 'app-plantilla-unidad-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    ToggleSwitchModule,
    ButtonModule
  ],
  templateUrl: './plantilla-unidad-form.component.html'
})
export class PlantillaUnidadFormComponent {
  tipo = input.required<TipoUnidadIngreso>();
  plantillas = input.required<PlantillaDraft[]>();
  plantillasChange = output<PlantillaDraft[]>();

  readonly showOrientacion = computed(() => this.tipo() === 'lote_vacio');
  readonly showModelo = computed(() => this.tipo() === 'casa_prefabricada');
  readonly tipoLabel = computed(() => TIPO_UNIDAD_LABELS[this.tipo()]);

  readonly monedaOpts = [
    { label: 'USD', value: 'USD' },
    { label: 'UYU', value: 'UYU' }
  ];

  readonly orientacionOpts = [
    'Norte', 'Sur', 'Este', 'Oeste', 'Noreste', 'Noroeste', 'Sureste', 'Suroeste'
  ].map((v) => ({ label: v, value: v }));

  readonly estadoOpts = [
    { label: 'Disponible', value: 'disponible' },
    { label: 'Reservado', value: 'reservado' },
    { label: 'Bloqueado', value: 'bloqueado' }
  ];

  draft: PlantillaDraft = this.emptyDraft();

  preview(): string {
    return previewPatronRango(this.draft.patron_codigo, this.draft.cantidad);
  }

  agregar(): void {
    if (!this.draft.nombre.trim() || !this.draft.patron_codigo.trim() || this.draft.cantidad < 1) {
      return;
    }
    this.plantillasChange.emit([...this.plantillas(), { ...this.draft, localId: newLocalId() }]);
    this.draft = this.emptyDraft();
  }

  quitar(localId: string): void {
    this.plantillasChange.emit(this.plantillas().filter((p) => p.localId !== localId));
  }

  private emptyDraft(): PlantillaDraft {
    return {
      localId: newLocalId(),
      nombre: '',
      patron_codigo: 'A-{n}',
      cantidad: 1,
      moneda: 'USD',
      estado_inicial: 'disponible',
      web_visible: true
    };
  }
}

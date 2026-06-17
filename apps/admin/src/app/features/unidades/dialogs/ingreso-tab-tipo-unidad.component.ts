import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
import type { TipoUnidadIngreso } from '@loteomanager/shared-types';
import { SelectButtonModule } from 'primeng/selectbutton';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ButtonModule } from 'primeng/button';
import { PlantillaUnidadFormComponent } from './plantilla-unidad-form.component';
import type { TipoUnidadDraft, UnidadIndividualDraft } from './ingreso-unidades.types';
import { newLocalId } from './ingreso-unidades.types';

@Component({
  selector: 'app-ingreso-tab-tipo-unidad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    SelectButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    ToggleSwitchModule,
    ButtonModule,
    PlantillaUnidadFormComponent
  ],
  templateUrl: './ingreso-tab-tipo-unidad.component.html'
})
export class IngresoTabTipoUnidadComponent {
  tipo = input.required<TipoUnidadIngreso>();
  draft = model.required<TipoUnidadDraft>();

  readonly tipoLabel = computed(() => TIPO_UNIDAD_LABELS[this.tipo()]);
  readonly showOrientacion = computed(() => this.tipo() === 'lote_vacio');
  readonly showModelo = computed(() => this.tipo() === 'casa_prefabricada');

  modoOpts = [
    { label: 'Plantilla (masivo)', value: 'plantilla' },
    { label: 'Uno por uno', value: 'individual' }
  ];

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

  individualDraft: UnidadIndividualDraft = this.emptyIndividual();

  onPlantillasChange(plantillas: TipoUnidadDraft['plantillas']): void {
    this.draft.update((d) => ({ ...d, plantillas }));
  }

  agregarIndividual(): void {
    if (!this.individualDraft.codigo.trim()) return;
    this.draft.update((d) => ({
      ...d,
      individuales: [...d.individuales, { ...this.individualDraft, localId: newLocalId() }]
    }));
    this.individualDraft = this.emptyIndividual();
  }

  quitarIndividual(localId: string): void {
    this.draft.update((d) => ({
      ...d,
      individuales: d.individuales.filter((u) => u.localId !== localId)
    }));
  }

  private emptyIndividual(): UnidadIndividualDraft {
    return {
      localId: newLocalId(),
      codigo: '',
      moneda: 'USD',
      estado: 'disponible',
      web_visible: true
    };
  }
}

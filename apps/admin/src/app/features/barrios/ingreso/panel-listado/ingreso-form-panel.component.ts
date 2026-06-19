import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { TipoUnidadIngreso, UnidadesOrientacionOptions } from '@loteomanager/shared-types';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import type { IngresoFormMode, IngresoUnidadForm } from '../../../unidades/dialogs/ingreso-unidades.types';
import { ExtrasEditorComponent } from '../../../../shared/components/extras-editor/extras-editor.component';

const FORM_TABS: { value: TipoUnidadIngreso; label: string }[] = [
  { value: 'lote_vacio', label: 'Lote' },
  { value: 'casa_construida', label: 'Casa' },
  { value: 'casa_prefabricada', label: 'Prefab' }
];

const ORIENTACION_OPTS: { label: string; value: UnidadesOrientacionOptions }[] = [
  'Norte', 'Sur', 'Este', 'Oeste', 'Noreste', 'Noroeste', 'Sureste', 'Suroeste'
].map((v) => ({ label: v, value: v as UnidadesOrientacionOptions }));

@Component({
  selector: 'app-ingreso-form-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TabsModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    ExtrasEditorComponent
  ],
  templateUrl: './ingreso-form-panel.component.html',
  styleUrl: './ingreso-form-panel.component.css'
})
export class IngresoFormPanelComponent {
  formTab = model.required<TipoUnidadIngreso>();
  formMode = input<IngresoFormMode>('nuevo');
  usandoPlantilla = input(false);
  unidadForm = model.required<IngresoUnidadForm>();
  estadoOpts = input<{ label: string; value: string }[]>([]);
  disabled = input(false);

  readonly formTabs = FORM_TABS;
  readonly orientacionOpts = ORIENTACION_OPTS;
  readonly monedaOpts = [
    { label: 'USD', value: 'USD' },
    { label: 'UYU', value: 'UYU' }
  ];

  modeLabel(): string {
    if (this.usandoPlantilla()) return 'Desde plantilla';
    switch (this.formMode()) {
      case 'editando':
        return 'Editando';
      default:
        return 'Nuevo';
    }
  }

  isEditMode(): boolean {
    return this.formMode() === 'editando';
  }

  onUnidadExtrasChange(extras: Record<string, unknown>): void {
    this.unidadForm.update((f) => ({ ...f, extras }));
  }
}

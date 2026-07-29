import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { ExtraPersistido, TipoUnidadIngreso, UnidadesOrientacionOptions } from '@loteomanager/shared-types';
import { ExtrasEditorComponent } from '@loteomanager/shared-ui';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import type { IngresoFormMode, IngresoUnidadForm } from '../ingreso-unidades.types';

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
  /** Tipos habilitados en el barrio; vacío = todos. */
  tiposUnidad = input<TipoUnidadIngreso[]>([]);

  readonly extrasFilter = signal('');

  readonly formTabs = computed(() => {
    const allowed = this.tiposUnidad();
    if (!allowed.length) return FORM_TABS;
    const set = new Set(allowed);
    const filtered = FORM_TABS.filter((t) => set.has(t.value));
    return filtered.length ? filtered : FORM_TABS;
  });

  readonly orientacionOpts = ORIENTACION_OPTS;
  readonly monedaOpts = [
    { label: 'USD', value: 'USD' },
    { label: 'UYU', value: 'UYU' }
  ];

  constructor() {
    effect(() => {
      const tabs = this.formTabs();
      const current = this.formTab();
      if (tabs.length && !tabs.some((t) => t.value === current)) {
        this.formTab.set(tabs[0].value);
      }
    });
  }

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

  onUnidadExtrasChange(extras: ExtraPersistido[]): void {
    this.unidadForm.update((f) => ({ ...f, extras }));
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl
} from '@angular/forms';
import type { InteresadosResponse, UnidadesResponse } from '@loteomanager/shared-types';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { TextareaModule } from 'primeng/textarea';
import { RippleModule } from 'primeng/ripple';

export type ComparativaFormSavePayload = {
  interesadoId: string;
  unidades_ids: string[];
  mensaje_personalizado: string;
};

@Component({
  selector: 'app-comparativa-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    SelectModule,
    MultiSelectModule,
    TextareaModule,
    RippleModule
  ],
  templateUrl: './comparativa-form-dialog.component.html',
  styleUrl: './comparativa-form-dialog.component.scss'
})
export class ComparativaFormDialogComponent {
  private fb = inject(FormBuilder);

  visible = input(false);
  interesados = input<InteresadosResponse[]>([]);
  unidadesDisponibles = input<UnidadesResponse[]>([]);

  visibleChange = output<boolean>();
  save = output<ComparativaFormSavePayload>();

  saving = signal(false);

  form = this.fb.nonNullable.group({
    interesadoId: ['', Validators.required],
    unidades_ids: [[] as string[], Validators.required],
    mensaje_personalizado: ['']
  });

  canSubmit = computed(() => {
    const v = this.form.getRawValue();
    return !!v.interesadoId && v.unidades_ids.length > 0;
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.form.reset({
          interesadoId: '',
          unidades_ids: [],
          mensaje_personalizado: ''
        });
        this.saving.set(false);
      }
    });
  }

  showError(ctrl: AbstractControl | null): boolean {
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    if (!raw.unidades_ids.length) return;
    this.saving.set(true);
    this.save.emit({
      interesadoId: raw.interesadoId,
      unidades_ids: raw.unidades_ids,
      mensaje_personalizado: raw.mensaje_personalizado
    });
  }

  onCancel(): void {
    this.visibleChange.emit(false);
  }

  stopSaving(): void {
    this.saving.set(false);
  }
}

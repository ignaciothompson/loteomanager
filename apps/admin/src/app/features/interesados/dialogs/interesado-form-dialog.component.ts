import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators, type AbstractControl } from '@angular/forms';
import { ExtraPersistido, InteresadosRecord } from '@loteomanager/shared-types';
import { DefinicionesCacheService } from '@loteomanager/shared-pb-client';
import { ExtrasEditorComponent } from '@loteomanager/shared-ui';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';

export type InteresadoFormSavePayload = {
  interesado: Partial<InteresadosRecord>;
  extras: ExtraPersistido[];
};

@Component({
  selector: 'app-interesado-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    TooltipModule,
    RippleModule,
    ExtrasEditorComponent
  ],
  templateUrl: './interesado-form-dialog.component.html',
  styleUrl: './interesado-form-dialog.component.scss'
})
export class InteresadoFormDialogComponent {
  private fb = inject(FormBuilder);
  definicionesCache = inject(DefinicionesCacheService);

  visible = input<boolean>(false);
  isEdit = input<boolean>(false);
  currentInteresado = input<Partial<InteresadosRecord>>({});
  extrasData = input<ExtraPersistido[]>([]);

  visibleChange = output<boolean>();
  save = output<InteresadoFormSavePayload>();

  saving = signal(false);
  extras = model<ExtraPersistido[]>([]);

  form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    email: [''],
    telefono: [''],
    estado: ['nuevo'],
    origen: ['manual'],
    notas_internas: [''],
    mensaje: [''],
  });

  estadoOpts = computed(() =>
    this.definicionesCache.estadosActivosPara('interesados').map((s) => ({
      label: s.nombre,
      value: s.code
    }))
  );

  origenOpts: { label: string; value: string }[] = [
    { label: 'Manual', value: 'manual' },
    { label: 'Web', value: 'web' },
  ];

  constructor() {
    effect(() => {
      const data = this.currentInteresado();
      if (this.visible()) {
        this.extras.set([...this.extrasData()]);
        this.form.reset({
          nombre: data.nombre ?? '',
          email: data.email ?? '',
          telefono: data.telefono ?? '',
          estado: data.estado ?? 'nuevo',
          origen: data.origen ?? 'manual',
          notas_internas: data.notas_internas ?? '',
          mensaje: data.mensaje ?? '',
        });
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
    this.saving.set(true);
    this.save.emit({
      interesado: this.form.getRawValue() as Partial<InteresadosRecord>,
      extras: this.extras()
    });
  }

  onCancel(): void {
    this.visibleChange.emit(false);
  }

  stopSaving(): void {
    this.saving.set(false);
  }
}

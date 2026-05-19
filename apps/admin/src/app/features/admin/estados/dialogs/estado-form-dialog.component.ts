import {
  ChangeDetectionStrategy,
  Component,
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
import type { EntidadEstado, EstadoDefinicion } from '@loteomanager/shared-types';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { RippleModule } from 'primeng/ripple';

export type EstadoFormSavePayload = {
  id: string | null;
  body: Record<string, unknown>;
};

@Component({
  selector: 'app-estado-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ToggleSwitchModule,
    RippleModule
  ],
  templateUrl: './estado-form-dialog.component.html',
  styleUrl: './estado-form-dialog.component.scss'
})
export class EstadoFormDialogComponent {
  private fb = inject(FormBuilder);
  private toast = inject(MessageService);

  visible = input(false);
  editingId = input<string | null>(null);
  currentEstado = input<Partial<EstadoDefinicion>>({});

  visibleChange = output<boolean>();
  save = output<EstadoFormSavePayload>();

  saving = signal(false);

  entidadesOpts = [
    { label: 'Unidades', value: 'unidades' as EntidadEstado },
    { label: 'Interesados', value: 'interesados' as EntidadEstado }
  ];

  form = this.fb.nonNullable.group({
    entidad: ['unidades' as EntidadEstado, Validators.required],
    code: ['', Validators.required],
    nombre: ['', Validators.required],
    color: ['#6366f1'],
    icono: [''],
    orden_display: [0],
    activo: [true]
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const row = this.currentEstado();
      const id = this.editingId();
      this.form.reset({
        entidad: row.entidad ?? 'unidades',
        code: row.code ?? '',
        nombre: row.nombre ?? '',
        color: row.color ?? '#6366f1',
        icono: row.icono ?? '',
        orden_display: row.orden_display ?? 0,
        activo: row.activo !== false
      });
      if (id) {
        this.form.controls.entidad.disable();
        this.form.controls.code.disable();
      } else {
        this.form.controls.entidad.enable();
        this.form.controls.code.enable();
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
    const code = raw.code.trim();
    if (!this.editingId() && !/^[a-z][a-z0-9_]*$/.test(code)) {
      this.toast.add({
        severity: 'error',
        summary: 'Code inválido',
        detail: 'snake_case: letra minúscula inicial, luego letras/números/_'
      });
      return;
    }
    this.saving.set(true);
    this.save.emit({
      id: this.editingId(),
      body: {
        entidad: raw.entidad,
        code,
        nombre: raw.nombre.trim(),
        color: raw.color || '#6366f1',
        icono: raw.icono || '',
        orden_display: Number(raw.orden_display) || 0,
        activo: raw.activo
      }
    });
  }

  onCancel(): void {
    this.visibleChange.emit(false);
  }

  stopSaving(): void {
    this.saving.set(false);
  }
}

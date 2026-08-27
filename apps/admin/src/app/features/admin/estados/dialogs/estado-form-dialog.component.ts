import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl
} from '@angular/forms';
import type { EntidadEstado, EstadoDefinicion } from '@loteomanager/shared-types';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { RippleModule } from 'primeng/ripple';

export type EstadoFormSavePayload = {
  id: string | null;
  body: Record<string, unknown>;
  createAnother: boolean;
};

@Component({
  selector: 'app-estado-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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

  visible = input(false);
  editingId = input<string | null>(null);
  currentEstado = input<Partial<EstadoDefinicion>>({});

  visibleChange = output<boolean>();
  save = output<EstadoFormSavePayload>();

  saving = signal(false);
  formError = signal<string | null>(null);

  @ViewChild('nombreInput') nombreInput?: ElementRef<HTMLInputElement>;

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

  private formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );

  preview = computed(() => {
    const v = this.formValue();
    const color = v.color || '#6366f1';
    const icon = (v.icono || '').trim();
    return {
      label: (v.nombre || '').trim() || 'Estado',
      color,
      bg: color + '22',
      iconClass: !icon ? '' : icon.startsWith('pi') ? icon : `pi ${icon}`
    };
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
      this.saving.set(false);
      this.formError.set(null);
      if (id) {
        this.form.controls.entidad.disable();
        this.form.controls.code.disable();
      } else {
        this.form.controls.entidad.enable();
        this.form.controls.code.enable();
      }
    });
  }

  isDirty(): boolean {
    return this.form.dirty;
  }

  showError(ctrl: AbstractControl | null): boolean {
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  onSubmit(createAnother = false): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const code = raw.code.trim();
    if (!this.editingId() && !/^[a-z][a-z0-9_]*$/.test(code)) {
      this.formError.set('Code inválido. snake_case: letra minúscula inicial, luego letras/números/_');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    this.save.emit({
      id: this.editingId(),
      createAnother,
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
    if (this.saving()) return;
    this.visibleChange.emit(false);
  }

  onShow(): void {
    queueMicrotask(() => this.nombreInput?.nativeElement.focus());
  }

  setFormError(msg: string): void {
    this.saving.set(false);
    this.formError.set(msg);
  }

  resetForAnother(): void {
    this.saving.set(false);
    this.formError.set(null);
    this.form.reset({
      entidad: this.form.getRawValue().entidad,
      code: '',
      nombre: '',
      color: '#6366f1',
      icono: '',
      orden_display: 0,
      activo: true
    });
    queueMicrotask(() => this.nombreInput?.nativeElement.focus());
  }

  stopSaving(): void {
    this.saving.set(false);
  }
}

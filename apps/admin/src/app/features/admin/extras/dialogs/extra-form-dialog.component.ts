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
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MessageService } from 'primeng/api';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl
} from '@angular/forms';
import type { EntidadExtra, ExtraTipo, ExtrasDefinicion } from '@loteomanager/shared-types';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { RippleModule } from 'primeng/ripple';

export type ExtraFormSavePayload = {
  id: string | null;
  body: Record<string, unknown>;
};

@Component({
  selector: 'app-extra-form-dialog',
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
  templateUrl: './extra-form-dialog.component.html',
  styleUrl: './extra-form-dialog.component.scss'
})
export class ExtraFormDialogComponent {
  private fb = inject(FormBuilder);
  private toast = inject(MessageService);

  visible = input(false);
  editingId = input<string | null>(null);
  currentExtra = input<Partial<ExtrasDefinicion>>({});

  visibleChange = output<boolean>();
  save = output<ExtraFormSavePayload>();

  saving = signal(false);
  opcionesTexto = signal('');

  entidadesOpts = [
    { label: 'Barrios', value: 'barrios' as EntidadExtra },
    { label: 'Unidades', value: 'unidades' as EntidadExtra },
    { label: 'Interesados', value: 'interesados' as EntidadExtra }
  ];

  tiposOpts: { label: string; value: ExtraTipo }[] = [
    { label: 'Texto', value: 'texto' },
    { label: 'Número', value: 'numero' },
    { label: 'Opciones', value: 'opciones' },
    { label: 'Booleano', value: 'booleano' },
    { label: 'Fecha', value: 'fecha' }
  ];

  form = this.fb.nonNullable.group({
    entidad: ['barrios' as EntidadExtra, Validators.required],
    code: ['', Validators.required],
    nombre: ['', Validators.required],
    descripcion: [''],
    tipo: ['texto' as ExtraTipo, Validators.required],
    grupo: [''],
    requerido: [false],
    visible_en_lista: [false],
    visible_en_comparativa: [false],
    activo: [true]
  });

  private tipoValue = toSignal(
    this.form.controls.tipo.valueChanges.pipe(startWith(this.form.controls.tipo.value)),
    { initialValue: 'texto' as ExtraTipo }
  );

  isOpciones = computed(() => this.tipoValue() === 'opciones');

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const row = this.currentExtra();
      const id = this.editingId();
      this.opcionesTexto.set(
        Array.isArray(row.opciones) ? (row.opciones as string[]).join(', ') : ''
      );
      this.form.reset({
        entidad: row.entidad ?? 'barrios',
        code: row.code ?? '',
        nombre: row.nombre ?? '',
        descripcion: row.descripcion ?? '',
        tipo: row.tipo ?? 'texto',
        grupo: row.grupo ?? '',
        requerido: !!row.requerido,
        visible_en_lista: !!row.visible_en_lista,
        visible_en_comparativa: !!row.visible_en_comparativa,
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
    if (!/^[a-z][a-z0-9_]*$/.test(code)) {
      this.toast.add({
        severity: 'error',
        summary: 'Code inválido',
        detail: 'Usá snake_case: empieza con letra y solo minúsculas, números o _.'
      });
      return;
    }
    const body: Record<string, unknown> = {
      code,
      entidad: raw.entidad,
      nombre: raw.nombre.trim(),
      descripcion: raw.descripcion || '',
      tipo: raw.tipo,
      requerido: raw.requerido,
      visible_en_lista: raw.visible_en_lista,
      visible_en_landing: false,
      visible_en_comparativa: raw.visible_en_comparativa,
      orden_display: this.currentExtra().orden_display ?? 0,
      grupo: raw.grupo || '',
      activo: raw.activo
    };
    if (raw.tipo === 'opciones') {
      body['opciones'] = this.opcionesTexto()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      body['opciones'] = null;
    }
    this.saving.set(true);
    this.save.emit({ id: this.editingId(), body });
  }

  onCancel(): void {
    this.visibleChange.emit(false);
  }

  stopSaving(): void {
    this.saving.set(false);
  }
}

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
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl
} from '@angular/forms';
import type { EntidadExtra, ExtraTipo, ExtrasDefinicion } from '@loteomanager/shared-types';
import { slugify } from '@loteomanager/shared-utils';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { RippleModule } from 'primeng/ripple';

export type ExtraFormSavePayload = {
  id: string | null;
  body: Record<string, unknown>;
  createAnother: boolean;
};

@Component({
  selector: 'app-extra-form-dialog',
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
  templateUrl: './extra-form-dialog.component.html',
  styleUrl: './extra-form-dialog.component.scss'
})
export class ExtraFormDialogComponent {
  private fb = inject(FormBuilder);

  @ViewChild('nombreInput') nombreInput?: ElementRef<HTMLInputElement>;

  visible = input(false);
  editingId = input<string | null>(null);
  currentExtra = input<Partial<ExtrasDefinicion>>({});

  visibleChange = output<boolean>();
  save = output<ExtraFormSavePayload>();

  saving = signal(false);
  formError = signal<string | null>(null);
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
    this.form.controls.nombre.valueChanges.subscribe((nombre) => {
      if (this.editingId()) return;
      const codeCtrl = this.form.controls.code;
      if (codeCtrl.dirty) return;
      codeCtrl.setValue(slugify(nombre).replace(/-/g, '_'), { emitEvent: false });
    });

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
        visible_en_lista: !!row.visible_en_lista,
        visible_en_comparativa: !!row.visible_en_comparativa,
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
    if (!/^[a-z][a-z0-9_]*$/.test(code)) {
      this.formError.set(
        'Code inválido. Usá snake_case: empieza con letra y solo minúsculas, números o _.'
      );
      return;
    }
    const body: Record<string, unknown> = {
      code,
      entidad: raw.entidad,
      nombre: raw.nombre.trim(),
      descripcion: raw.descripcion || '',
      tipo: raw.tipo,
      requerido: false,
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
    this.formError.set(null);
    this.save.emit({ id: this.editingId(), body, createAnother });
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
    this.opcionesTexto.set('');
    this.form.reset({
      entidad: this.form.getRawValue().entidad,
      code: '',
      nombre: '',
      descripcion: '',
      tipo: 'texto',
      grupo: '',
      visible_en_lista: false,
      visible_en_comparativa: false,
      activo: true
    });
    queueMicrotask(() => this.nombreInput?.nativeElement.focus());
  }

  stopSaving(): void {
    this.saving.set(false);
  }
}

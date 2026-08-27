import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
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
import type { ZonasResponse } from '@loteomanager/shared-types';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

export type ZonaFormSavePayload = {
  id: string | null;
  body: { nombre: string; departamento_id: string };
  createAnother: boolean;
};

@Component({
  selector: 'app-zona-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule
  ],
  templateUrl: './zona-form-dialog.component.html'
})
export class ZonaFormDialogComponent {
  private fb = inject(FormBuilder);

  @ViewChild('nombreInput') nombreInput?: ElementRef<HTMLInputElement>;

  visible = input(false);
  editingId = input<string | null>(null);
  current = input<Partial<ZonasResponse>>({});
  departamentoOpts = input<{ label: string; value: string }[]>([]);

  visibleChange = output<boolean>();
  save = output<ZonaFormSavePayload>();

  saving = signal(false);
  formError = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    departamento_id: ['', Validators.required]
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const row = this.current();
      this.form.reset({
        nombre: row.nombre ?? '',
        departamento_id: row.departamento_id ?? this.departamentoOpts()[0]?.value ?? ''
      });
      this.saving.set(false);
      this.formError.set(null);
      queueMicrotask(() => this.nombreInput?.nativeElement.focus());
    });
  }

  isDirty(): boolean {
    return this.form.dirty;
  }

  showError(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  onVisibleChange(open: boolean): void {
    this.visibleChange.emit(open);
    if (!open) {
      this.saving.set(false);
      this.formError.set(null);
    }
  }

  onShow(): void {
    queueMicrotask(() => this.nombreInput?.nativeElement.focus());
  }

  onCancel(): void {
    if (this.saving()) return;
    this.visibleChange.emit(false);
  }

  onSubmit(createAnother = false): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set(null);
    const raw = this.form.getRawValue();
    this.save.emit({
      id: this.editingId(),
      createAnother,
      body: {
        nombre: raw.nombre.trim(),
        departamento_id: raw.departamento_id
      }
    });
  }

  setFormError(msg: string): void {
    this.saving.set(false);
    this.formError.set(msg);
  }

  resetForAnother(): void {
    this.saving.set(false);
    this.formError.set(null);
    queueMicrotask(() => this.nombreInput?.nativeElement.focus());
  }

  stopSaving(): void {
    this.saving.set(false);
  }
}

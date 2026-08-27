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
import type { DepartamentosResponse } from '@loteomanager/shared-types';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

export type DepartamentoFormSavePayload = {
  id: string | null;
  body: { nombre: string };
  createAnother: boolean;
};

@Component({
  selector: 'app-departamento-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule],
  templateUrl: './departamento-form-dialog.component.html'
})
export class DepartamentoFormDialogComponent {
  private fb = inject(FormBuilder);

  @ViewChild('nombreInput') nombreInput?: ElementRef<HTMLInputElement>;

  visible = input(false);
  editingId = input<string | null>(null);
  current = input<Partial<DepartamentosResponse>>({});

  visibleChange = output<boolean>();
  save = output<DepartamentoFormSavePayload>();

  saving = signal(false);
  formError = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]]
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const row = this.current();
      this.form.reset({ nombre: row.nombre ?? '' });
      this.saving.set(false);
      this.formError.set(null);
      this.focusFirst();
    });
  }

  isDirty(): boolean {
    return this.form.dirty;
  }

  showError(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.dirty || control.touched);
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
    this.save.emit({
      id: this.editingId(),
      createAnother,
      body: { nombre: this.form.getRawValue().nombre.trim() }
    });
  }

  setFormError(msg: string): void {
    this.saving.set(false);
    this.formError.set(msg);
  }

  resetForAnother(): void {
    this.saving.set(false);
    this.formError.set(null);
    this.form.reset({ nombre: '' });
    this.focusFirst();
  }

  stopSaving(): void {
    this.saving.set(false);
  }

  private focusFirst(): void {
    queueMicrotask(() => this.nombreInput?.nativeElement.focus());
  }
}

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
import type { DepartamentosResponse } from '@loteomanager/shared-types';
import { toSlug } from '@loteomanager/shared-utils';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';

export type DepartamentoFormSavePayload = {
  id: string | null;
  body: { nombre: string };
};

@Component({
  selector: 'app-departamento-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    RippleModule
  ],
  templateUrl: './departamento-form-dialog.component.html',
  styleUrl: './departamento-form-dialog.component.scss'
})
export class DepartamentoFormDialogComponent {
  private fb = inject(FormBuilder);

  visible = input(false);
  editingId = input<string | null>(null);
  current = input<Partial<DepartamentosResponse>>({});

  visibleChange = output<boolean>();
  save = output<DepartamentoFormSavePayload>();

  saving = signal(false);

  readonly dialogStyle = { width: '90vw', maxWidth: '480px' };

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]]
  });

  slugPreview = signal('');

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const row = this.current();
      this.form.patchValue({ nombre: row.nombre ?? '' });
      this.slugPreview.set(row.slug ?? toSlug(row.nombre ?? ''));
      this.saving.set(false);
    });

    this.form.get('nombre')?.valueChanges.subscribe((v) => {
      this.slugPreview.set(toSlug(v ?? ''));
    });
  }

  showError(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  onVisibleChange(open: boolean): void {
    this.visibleChange.emit(open);
    if (!open) this.saving.set(false);
  }

  onCancel(): void {
    if (this.saving()) return;
    this.visibleChange.emit(false);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.save.emit({
      id: this.editingId(),
      body: { nombre: this.form.getRawValue().nombre.trim() }
    });
  }

  stopSaving(): void {
    this.saving.set(false);
  }
}

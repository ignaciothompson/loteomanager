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
import type { ZonasResponse } from '@loteomanager/shared-types';
import { toSlug } from '@loteomanager/shared-utils';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { RippleModule } from 'primeng/ripple';

export type ZonaFormSavePayload = {
  id: string | null;
  body: { nombre: string; departamento_id: string };
};

@Component({
  selector: 'app-zona-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    RippleModule
  ],
  templateUrl: './zona-form-dialog.component.html',
  styleUrl: './zona-form-dialog.component.scss'
})
export class ZonaFormDialogComponent {
  private fb = inject(FormBuilder);

  visible = input(false);
  editingId = input<string | null>(null);
  current = input<Partial<ZonasResponse>>({});
  departamentoOpts = input<{ label: string; value: string }[]>([]);

  visibleChange = output<boolean>();
  save = output<ZonaFormSavePayload>();

  saving = signal(false);
  slugPreview = signal('');

  readonly dialogStyle = { width: '90vw', maxWidth: '520px' };

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    departamento_id: ['', Validators.required]
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const row = this.current();
      this.form.patchValue({
        nombre: row.nombre ?? '',
        departamento_id: row.departamento_id ?? this.departamentoOpts()[0]?.value ?? ''
      });
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
    const raw = this.form.getRawValue();
    this.save.emit({
      id: this.editingId(),
      body: {
        nombre: raw.nombre.trim(),
        departamento_id: raw.departamento_id
      }
    });
  }

  stopSaving(): void {
    this.saving.set(false);
  }
}

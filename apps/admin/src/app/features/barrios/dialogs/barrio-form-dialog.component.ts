import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  computed,
  inject,
  input,
  model,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
  type AbstractControl
} from '@angular/forms';
import { BarriosRecord, ExtraPersistido } from '@loteomanager/shared-types';
import { DefinicionesCacheService, ZonasService } from '@loteomanager/shared-pb-client';
import { toSlug } from '@loteomanager/shared-utils';
import { ExtrasEditorComponent } from '@loteomanager/shared-ui';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { RippleModule } from 'primeng/ripple';

export type BarrioFormSavePayload = {
  barrio: Partial<BarriosRecord>;
  extras: ExtraPersistido[];
};

@Component({
  selector: 'app-barrio-form-dialog',
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
    RippleModule,
    ExtrasEditorComponent
  ],
  templateUrl: './barrio-form-dialog.component.html',
  styleUrl: './barrio-form-dialog.component.scss'
})
export class BarrioFormDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private cache = inject(DefinicionesCacheService);
  private zonasSvc = inject(ZonasService);

  visible = input(false);
  visibleChange = output<boolean>();
  isEdit = input(false);

  @Input({ required: true }) currentBarrio!: Partial<BarriosRecord>;

  extras = model<ExtraPersistido[]>([]);

  save = output<BarrioFormSavePayload>();
  cancel = output<void>();

  readonly saving = signal(false);
  readonly extrasFilter = signal('');

  readonly dialogStyle = { width: '90vw', maxWidth: '640px' };

  /** Evita repatch al abrir overlay del p-select (visibleChange spurious). */
  private dialogOpen = false;

  zonas = this.zonasSvc.list(undefined, { sort: 'nombre' });
  zonaOpts = computed(() =>
    this.zonas().map((z) => ({ label: z.nombre, value: z.id }))
  );

  slugPreview = signal('');

  readonly extrasDefinidos = computed(
    () => this.cache.extrasByEntidad().get('barrios') ?? []
  );

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    ubicacion_texto: ['', Validators.maxLength(255)],
    zona_id: ['', Validators.required]
  });

  ngOnInit(): void {
    this.form.get('nombre')?.valueChanges.subscribe((v) => {
      this.slugPreview.set(toSlug(v ?? ''));
    });
  }

  showError(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  onVisibleChange(open: boolean): void {
    if (open && !this.dialogOpen) {
      this.patchFromCurrent();
    }
    this.dialogOpen = open;
    this.visibleChange.emit(open);
    if (!open) {
      this.saving.set(false);
    }
  }

  onCancel(): void {
    if (this.saving()) return;
    this.cancel.emit();
    this.visibleChange.emit(false);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    try {
      const raw = this.form.getRawValue();
      const barrio: Partial<BarriosRecord> = {
        ...this.currentBarrio,
        nombre: raw.nombre.trim(),
        ubicacion_texto: raw.ubicacion_texto.trim() || undefined,
        zona_id: raw.zona_id,
        slug: toSlug(raw.nombre.trim())
      };
      this.save.emit({ barrio, extras: this.extras() });
    } catch {
      this.saving.set(false);
    }
  }

  stopSaving(): void {
    this.saving.set(false);
  }

  private patchFromCurrent(): void {
    const b = this.currentBarrio;
    this.form.reset({
      nombre: b.nombre ?? '',
      ubicacion_texto: b.ubicacion_texto ?? '',
      zona_id: b.zona_id ?? ''
    });
    this.slugPreview.set(b.slug ?? toSlug(b.nombre ?? ''));
  }
}

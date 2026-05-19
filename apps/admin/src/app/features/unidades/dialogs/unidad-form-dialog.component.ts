import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
  type AbstractControl
} from '@angular/forms';
import {
  BarriosResponse,
  ExtraPersistido,
  EstadoDefinicion,
  UnidadesRecord,
  UsersResponse
} from '@loteomanager/shared-types';
import {
  BarriosService,
  DefinicionesCacheService,
  UsersService
} from '@loteomanager/shared-pb-client';
import { ExtrasEditorComponent } from '@loteomanager/shared-ui';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { AutoCompleteModule } from 'primeng/autocomplete';
import type { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TextareaModule } from 'primeng/textarea';
import { FileUploadModule } from 'primeng/fileupload';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';

export type UnidadFormSavePayload = {
  unidad: Partial<UnidadesRecord>;
  extras: ExtraPersistido[];
  galeriaFiles: File[];
  planoFile: File | null;
};

@Component({
  selector: 'app-unidad-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    AutoCompleteModule,
    ToggleSwitchModule,
    TextareaModule,
    FileUploadModule,
    TooltipModule,
    RippleModule,
    ExtrasEditorComponent
  ],
  templateUrl: './unidad-form-dialog.component.html',
  styleUrl: './unidad-form-dialog.component.scss'
})
export class UnidadFormDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private barriosService = inject(BarriosService);
  private usersService = inject(UsersService);
  private cache = inject(DefinicionesCacheService);

  visible = input(false);
  visibleChange = output<boolean>();
  isEdit = input(false);

  @Input({ required: true }) currentUnidad!: Partial<UnidadesRecord>;

  barrios = input<BarriosResponse[]>([]);
  extras = model<ExtraPersistido[]>([]);

  save = output<UnidadFormSavePayload>();
  cancel = output<void>();
  newBarrio = output<void>();

  readonly saving = signal(false);
  readonly extrasFilter = signal('');
  readonly responsablesSugeridos = signal<UsersResponse[]>([]);
  readonly responsableDisplay = model<UsersResponse | null>(null);
  readonly galeriaFiles = signal<File[]>([]);
  readonly planoFile = signal<File | null>(null);

  private vendedoresCache = signal<UsersResponse[] | null>(null);
  private readonly barriosFromService = this.barriosService.list();

  readonly barriosOptions = computed(() => {
    const byId = new Map<string, BarriosResponse>();
    for (const b of [...this.barriosFromService(), ...this.barrios()]) {
      byId.set(b.id, b);
    }
    return [...byId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  readonly tipos = [
    { label: 'Lote', value: 'lote' as const },
    { label: 'Casa', value: 'casa' as const },
  ];

  readonly monedas = [
    { label: 'USD', value: 'USD' as const },
    { label: 'UYU', value: 'UYU' as const },
  ];

  readonly estadosOptions = computed(() => this.cache.estadosActivosPara('unidades'));

  readonly esConstruccion = computed(() => this.tipoUnidadValue() === 'casa');

  readonly sinBarrio = computed(() => !this.barrioIdValue());

  readonly dialogStyle = { width: '90vw', maxWidth: '900px' };

  readonly form = this.fb.nonNullable.group({
    codigo_interno: ['', [Validators.required, Validators.maxLength(50)]],
    barrio_id: this.fb.control<string | null>(null),
    tipo_unidad: ['lote' as UnidadesRecord['tipo_unidad'], Validators.required],
    direccion_propia: [''],
    metros_cuadrados: [0, [Validators.required, Validators.min(0)]],
    metros_construidos: this.fb.control<number | null>(null),
    ambientes: this.fb.control<number | null>(null),
    antiguedad_anios: this.fb.control<number | null>(null),
    cocheras: [0, [Validators.min(0)]],
    moneda: ['USD' as UnidadesRecord['moneda'], Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    estado: ['disponible', Validators.required],
    oferta: [false],
    precio_oferta: this.fb.control<number | null>(null),
    destacado: [false],
    responsable_id: ['', Validators.required],
    descripcion: ['']
  });

  /** Signal mirrors of reactive controls — needed because computed() doesn't track plain .value */
  private readonly barrioIdValue = toSignal(
    this.form.controls.barrio_id.valueChanges,
    { initialValue: this.form.controls.barrio_id.value }
  );
  private readonly tipoUnidadValue = toSignal(
    this.form.controls.tipo_unidad.valueChanges,
    { initialValue: this.form.controls.tipo_unidad.value }
  );

  constructor() {
    // Solo patchear cuando el dialog ABRE (false → true), no en cada actualización
    let prevVisible = false;
    effect(() => {
        const v = this.visible();
        if (v && !prevVisible) {
        // Transición de cerrado a abierto: hidratar el form
        this.patchFromCurrent();
        }
        prevVisible = v;
    });

    effect(() => {
        this.syncDireccionValidators(this.barrioIdValue());
    });
  }

  ngOnInit(): void {
    void this.loadVendedores();
  }

  setBarrioId(barrioId: string): void {
    this.form.controls.barrio_id.setValue(barrioId);
    this.form.controls.barrio_id.markAsDirty();
  }


  private syncDireccionValidators(barrioId: string | null): void {
    const dir = this.form.controls.direccion_propia;
    if (!barrioId) {
      dir.addValidators(Validators.required);
    } else {
      dir.removeValidators(Validators.required);
      dir.setValue('', { emitEvent: false });
    }
    dir.updateValueAndValidity({ emitEvent: false });
  }

  showError(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  estadoLabel(estado: EstadoDefinicion): string {
    return estado.nombre;
  }

  onVisibleChange(open: boolean): void {
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

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    try {
      const raw = this.form.getRawValue();
      const unidad: Partial<UnidadesRecord> = {
        ...this.currentUnidad,
        codigo_interno: raw.codigo_interno.trim(),
        barrio_id: raw.barrio_id ?? undefined,
        tipo_unidad: raw.tipo_unidad,
        direccion_propia: raw.direccion_propia.trim() || undefined,
        metros_cuadrados: raw.metros_cuadrados,
        metros_construidos: this.esConstruccion() ? raw.metros_construidos ?? undefined : undefined,
        ambientes: this.esConstruccion() ? raw.ambientes ?? undefined : undefined,
        antiguedad_anios: this.esConstruccion() ? raw.antiguedad_anios ?? undefined : undefined,
        cocheras: raw.cocheras,
        moneda: raw.moneda,
        precio: raw.precio,
        estado: raw.estado as UnidadesRecord['estado'],
        oferta: raw.oferta,
        precio_oferta: raw.oferta ? raw.precio_oferta ?? undefined : undefined,
        destacado: raw.destacado,
        responsable_id: raw.responsable_id,
        descripcion: raw.descripcion.trim() || undefined
      };

      this.save.emit({
        unidad,
        extras: this.extras(),
        galeriaFiles: this.galeriaFiles(),
        planoFile: this.planoFile()
      });
    } catch {
      this.saving.set(false);
    }
  }

  stopSaving(): void {
    this.saving.set(false);
  }

  async buscarResponsables(event: AutoCompleteCompleteEvent): Promise<void> {
    const q = event.query.toLowerCase().trim();
    const all = await this.getVendedores();
    if (!q) {
      this.responsablesSugeridos.set(all.slice(0, 20));
      return;
    }
    this.responsablesSugeridos.set(
      all
        .filter(
          (u) =>
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q)
        )
        .slice(0, 20)
    );
  }

  onResponsableSelect(event: { value: UsersResponse }): void {
    const user = event.value;
    this.responsableDisplay.set(user);
    this.form.controls.responsable_id.setValue(user.id);
    this.form.controls.responsable_id.markAsDirty();
  }

  onResponsableClear(): void {
    this.responsableDisplay.set(null);
    this.form.controls.responsable_id.setValue('');
    this.form.controls.responsable_id.markAsDirty();
  }

  onGaleriaSelect(event: { files: File[] }): void {
    this.galeriaFiles.set([...event.files].slice(0, 10));
  }

  onGaleriaClear(): void {
    this.galeriaFiles.set([]);
  }

  onPlanoSelect(event: { files: File[] }): void {
    this.planoFile.set(event.files[0] ?? null);
  }

  onPlanoClear(): void {
    this.planoFile.set(null);
  }

  private patchFromCurrent(): void {
    const u = this.currentUnidad;

    this.form.patchValue({
      codigo_interno: u.codigo_interno ?? '',
      barrio_id: this.resolveBarrioId(u.barrio_id) ?? null,
      tipo_unidad: u.tipo_unidad ?? 'lote',
      direccion_propia: u.direccion_propia ?? '',
      metros_cuadrados: u.metros_cuadrados ?? 0,
      metros_construidos: u.metros_construidos ?? null,
      ambientes: u.ambientes ?? null,
      antiguedad_anios: u.antiguedad_anios ?? null,
      cocheras: u.cocheras ?? 0,
      moneda: u.moneda ?? 'USD',
      precio: u.precio ?? 0,
      estado: u.estado ?? 'disponible',
      oferta: u.oferta ?? false,
      precio_oferta: u.precio_oferta ?? null,
      destacado: u.destacado ?? false,
      responsable_id: u.responsable_id ?? '',
      descripcion: typeof u.descripcion === 'string' ? u.descripcion : ''
    });
    this.galeriaFiles.set([]);
    this.planoFile.set(null);
    void this.resolveResponsableDisplay(u.responsable_id);
  }

  private async getVendedores(): Promise<UsersResponse[]> {
    const cached = this.vendedoresCache();
    if (cached) return cached;
    const list = await this.usersService.listAsync('role = "vendedor"');
    this.vendedoresCache.set(list);
    return list;
  }

  private async loadVendedores(): Promise<void> {
    const list = await this.getVendedores();
    this.responsablesSugeridos.set(list.slice(0, 20));
  }

  private resolveBarrioId(
    barrioId: string | string[] | { id: string } | null | undefined
  ): string | undefined {
    if (typeof barrioId === 'string') return barrioId || undefined;
    if (Array.isArray(barrioId) && barrioId.length) return barrioId[0];
    if (barrioId && typeof barrioId === 'object' && 'id' in barrioId) {
      return barrioId.id;
    }
    return undefined;
  }

  private async resolveResponsableDisplay(id?: string): Promise<void> {
    if (!id) {
      this.responsableDisplay.set(null);
      return;
    }
    const all = await this.getVendedores();
    this.responsableDisplay.set(all.find((u) => u.id === id) ?? null);
  }
}

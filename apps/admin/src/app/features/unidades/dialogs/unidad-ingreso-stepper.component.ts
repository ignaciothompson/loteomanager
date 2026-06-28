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
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {
  AuthService,
  BarriosService,
  DepartamentosService,
  PlantillasUnidadService,
  UnidadesService,
  ZonasService
} from '@loteomanager/shared-pb-client';
import {
  BarriosResponse,
  TipoUnidadIngreso,
  UnidadesTipoUnidadOptions
} from '@loteomanager/shared-types';
import { toSlug, TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { IngresoTabBarrioComponent } from './ingreso-tab-barrio.component';
import { IngresoTabTipoUnidadComponent } from './ingreso-tab-tipo-unidad.component';
import {
  emptyTipoDraft,
  type IngresoPaso2BarrioDraft,
  type TipoUnidadDraft
} from './ingreso-unidades.types';

const TIPO_OPTS: { label: string; value: TipoUnidadIngreso }[] = [
  { label: TIPO_UNIDAD_LABELS['lote_vacio'], value: 'lote_vacio' },
  { label: TIPO_UNIDAD_LABELS['casa_construida'], value: 'casa_construida' },
  { label: TIPO_UNIDAD_LABELS['casa_prefabricada'], value: 'casa_prefabricada' }
];

const TAB_LABEL: Record<TipoUnidadIngreso, string> = {
  lote_vacio: 'Lote',
  casa_construida: 'Casa',
  casa_prefabricada: 'Prefabricada'
};

@Component({
  selector: 'app-unidad-ingreso-stepper',
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
    CheckboxModule,
    TabsModule,
    IngresoTabBarrioComponent,
    IngresoTabTipoUnidadComponent,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './unidad-ingreso-stepper.component.html',
  styleUrl: './unidad-ingreso-stepper.component.scss'
})
export class UnidadIngresoStepperComponent {
  private fb = inject(FormBuilder);
  private barriosSvc = inject(BarriosService);
  private unidadesSvc = inject(UnidadesService);
  private plantillasSvc = inject(PlantillasUnidadService);
  private departamentosSvc = inject(DepartamentosService);
  private zonasSvc = inject(ZonasService);
  private authSvc = inject(AuthService);
  private messages = inject(MessageService);

  visible = input(false);
  visibleChange = output<boolean>();
  saved = output<{ barrioId: string }>();

  readonly saving = signal(false);
  readonly step = signal<1 | 2>(1);
  readonly barrioCreado = signal<BarriosResponse | null>(null);
  readonly activeTab = signal('barrio');

  departamentos = this.departamentosSvc.list(undefined, { sort: 'nombre' });
  zonas = this.zonasSvc.list(undefined, { sort: 'nombre' });

  paso1Form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    departamento_id: ['', Validators.required],
    zona_id: ['', Validators.required],
    tipos_unidad: this.fb.nonNullable.control<TipoUnidadIngreso[]>([], Validators.required)
  });

  paso2Barrio = signal<IngresoPaso2BarrioDraft>({
    descripcion: '',
    planoFile: null,
    imagenFile: null
  });

  draftsPorTipo = signal<Record<TipoUnidadIngreso, TipoUnidadDraft>>({
    lote_vacio: emptyTipoDraft(),
    casa_construida: emptyTipoDraft(),
    casa_prefabricada: emptyTipoDraft()
  });

  readonly dialogStyle = { width: '92vw', maxWidth: '960px' };
  readonly tipoOpts = TIPO_OPTS;

  slugPreview = computed(() => toSlug(this.paso1Form.controls.nombre.value));

  zonaOpts = computed(() => {
    const deptId = this.paso1Form.controls.departamento_id.value;
    return this.zonas()
      .filter((z) => !deptId || z.departamento_id === deptId)
      .map((z) => ({ label: z.nombre, value: z.id }));
  });

  departamentoOpts = computed(() =>
    this.departamentos().map((d) => ({ label: d.nombre, value: d.id }))
  );

  tiposSeleccionados = computed(() => this.paso1Form.controls.tipos_unidad.value);

  tabsPaso2 = computed(() => {
    const tipos = this.tiposSeleccionados();
    return [
      { value: 'barrio', label: 'Barrio' },
      ...tipos.map((t) => ({ value: t, label: TAB_LABEL[t] }))
    ];
  });

  departamentoNombre = computed(() => {
    const id = this.paso1Form.controls.departamento_id.value;
    return this.departamentos().find((d) => d.id === id)?.nombre ?? '';
  });

  zonaNombre = computed(() => {
    const id = this.paso1Form.controls.zona_id.value;
    return this.zonas().find((z) => z.id === id)?.nombre ?? '';
  });

  constructor() {
    effect(() => {
      if (!this.visible()) {
        this.reset();
      }
    });
  }

  onVisibleChange(open: boolean): void {
    this.visibleChange.emit(open);
    if (!open) this.reset();
  }

  toggleTipo(tipo: TipoUnidadIngreso, checked: boolean): void {
    const current = [...this.paso1Form.controls.tipos_unidad.value];
    const next = checked ? [...new Set([...current, tipo])] : current.filter((t) => t !== tipo);
    this.paso1Form.controls.tipos_unidad.setValue(next);
    this.paso1Form.controls.tipos_unidad.markAsTouched();
  }

  isTipoChecked(tipo: TipoUnidadIngreso): boolean {
    return this.paso1Form.controls.tipos_unidad.value.includes(tipo);
  }

  async avanzarPaso1(): Promise<void> {
    this.paso1Form.markAllAsTouched();
    if (this.paso1Form.invalid || this.paso1Form.controls.tipos_unidad.value.length === 0) {
      return;
    }

    this.saving.set(true);
    try {
      const v = this.paso1Form.getRawValue();
      const barrio = await this.barriosSvc.create({
        nombre: v.nombre.trim(),
        slug: toSlug(v.nombre),
        zona_id: v.zona_id,
        tipos_unidad: v.tipos_unidad
      });
      this.barrioCreado.set(barrio);
      this.step.set(2);
      this.activeTab.set('barrio');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear el barrio';
      this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.saving.set(false);
    }
  }

  volverPaso1(): void {
    this.step.set(1);
  }

  async guardarTodo(): Promise<void> {
    const barrio = this.barrioCreado();
    if (!barrio) return;

    const responsableId = this.authSvc.currentUser()?.['id'] as string | undefined;
    if (!responsableId) return;

    this.saving.set(true);
    try {
      const p2 = this.paso2Barrio();
      const updatePayload: Record<string, unknown> = {
        tipos_unidad: this.paso1Form.controls.tipos_unidad.value
      };
      if (p2.descripcion.trim()) {
        updatePayload['descripcion'] = p2.descripcion.trim();
      }
      if (p2.planoFile) updatePayload['plano_general'] = p2.planoFile;
      if (p2.imagenFile) updatePayload['imagen_portada'] = p2.imagenFile;
      await this.barriosSvc.update(barrio.id, updatePayload);

      const drafts = this.draftsPorTipo();
      const tipos = this.tiposSeleccionados();

      for (const tipo of tipos) {
        const d = drafts[tipo];

        for (const plantilla of d.plantillas) {
          const savedPlantilla = await this.plantillasSvc.create({
            barrio_id: barrio.id,
            tipo_unidad: tipo as UnidadesTipoUnidadOptions,
            nombre: plantilla.nombre,
            patron_codigo: plantilla.patron_codigo,
            cantidad: plantilla.cantidad,
            area_m2: plantilla.area_m2 ?? undefined,
            orientacion: plantilla.orientacion ?? undefined,
            precio: plantilla.precio ?? undefined,
            moneda: plantilla.moneda as 'USD' | 'UYU',
            estado_inicial: plantilla.estado_inicial as 'disponible' | 'reservado' | 'bloqueado',
            web_visible: plantilla.web_visible,
            modelo: plantilla.modelo
          });
          await this.unidadesSvc.generarDesdePlantilla(savedPlantilla, responsableId);
        }

        for (const ind of d.individuales) {
          await this.unidadesSvc.crearIndividual(
            {
              barrio_id: barrio.id,
              tipo_unidad: tipo as UnidadesTipoUnidadOptions,
              codigo: ind.codigo,
              area_m2: ind.area_m2 ?? undefined,
              orientacion: ind.orientacion ?? undefined,
              precio: ind.precio ?? undefined,
              moneda: ind.moneda as 'USD' | 'UYU' | 'ARS',
              estado: ind.estado,
              web_visible: ind.web_visible,
              numero_unidad: ind.modelo
            },
            responsableId
          );
        }
      }

      this.saved.emit({ barrioId: barrio.id });
      this.visibleChange.emit(false);
      this.reset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.saving.set(false);
    }
  }

  updateDraftTipo(tipo: TipoUnidadIngreso, draft: TipoUnidadDraft): void {
    this.draftsPorTipo.update((all) => ({ ...all, [tipo]: draft }));
  }

  private reset(): void {
    this.step.set(1);
    this.barrioCreado.set(null);
    this.activeTab.set('barrio');
    this.paso1Form.reset({
      nombre: '',
      departamento_id: '',
      zona_id: '',
      tipos_unidad: []
    });
    this.paso2Barrio.set({ descripcion: '', planoFile: null, imagenFile: null });
    this.draftsPorTipo.set({
      lote_vacio: emptyTipoDraft(),
      casa_construida: emptyTipoDraft(),
      casa_prefabricada: emptyTipoDraft()
    });
    this.saving.set(false);
  }
}

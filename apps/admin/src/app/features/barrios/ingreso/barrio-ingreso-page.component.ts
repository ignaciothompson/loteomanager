import { Component, computed, inject, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  AuthService,
  BarriosService,
  DepartamentosService,
  EstadosDefinicionesService,
  PlantillasUnidadService,
  UnidadesService,
  ZonasService
} from '@loteomanager/shared-pb-client';
import {
  BarriosResponse,
  PlantillasUnidadResponse,
  TipoUnidadIngreso,
  UnidadesResponse,
  UnidadesTipoUnidadOptions
} from '@loteomanager/shared-types';
import { TIPO_UNIDAD_LABELS, slugify } from '@loteomanager/shared-utils';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { TextareaModule } from 'primeng/textarea';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';
import {
  emptyUnidadForm,
  type IngresoFormMode,
  type IngresoPaso2BarrioDraft,
  type IngresoUnidadForm
} from '../../unidades/dialogs/ingreso-unidades.types';
import { IngresoFormPanelComponent } from './panel-listado/ingreso-form-panel.component';
import { IngresoPanelLateralComponent, type IngresoLateralTab } from './panel-tabs/ingreso-panel-lateral.component';
import { IngresoGeoDialogComponent } from '../dialogs/geo/ingreso-geo-dialog.component';
import { IngresoImagenesDialogComponent, type IngresoImagenesDraft } from '../dialogs/imagenes/ingreso-imagenes-dialog.component';
import { IngresoPlantillaNombreDialogComponent } from '../dialogs/plantilla/ingreso-plantilla-nombre-dialog.component';
import { ExtrasEditorComponent } from '../../../shared/components/extras-editor/extras-editor.component';

const TIPO_OPTS: { label: string; value: TipoUnidadIngreso }[] = [
  { label: TIPO_UNIDAD_LABELS['lote_vacio'], value: 'lote_vacio' },
  { label: TIPO_UNIDAD_LABELS['casa_construida'], value: 'casa_construida' },
  { label: TIPO_UNIDAD_LABELS['casa_prefabricada'], value: 'casa_prefabricada' }
];

type BarrioIngresoTab = 'basicos' | 'extras';

const BARRIO_TABS: { value: BarrioIngresoTab; label: string }[] = [
  { value: 'basicos', label: 'Datos básicos' },
  { value: 'extras', label: 'Campos adicionales' }
];

const TIPO_EXTRA_KEYS: Record<TipoUnidadIngreso, readonly string[]> = {
  lote_vacio: [],
  casa_construida: [
    'sup_cubierta',
    'sup_semicubierta',
    'dormitorios',
    'banos',
    'garage',
    'anio_construccion'
  ],
  casa_prefabricada: ['fabricante', 'dormitorios']
};

@Component({
  selector: 'app-barrio-ingreso-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule,
    ToastModule,
    InputTextModule,
    SelectModule,
    MultiSelectModule,
    TextareaModule,
    TabsModule,
    IngresoFormPanelComponent,
    IngresoPanelLateralComponent,
    IngresoGeoDialogComponent,
    IngresoImagenesDialogComponent,
    IngresoPlantillaNombreDialogComponent,
    ExtrasEditorComponent
  ],
  providers: [MessageService],
  templateUrl: './barrio-ingreso-page.component.html',
  styleUrl: './barrio-ingreso-page.component.css'
})
export class BarrioIngresoPageComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private barriosSvc = inject(BarriosService);
  private unidadesSvc = inject(UnidadesService);
  private plantillasSvc = inject(PlantillasUnidadService);
  private departamentosSvc = inject(DepartamentosService);
  private zonasSvc = inject(ZonasService);
  private estadosSvc = inject(EstadosDefinicionesService);
  private authSvc = inject(AuthService);
  private messages = inject(MessageService);

  readonly routeId = signal('');
  readonly barrio = signal<BarriosResponse | null>(null);
  readonly unidades = signal<UnidadesResponse[]>([]);
  readonly plantillas = signal<PlantillasUnidadResponse[]>([]);
  readonly loading = signal(true);
  readonly savingBarrio = signal(false);
  readonly savingUnidad = signal(false);
  readonly savingPlantilla = signal(false);
  readonly usandoPlantilla = signal(false);

  readonly barrioTab = signal<BarrioIngresoTab>('basicos');
  readonly barrioTabs = BARRIO_TABS;

  readonly formTab = model<TipoUnidadIngreso>('lote_vacio');
  readonly lateralTab = model<IngresoLateralTab>('listado');
  readonly formMode = signal<IngresoFormMode>('nuevo');
  readonly selectedUnidadId = signal<string | null>(null);
  readonly selectedPlantillaId = signal<string | null>(null);
  readonly plantillaActiva = signal<PlantillasUnidadResponse | null>(null);
  readonly unidadForm = model<IngresoUnidadForm>(emptyUnidadForm());

  readonly geoDialogVisible = model(false);
  readonly imagenesDialogVisible = model(false);
  readonly plantillaDialogVisible = model(false);
  readonly plantillaNombreDraft = model('');

  readonly isNuevo = computed(() => this.routeId() === 'nuevo');
  readonly barrioGuardado = computed(() => !!this.barrio()?.id && !this.isNuevo());

  departamentos = this.departamentosSvc.list(undefined, { sort: 'nombre' });
  zonas = this.zonasSvc.list(undefined, { sort: 'nombre' });
  estadosUnidades = this.estadosSvc.listByEntidad('unidades');

  paso1Form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    slug: ['', [Validators.required, Validators.maxLength(120)]],
    departamento_id: ['', Validators.required],
    zona_id: ['', Validators.required],
    tipos_unidad: this.fb.nonNullable.control<TipoUnidadIngreso[]>([], Validators.required)
  });

  barrioDraft = signal<IngresoPaso2BarrioDraft & { planoNombre?: string; imagenNombre?: string }>({
    descripcion: '',
    planoFile: null,
    imagenFile: null,
    lat: null,
    lng: null
  });

  readonly barrioExtras = signal<Record<string, unknown>>({});

  readonly tipoOpts = TIPO_OPTS;

  readonly departamentoOpts = computed(() =>
    this.departamentos().map((d) => ({ label: d.nombre, value: d.id }))
  );

  readonly zonaOpts = computed(() => {
    const deptId = this.paso1Form.controls.departamento_id.value;
    return this.zonas()
      .filter((z) => !deptId || z.departamento_id === deptId)
      .map((z) => ({ label: z.nombre, value: z.id }));
  });

  readonly estadoOpts = computed(() =>
    this.estadosUnidades().map((e) => ({ label: e.nombre, value: e.code }))
  );

  readonly geoLabel = computed(() => {
    const { lat, lng } = this.barrioDraft();
    if (lat == null || lng == null) return 'Sin ubicación';
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  });

  readonly imagenesCountLabel = computed(() => {
    const d = this.barrioDraft();
    let n = 0;
    if (d.planoNombre || d.planoFile) n++;
    if (d.imagenNombre || d.imagenFile) n++;
    if (n === 0) return 'Sin archivos';
    if (n === 1) return '1 imagen';
    return `${n} imágenes`;
  });

  constructor() {
    this.paso1Form.controls.departamento_id.valueChanges.subscribe(() => {
      if (this.hydratingBarrioForm) return;
      this.paso1Form.controls.zona_id.setValue('');
    });
    this.paso1Form.controls.nombre.valueChanges.subscribe((nombre) => {
      const auto = slugify(nombre);
      const slugCtrl = this.paso1Form.controls.slug;
      if (this.isNuevo() || !slugCtrl.dirty) {
        slugCtrl.setValue(auto, { emitEvent: false });
      }
    });
    void this.init();
  }

  private hydratingBarrioForm = false;

  private resolveDepartamentoId(
    zonaId: string,
    zonaExpand?: { departamento_id?: string }
  ): string {
    if (zonaExpand?.departamento_id) return zonaExpand.departamento_id;
    return this.zonas().find((z) => z.id === zonaId)?.departamento_id ?? '';
  }

  private patchBarrioForm(full: BarriosResponse, zonaExpand?: { departamento_id?: string }): void {
    this.hydratingBarrioForm = true;
    try {
      const deptId = this.resolveDepartamentoId(full.zona_id, zonaExpand);
      this.paso1Form.controls.departamento_id.setValue(deptId, { emitEvent: false });
      this.paso1Form.patchValue({
        nombre: full.nombre,
        slug: full.slug,
        zona_id: full.zona_id,
        tipos_unidad: full.tipos_unidad?.length ? full.tipos_unidad : []
      });
    } finally {
      this.hydratingBarrioForm = false;
    }
  }

  private async init(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/barrios']);
      return;
    }
    this.routeId.set(id);

    if (id === 'nuevo') {
      this.loading.set(false);
      return;
    }

    await this.loadBarrio(id);
  }

  private async loadBarrio(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const expanded = await this.barriosSvc.listAsync(`id="${id}"`, {
        expand: 'zona_id,zona_id.departamento_id'
      });
      const full = expanded[0];
      if (!full) throw new Error('not found');

      this.barrio.set(full);
      const zonaExpand = (full as BarriosResponse & {
        expand?: { zona_id?: { id: string; departamento_id?: string } };
      }).expand?.zona_id;

      this.patchBarrioForm(full, zonaExpand);

      this.barrioDraft.set({
        descripcion: typeof full.descripcion === 'string' ? full.descripcion : '',
        planoFile: null,
        imagenFile: null,
        planoNombre: full.plano_general || undefined,
        imagenNombre: full.imagen_portada || undefined,
        lat: full.lat ?? null,
        lng: full.lng ?? null
      });
      this.barrioExtras.set(this.extrasRecordFromUnknown(full.extras));

      await this.reloadUnidades();
      await this.reloadPlantillas();
    } catch {
      this.messages.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el barrio' });
      void this.router.navigate(['/barrios']);
    } finally {
      this.loading.set(false);
    }
  }

  private async reloadUnidades(): Promise<void> {
    const id = this.barrio()?.id;
    if (!id) return;
    this.unidades.set(await this.unidadesSvc.listByBarrio(id, { sort: 'codigo' }));
  }

  private async reloadPlantillas(): Promise<void> {
    const id = this.barrio()?.id;
    if (!id) return;
    this.plantillas.set(await this.plantillasSvc.listByBarrio(id));
  }

  volver(): void {
    void this.router.navigate(['/barrios']);
  }

  resetUnidadForm(): void {
    this.formMode.set('nuevo');
    this.selectedUnidadId.set(null);
    this.selectedPlantillaId.set(null);
    this.plantillaActiva.set(null);
    this.usandoPlantilla.set(false);
    this.unidadForm.set(emptyUnidadForm());
  }

  limpiarForm(): void {
    this.resetUnidadForm();
  }

  nuevaUnidad(): void {
    this.lateralTab.set('listado');
    this.resetUnidadForm();
  }

  cancelarForm(): void {
    if (this.usandoPlantilla()) {
      this.limpiarForm();
      return;
    }
    this.resetUnidadForm();
  }

  private formFromPlantilla(p: PlantillasUnidadResponse, codigo = ''): IngresoUnidadForm {
    return {
      codigo,
      nombre_plantilla: '',
      patron_codigo: p.patron_codigo,
      area_m2: p.area_m2 ?? null,
      orientacion: p.orientacion ?? null,
      precio: p.precio ?? null,
      moneda: p.moneda ?? 'USD',
      estado_inicial: p.estado_inicial ?? 'disponible',
      web_visible: p.web_visible ?? true,
      modelo: p.modelo,
      extras: {}
    };
  }

  private reloadFormFromPlantilla(): void {
    const p = this.plantillaActiva();
    if (!p) return;
    this.unidadForm.set(this.formFromPlantilla(p, ''));
  }

  selectUnidad(u: UnidadesResponse): void {
    const extras = (u.extras ?? {}) as Record<string, unknown>;
    this.lateralTab.set('listado');
    this.selectedUnidadId.set(u.id);
    this.selectedPlantillaId.set(null);
    this.plantillaActiva.set(null);
    this.usandoPlantilla.set(false);
    this.formTab.set(u.tipo_unidad as TipoUnidadIngreso);
    this.formMode.set('editando');
    this.unidadForm.set({
      codigo: u.codigo || u.codigo_interno || '',
      nombre_plantilla: '',
      patron_codigo: u.codigo || 'A-{n}',
      area_m2: u.area_m2 ?? u.metros_cuadrados,
      orientacion: u.orientacion ?? null,
      precio: u.precio ?? null,
      moneda: u.moneda ?? 'USD',
      estado_inicial: u.estado,
      web_visible: u.web_visible ?? true,
      modelo: u.numero_unidad,
      fabricante: typeof extras['fabricante'] === 'string' ? extras['fabricante'] : undefined,
      sup_cubierta: (extras['sup_cubierta'] as number | undefined) ?? u.metros_construidos ?? null,
      sup_semicubierta: (extras['sup_semicubierta'] as number | undefined) ?? null,
      dormitorios: (extras['dormitorios'] as number | undefined) ?? null,
      banos: (extras['banos'] as number | undefined) ?? null,
      garage: (extras['garage'] as number | undefined) ?? u.cocheras ?? null,
      anio_construccion: (extras['anio_construccion'] as number | undefined) ?? null,
      extras: this.splitUnidadExtras(extras, u.tipo_unidad as TipoUnidadIngreso)
    });
  }

  selectPlantilla(p: PlantillasUnidadResponse): void {
    this.lateralTab.set('plantillas');
    this.selectedPlantillaId.set(p.id);
    this.selectedUnidadId.set(null);
    this.plantillaActiva.set(p);
    this.usandoPlantilla.set(true);
    this.formTab.set(p.tipo_unidad as TipoUnidadIngreso);
    this.formMode.set('nuevo');
    this.unidadForm.set(this.formFromPlantilla(p, ''));
  }

  onBarrioExtrasChange(extras: Record<string, unknown>): void {
    this.barrioExtras.set(extras);
  }

  onGeoConfirm(coords: { lat: number; lng: number }): void {
    this.barrioDraft.update((d) => ({ ...d, lat: coords.lat, lng: coords.lng }));
  }

  onImagenesConfirm(draft: IngresoImagenesDraft): void {
    this.barrioDraft.update((d) => ({
      ...d,
      planoFile: draft.planoFile,
      imagenFile: draft.imagenFile,
      planoNombre: draft.planoNombre ?? draft.planoFile?.name ?? d.planoNombre,
      imagenNombre: draft.imagenNombre ?? draft.imagenFile?.name ?? d.imagenNombre
    }));
  }

  private unidadExtras(form: IngresoUnidadForm, tipo: TipoUnidadIngreso): Record<string, unknown> | undefined {
    const base: Record<string, unknown> = { ...(form.extras ?? {}) };
    if (tipo === 'casa_construida') {
      Object.assign(base, {
        sup_cubierta: form.sup_cubierta ?? undefined,
        sup_semicubierta: form.sup_semicubierta ?? undefined,
        dormitorios: form.dormitorios ?? undefined,
        banos: form.banos ?? undefined,
        garage: form.garage ?? undefined,
        anio_construccion: form.anio_construccion ?? undefined
      });
    } else if (tipo === 'casa_prefabricada') {
      Object.assign(base, {
        fabricante: form.fabricante?.trim() || undefined,
        dormitorios: form.dormitorios ?? undefined
      });
    }
    return this.stripEmptyExtras(base);
  }

  private extrasRecordFromUnknown(input: unknown): Record<string, unknown> {
    if (Array.isArray(input)) {
      const out: Record<string, unknown> = {};
      for (const x of input) {
        if (x && typeof x === 'object' && 'code' in x) {
          const row = x as { code?: string; valor?: unknown };
          if (typeof row.code === 'string' && row.code) {
            out[row.code] = row.valor ?? null;
          }
        }
      }
      return out;
    }
    if (input && typeof input === 'object') {
      return { ...(input as Record<string, unknown>) };
    }
    return {};
  }

  private splitUnidadExtras(
    extras: Record<string, unknown>,
    tipo: TipoUnidadIngreso
  ): Record<string, unknown> {
    const known = new Set(TIPO_EXTRA_KEYS[tipo]);
    const custom: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(extras)) {
      if (!known.has(key)) custom[key] = value;
    }
    return custom;
  }

  private stripEmptyExtras(extras: Record<string, unknown>): Record<string, unknown> | undefined {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(extras)) {
      if (value !== null && value !== undefined && value !== '') {
        out[key] = value;
      }
    }
    return Object.keys(out).length ? out : undefined;
  }

  async guardarBarrio(): Promise<void> {
    if (this.savingBarrio()) return;
    this.paso1Form.markAllAsTouched();
    if (this.paso1Form.invalid) return;

    this.savingBarrio.set(true);
    const wasNuevo = this.isNuevo();
    try {
      const v = this.paso1Form.getRawValue();
      const bd = this.barrioDraft();

      const payload: Record<string, unknown> = {
        nombre: v.nombre.trim(),
        slug: v.slug.trim(),
        zona_id: v.zona_id,
        tipos_unidad: v.tipos_unidad,
        descripcion: bd.descripcion.trim() || undefined,
        lat: bd.lat ?? undefined,
        lng: bd.lng ?? undefined,
        extras: this.stripEmptyExtras(this.barrioExtras())
      };
      if (bd.planoFile) payload['plano_general'] = bd.planoFile;
      if (bd.imagenFile) payload['imagen_portada'] = bd.imagenFile;

      if (wasNuevo) {
        const created = await this.barriosSvc.create(payload);
        this.barrio.set(created);
        this.barrioExtras.set(this.extrasRecordFromUnknown(created.extras));
        this.routeId.set(created.id);
        void this.router.navigate(['/barrios', created.id], { replaceUrl: true });
      } else if (this.barrio()?.id) {
        const updated = await this.barriosSvc.update(this.barrio()!.id, payload);
        this.barrio.set(updated);
        this.barrioExtras.set(this.extrasRecordFromUnknown(updated.extras));
        this.barrioDraft.update((d) => ({
          ...d,
          planoFile: null,
          imagenFile: null,
          planoNombre: updated.plano_general || d.planoNombre,
          imagenNombre: updated.imagen_portada || d.imagenNombre
        }));
      }

      this.messages.add({
        severity: 'success',
        summary: 'Éxito',
        detail: wasNuevo ? 'Barrio creado' : 'Barrio guardado'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar barrio';
      this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.savingBarrio.set(false);
    }
  }

  abrirDialogPlantilla(): void {
    const form = this.unidadForm();
    this.plantillaNombreDraft.set(form.codigo.trim() || '');
    this.plantillaDialogVisible.set(true);
  }

  async guardarComoPlantilla(nombre: string): Promise<void> {
    const barrioId = this.barrio()?.id;
    const tipo = this.formTab();
    if (!barrioId || this.savingPlantilla()) return;

    const form = this.unidadForm();
    const nombreTrim = nombre.trim();
    if (!nombreTrim) {
      this.messages.add({ severity: 'warn', summary: 'Atención', detail: 'Indicá nombre de plantilla' });
      return;
    }

    this.savingPlantilla.set(true);
    try {
      await this.plantillasSvc.create({
        barrio_id: barrioId,
        tipo_unidad: tipo as UnidadesTipoUnidadOptions,
        nombre: nombreTrim,
        patron_codigo: form.patron_codigo.trim() || `${form.codigo.trim() || nombreTrim}-{n}`,
        cantidad: 1,
        area_m2: form.area_m2 ?? form.sup_cubierta ?? undefined,
        orientacion: form.orientacion ?? undefined,
        precio: form.precio ?? undefined,
        moneda: form.moneda as 'USD' | 'UYU',
        estado_inicial: form.estado_inicial as 'disponible' | 'reservado' | 'bloqueado',
        web_visible: form.web_visible,
        modelo: form.modelo
      });
      await this.reloadPlantillas();
      this.lateralTab.set('plantillas');
      this.plantillaDialogVisible.set(false);
      this.plantillaNombreDraft.set('');
      this.resetUnidadForm();
      this.messages.add({ severity: 'success', summary: 'Éxito', detail: 'Plantilla guardada' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar plantilla';
      this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.savingPlantilla.set(false);
    }
  }

  async guardarUnidad(): Promise<void> {
    const barrioId = this.barrio()?.id;
    const tipo = this.formTab();
    if (!barrioId || this.savingUnidad()) return;

    const form = this.unidadForm();
    if (!form.codigo.trim()) {
      this.messages.add({ severity: 'warn', summary: 'Atención', detail: 'Código requerido' });
      return;
    }
    if (tipo === 'lote_vacio' && (form.area_m2 == null || form.precio == null)) {
      this.messages.add({ severity: 'warn', summary: 'Atención', detail: 'Área y precio son obligatorios para lotes' });
      return;
    }

    const responsableId = this.authSvc.currentUser()?.['id'] as string | undefined;
    if (!responsableId) return;

    const extras = this.unidadExtras(form, tipo);
    const desdePlantilla = this.usandoPlantilla();
    this.savingUnidad.set(true);
    try {
      if (!desdePlantilla && this.formMode() === 'editando' && this.selectedUnidadId()) {
        await this.unidadesSvc.update(this.selectedUnidadId()!, {
          codigo: form.codigo.trim(),
          codigo_interno: form.codigo.trim(),
          area_m2: form.area_m2 ?? form.sup_cubierta ?? undefined,
          metros_cuadrados: form.area_m2 ?? form.sup_cubierta ?? undefined,
          metros_construidos: form.sup_cubierta ?? undefined,
          cocheras: form.garage ?? undefined,
          orientacion: form.orientacion ?? undefined,
          precio: form.precio ?? undefined,
          moneda: form.moneda as UnidadesResponse['moneda'],
          estado: form.estado_inicial,
          web_visible: form.web_visible,
          numero_unidad: form.modelo,
          extras,
          pendiente_publicar: true
        });
        await this.reloadUnidades();
        this.lateralTab.set('listado');
        this.resetUnidadForm();
      } else {
        await this.unidadesSvc.crearIndividual(
          {
            barrio_id: barrioId,
            tipo_unidad: tipo as UnidadesTipoUnidadOptions,
            codigo: form.codigo.trim(),
            area_m2: form.area_m2 ?? form.sup_cubierta ?? undefined,
            metros_construidos: form.sup_cubierta ?? undefined,
            cocheras: form.garage ?? undefined,
            orientacion: form.orientacion ?? undefined,
            precio: form.precio ?? undefined,
            moneda: form.moneda as 'USD' | 'UYU' | 'ARS',
            estado: form.estado_inicial,
            web_visible: form.web_visible,
            numero_unidad: form.modelo,
            extras
          },
          responsableId
        );
        await this.reloadUnidades();
        if (desdePlantilla) {
          this.reloadFormFromPlantilla();
        } else {
          this.lateralTab.set('listado');
          this.resetUnidadForm();
        }
      }

      this.messages.add({ severity: 'success', summary: 'Éxito', detail: 'Unidad guardada' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar unidad';
      this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.savingUnidad.set(false);
    }
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { FilaExtendida, ImportacionExtendida } from '../importador-types';
import type { AccionMasiva, MapeoEntradaZona, MapeoGeografia, ProblemaAgrupado, ResultadoCommit } from '../parser/types';
import { ImportadorService } from '../services/importador.service';
import {
  DefinicionesCacheService,
  DepartamentosService,
  PermisosService,
  ZonasService,
} from '@loteomanager/shared-pb-client';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { FilasTabComponent, type FiltroTabla } from '../components/filas-tab.component';
import { GeoMapeoPanelComponent } from '../components/geo-mapeo-panel.component';
import { ProblemasPanelComponent } from '../components/problemas-panel.component';
import { mapeoPendiente } from '../parser/geo-matcher';
import { fraseBarriosLotes, labelEstadoImportacion } from '../importador-ui';
import type { CabezalBarrio } from '../parser/types';

@Component({
  selector: 'app-importador-review',
  standalone: true,
  imports: [
    FormsModule,
    ToastModule,
    ButtonModule,
    TagModule,
    ConfirmDialogModule,
    ProgressSpinnerModule,
    DialogModule,
    InputNumberModule,
    SelectModule,
    ToggleSwitchModule,
    TooltipModule,
    FilasTabComponent,
    GeoMapeoPanelComponent,
    ProblemasPanelComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './importador-review.component.html',
  styleUrls: ['./importador-review.component.css'],
})
export class ImportadorReviewComponent {
  private importadorService = inject(ImportadorService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private departamentosSvc = inject(DepartamentosService);
  private zonasSvc = inject(ZonasService);
  private definicionesCache = inject(DefinicionesCacheService);
  private permisos = inject(PermisosService);

  readonly importacionId = signal('');
  readonly importacion = signal<ImportacionExtendida | null>(null);
  readonly filas = signal<FilaExtendida[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly loadingCommit = signal(false);
  readonly publicarWeb = signal(false);
  readonly filtroTabla = signal<FiltroTabla>('todos');
  readonly filtroIds = signal<string[] | null>(null);
  readonly resultadoCommit = signal<ResultadoCommit | null>(null);

  readonly massVisible = signal(false);
  readonly massKind = signal<'numero' | 'estado' | 'moneda' | 'orientacion'>('numero');
  readonly massCampo = signal('precio');
  readonly massIds = signal<string[]>([]);
  readonly massNumero = signal<number | null>(null);
  readonly massSelect = signal<string>('');

  readonly departamentos = this.departamentosSvc.list(undefined, { sort: 'nombre' });
  readonly zonas = this.zonasSvc.list(undefined, { sort: 'nombre' });

  readonly canPublish = computed(() => this.permisos.can('web.publish'));
  readonly mapeo = computed(() => this.importacion()?.mapeo_geografia ?? { departamentos: [], zonas: [] });
  readonly problemas = computed(() =>
    this.importadorService.problemasDe(this.filas(), this.importacion()?.mapeo_geografia)
  );
  readonly departamentoOpts = computed(() =>
    this.departamentos()
      .filter((d) => d.slug !== 'todo')
      .map((d) => ({ label: d.nombre, value: d.id }))
  );
  readonly estadoOpts = computed(() =>
    this.definicionesCache.estadosActivosPara('unidades').map((e) => ({ label: e.nombre, value: e.code }))
  );
  readonly monedaOpts = [
    { label: 'USD', value: 'USD' },
    { label: 'UYU', value: 'UYU' },
  ];
  readonly orientacionOpts = [
    'Norte',
    'Sur',
    'Este',
    'Oeste',
    'Noreste',
    'Noroeste',
    'Sureste',
    'Suroeste',
  ].map((v) => ({ label: v, value: v }));

  readonly resumen = computed(() => this.importadorService.resumenCommit(this.filas()));
  readonly geoPendiente = computed(() => mapeoPendiente(this.mapeo()));
  readonly readonly = computed(() => {
    const e = this.importacion()?.estado;
    return e === 'confirmada' || e === 'descartada' || e === 'con_errores';
  });
  readonly showGeo = computed(() => {
    const m = this.mapeo();
    if (m.barrio_destino_id) return false;
    return m.departamentos.length + m.zonas.length > 0;
  });
  readonly todoListo = computed(() => !this.geoPendiente() && this.resumen().aRevisar === 0);
  readonly resultadoVista = computed((): ResultadoCommit | null => {
    const live = this.resultadoCommit();
    if (live) return live;
    const imp = this.importacion();
    if (!imp || (imp.estado !== 'confirmada' && imp.estado !== 'con_errores')) return null;
    const r = imp.mapeo_geografia?.resultado;
    if (!r) return null;
    const barrios = this.filas()
      .filter((f) => f.tipo_fila === 'barrio')
      .map((f) => {
        const c = f.datos_normalizados as CabezalBarrio;
        const id = f.barrio_resuelto_id || c.barrio_resuelto_id || '';
        return id ? { id, nombre: c.nombre } : null;
      })
      .filter((b): b is { id: string; nombre: string } => !!b);
    return {
      filas_aplicadas: r.lotes_creados,
      filas_fallidas: 0,
      filas_omitidas: r.omitidos,
      barrios_creados: r.barrios_creados,
      lotes_creados: r.lotes_creados,
      plantillas_guardadas: 0,
      barrios,
      omisiones: [],
    };
  });

  readonly fraseBarra = computed(() => {
    const r = this.resumen();
    const cuerpo = fraseBarriosLotes(r.crearBarrios, r.crearLotes);
    if (this.todoListo()) return `Todo listo · ${cuerpo}`;
    return `Se van a crear ${cuerpo}`;
  });

  readonly labelConfirmar = computed(() => {
    const r = this.resumen();
    const unidades = this.filas().filter((f) => f.tipo_fila === 'unidad' && !f.aplicada).length;
    const omiten = Math.max(0, unidades - r.crearLotes);
    let s = `Crear ${fraseBarriosLotes(r.crearBarrios, r.crearLotes)}`;
    if (omiten > 0) s += ` · ${omiten} se omiten`;
    return s;
  });

  readonly puedeConfirmar = computed(() => {
    const imp = this.importacion();
    if (imp?.estado !== 'listo_para_confirmar') return false;
    if (this.geoPendiente()) return false;
    return this.resumen().crearLotes > 0;
  });

  readonly bloqueadoMotivo = computed(() => {
    if (this.geoPendiente()) return 'Falta resolver departamentos y zonas.';
    if (this.resumen().crearLotes <= 0) return 'No queda nada por crear.';
    return '';
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.importacionId.set(id);
    void this.cargarDatos(id);
  }

  getNombreArchivo(): string {
    return this.importacion()?.nombre_archivo ?? this.importacionId();
  }

  labelEstado(estado: string): string {
    return labelEstadoImportacion(estado);
  }

  getEstadoSeverity(estado: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      analizando: 'info',
      listo_para_confirmar: 'warn',
      confirmada: 'success',
      confirmando: 'info',
      descartada: 'secondary',
      con_errores: 'danger',
    };
    return map[estado] ?? 'secondary';
  }

  fraseResultado(r: ResultadoCommit): string {
    return fraseBarriosLotes(r.barrios_creados || r.barrios.length, r.lotes_creados);
  }

  setFiltro(f: FiltroTabla): void {
    this.filtroTabla.set(f);
    if (f !== 'ids') this.filtroIds.set(null);
  }

  verProblema(p: ProblemaAgrupado): void {
    this.filtroTabla.set('ids');
    this.filtroIds.set(p.filas_ids);
  }

  onBloqueadoClick(): void {
    if (this.puedeConfirmar()) return;
    if (this.geoPendiente()) {
      document.getElementById('imp-geo-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async recargarDatos(opts?: { silent?: boolean }): Promise<void> {
    await this.cargarDatos(this.importacionId(), opts?.silent === true);
  }

  private async cargarDatos(id: string, silent = false): Promise<void> {
    if (!id) {
      this.loadError.set('Importación no encontrada.');
      this.loading.set(false);
      return;
    }
    if (!silent) {
      this.loading.set(true);
      this.loadError.set(null);
    }
    try {
      const [imp, filas] = await Promise.all([
        this.importadorService.obtenerImportacionAsync(id),
        this.importadorService.listarFilasAsync(id),
      ]);
      this.importacion.set(imp);
      this.filas.set(filas);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo cargar la revisión';
      if (!silent) this.loadError.set(msg);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      if (!silent) this.loading.set(false);
    }
  }

  irAtras(): void {
    if (this.resultadoVista() || this.readonly()) {
      void this.router.navigate(['/importador']);
      return;
    }
    const id = this.importacionId();
    this.confirmationService.confirm({
      message:
        '¿Salir de la revisión? La importación queda guardada y podés retomarla desde el listado.',
      header: 'Salir',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Salir',
      rejectLabel: 'Seguir aquí',
      accept: () =>
        void this.router.navigate(['/importador'], {
          queryParams: id ? { retomar: id } : undefined,
        }),
    });
  }

  irABarrio(id: string): void {
    void this.router.navigate(['/barrios', id]);
  }

  nuevaImportacion(): void {
    void this.router.navigate(['/importador'], { queryParams: { nueva: '1' } });
  }

  async onMapeoChange(mapeo: MapeoGeografia): Promise<void> {
    try {
      await this.importadorService.guardarMapeoGeografia(this.importacionId(), mapeo);
      await this.recargarDatos({ silent: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar mapeo';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async onCrearZona(z: MapeoEntradaZona): Promise<void> {
    const deptoId = this.mapeo().departamentos.find((d) => d.valor_excel === z.departamento_excel)
      ?.departamento_id;
    if (!deptoId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Departamento',
        detail: 'Resolvé el departamento antes de crear la zona.',
      });
      return;
    }
    try {
      await this.importadorService.crearZonaEnMapeo(
        this.importacionId(),
        z.valor_excel,
        z.departamento_excel,
        deptoId
      );
      await this.recargarDatos({ silent: true });
      this.messageService.add({ severity: 'success', summary: 'Zona creada', detail: z.valor_excel });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear la zona';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async aplicarTodas(): Promise<void> {
    const ids = this.filas()
      .filter((f) => (f.correcciones_sugeridas?.length ?? 0) > 0)
      .map((f) => f.id);
    if (!ids.length) return;
    try {
      await this.importadorService.aplicarSugerencias(ids);
      await this.recargarDatos({ silent: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al aplicar sugerencias';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async onMassTabla(ev: { kind: 'estado' | 'moneda' | 'omitir'; ids: string[] }): Promise<void> {
    if (ev.kind === 'omitir') {
      await this.importadorService.omitirFilas(ev.ids);
      await this.recargarDatos({ silent: true });
      return;
    }
    this.massKind.set(ev.kind);
    this.massCampo.set(ev.kind);
    this.massIds.set(ev.ids);
    this.massSelect.set(ev.kind === 'moneda' ? 'USD' : '');
    this.massVisible.set(true);
  }

  async onAccion(ev: { problema: ProblemaAgrupado; accion: AccionMasiva }): Promise<void> {
    const ids = ev.problema.filas_ids;
    const a = ev.accion;
    if (a.codigo === 'omitir') {
      await this.importadorService.omitirFilas(ids);
      await this.recargarDatos({ silent: true });
      return;
    }
    if (a.codigo === 'aplicar_sugerencia') {
      await this.importadorService.aplicarSugerencias(ids);
      await this.recargarDatos({ silent: true });
      return;
    }
    if (a.codigo === 'abrir_mapeo') {
      document.getElementById('imp-geo-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (a.codigo === 'completar_cabezal') {
      this.verProblema(ev.problema);
      return;
    }
    if (a.codigo === 'quedarse_primera') {
      await this.importadorService.quedarseConPrimera(ids);
      await this.recargarDatos({ silent: true });
      return;
    }
    if (a.codigo === 'dejar_vacia') {
      await this.importadorService.editarFilas(ids, { [a.campo ?? 'orientacion']: '' });
      await this.recargarDatos({ silent: true });
      return;
    }
    if (a.codigo === 'asignar') {
      this.massKind.set('numero');
      this.massCampo.set(a.campo ?? 'precio');
      this.massIds.set(ids);
      this.massNumero.set(null);
      this.massVisible.set(true);
      return;
    }
    if (a.codigo === 'elegir_estado') {
      this.massKind.set('estado');
      this.massCampo.set('estado');
      this.massIds.set(ids);
      this.massSelect.set('');
      this.massVisible.set(true);
      return;
    }
    if (a.codigo === 'elegir_moneda') {
      this.massKind.set('moneda');
      this.massCampo.set('moneda');
      this.massIds.set(ids);
      this.massSelect.set('USD');
      this.massVisible.set(true);
      return;
    }
    if (a.codigo === 'elegir_orientacion') {
      this.massKind.set('orientacion');
      this.massCampo.set('orientacion');
      this.massIds.set(ids);
      this.massSelect.set('');
      this.massVisible.set(true);
    }
  }

  async aplicarMass(): Promise<void> {
    const ids = this.massIds();
    const kind = this.massKind();
    try {
      if (kind === 'numero') {
        const n = this.massNumero();
        if (n == null) return;
        await this.importadorService.editarFilas(ids, { [this.massCampo()]: n });
      } else {
        await this.importadorService.editarFilas(ids, { [this.massCampo()]: this.massSelect() });
      }
      this.massVisible.set(false);
      await this.recargarDatos({ silent: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al aplicar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  confirmarImportacion(): void {
    const r = this.resumen();
    const unidades = this.filas().filter((f) => f.tipo_fila === 'unidad' && !f.aplicada).length;
    const omiten = Math.max(0, unidades - r.crearLotes);
    if (omiten > 0) {
      this.confirmationService.confirm({
        message: `${this.labelConfirmar()}. Los lotes con error, duplicados u omitidos no se crean.`,
        header: 'Confirmar omisiones',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Confirmar',
        rejectLabel: 'Cancelar',
        accept: () => void this.doConfirmar(),
      });
      return;
    }
    void this.doConfirmar();
  }

  descartarImportacion(): void {
    this.confirmationService.confirm({
      message: '¿Descartar esta importación?',
      header: 'Descartar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      accept: () => void this.doDescartar(),
    });
  }

  private async doConfirmar(): Promise<void> {
    this.loadingCommit.set(true);
    try {
      const r = await this.importadorService.commitImportacion(this.importacionId(), {
        publicarWeb: this.publicarWeb(),
      });
      const destino = this.importacion()?.mapeo_geografia?.barrio_destino_id;
      if (destino) {
        this.messageService.add({
          severity: 'success',
          summary: 'Listo',
          detail: `Se crearon ${fraseBarriosLotes(r.barrios_creados, r.lotes_creados)}.`,
          life: 6000,
        });
        await this.router.navigate(['/barrios', destino]);
        return;
      }
      this.resultadoCommit.set(r);
      this.importacion.update((imp) =>
        imp
          ? {
              ...imp,
              estado: r.filas_fallidas > 0 ? 'con_errores' : 'confirmada',
              mapeo_geografia: {
                ...(imp.mapeo_geografia ?? { departamentos: [], zonas: [] }),
                resultado: {
                  lotes_creados: r.lotes_creados,
                  omitidos: r.filas_omitidas,
                  barrios_creados: r.barrios_creados,
                },
              },
            }
          : imp
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al confirmar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loadingCommit.set(false);
    }
  }

  private async doDescartar(): Promise<void> {
    this.loadingCommit.set(true);
    try {
      await this.importadorService.descartarImportacion(this.importacionId());
      void this.router.navigate(['/importador']);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al descartar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loadingCommit.set(false);
    }
  }
}

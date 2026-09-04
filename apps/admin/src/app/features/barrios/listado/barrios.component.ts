import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  AuthService,
  BarriosService,
  DefinicionesCacheService,
  DepartamentosService,
  PermisosService,
  POCKETBASE,
  PreferenciasListadoService,
  UnidadesService,
  VendedorAccesoService,
  ZonasService,
  type BarrioConUnidades
} from '@loteomanager/shared-pb-client';
import { TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
import type { TipoUnidadIngreso } from '@loteomanager/shared-types';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { CheckboxModule } from 'primeng/checkbox';
import { Menu, MenuModule } from 'primeng/menu';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { BarrioVerDialogComponent } from '../dialogs/ver/barrio-ver-dialog.component';
import { MenuItem, MessageService } from 'primeng/api';
import {
  ACTIONS_COL_WIDTH,
  CHECK_COL_WIDTH,
  ColumnasDrawerComponent,
  ListadoCellComponent,
  ListadoFilterCellComponent,
  ListadoPrefsController,
  buildBarriosCatalog,
  isFilterActive,
  type ColumnDef,
  type ColumnFilterValue
} from '../../../shared/listado-configurable';

export type BarrioListViewMode = 'table' | 'cards';

export type PubBadgeKind = 'publicado' | 'sin_publicar' | 'pendiente';

export type PubBadge = {
  kind: PubBadgeKind;
  label: string;
};

const VIEW_MODE_KEY_PREFIX = 'lm.barrios.viewMode.';

@Component({
  selector: 'app-barrios',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TableModule,
    ButtonModule,
    ToastModule,
    InputTextModule,
    SelectModule,
    TagModule,
    CheckboxModule,
    MenuModule,
    DialogModule,
    TooltipModule,
    SkeletonModule,
    BarrioVerDialogComponent,
    ColumnasDrawerComponent,
    ListadoFilterCellComponent,
    ListadoCellComponent
  ],
  providers: [MessageService],
  templateUrl: './barrios.component.html',
  styleUrls: [
    './barrios.component.css',
    '../../../shared/listado-configurable/listado-configurable.css'
  ]
})
export class BarriosComponent {
  @ViewChild('rowMenu') rowMenu?: Menu;

  private barriosService = inject(BarriosService);
  private unidadesService = inject(UnidadesService);
  private authService = inject(AuthService);
  private vendedorAcceso = inject(VendedorAccesoService);
  private permisos = inject(PermisosService);
  private departamentosSvc = inject(DepartamentosService);
  private zonasSvc = inject(ZonasService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private pb = inject(POCKETBASE);
  private definiciones = inject(DefinicionesCacheService);
  private prefsSvc = inject(PreferenciasListadoService);

  departamentos = this.departamentosSvc.list(undefined, { sort: 'nombre' });
  zonas = this.zonasSvc.list(undefined, { sort: 'nombre' });

  readonly allRows = signal<BarrioConUnidades[]>([]);
  readonly loading = signal(false);
  readonly viewMode = signal<BarrioListViewMode>('table');
  readonly verDialogVisible = signal(false);
  readonly verBarrioId = signal<string | null>(null);
  readonly selected = signal<BarrioConUnidades[]>([]);
  readonly creatingComparativa = signal(false);
  readonly columnasDrawerVisible = signal(false);
  readonly pageFirst = signal(0);
  readonly pageRows = signal(10);

  readonly deleteConfirmVisible = signal(false);
  readonly deleteTarget = signal<BarrioConUnidades | null>(null);
  readonly deleteNameInput = signal('');
  readonly deleting = signal(false);

  rowMenuItems: MenuItem[] = [];

  readonly canDeleteBarrio = computed(() => this.permisos.can('barrios.delete'));
  readonly canPublishWeb = computed(() => this.permisos.can('web.publish'));
  readonly canCreateComparativa = computed(() => this.permisos.can('comparativas.create'));

  readonly departamentoOpts = computed(() =>
    this.departamentos().map((d) => ({ label: d.nombre, value: d.id }))
  );

  readonly zonaOpts = computed(() => {
    const deptFilter = this.prefs.filters()['departamento'];
    const deptIds = Array.isArray(deptFilter) ? (deptFilter as string[]) : [];
    return this.zonas()
      .filter((z) => !deptIds.length || deptIds.includes(z.departamento_id))
      .map((z) => ({ label: z.nombre, value: z.id }));
  });

  readonly catalog = computed(() => {
    const sample = this.allRows()[0];
    const hasFechaLanzamiento = !!(sample && 'fecha_lanzamiento' in sample);
    return buildBarriosCatalog(this.definiciones.extrasActivosPara('barrios'), {
      hasFechaLanzamiento,
      canPublishWeb: this.canPublishWeb(),
      zonaOptions: this.zonas().map((z) => ({ label: z.nombre, value: z.id })),
      departamentoOptions: this.departamentoOpts()
    });
  });

  readonly prefs = new ListadoPrefsController<BarrioConUnidades>(
    'barrios',
    () => this.catalog(),
    this.prefsSvc,
    () => this.authService.currentUser()?.['id'] as string | undefined
  );

  readonly rows = computed(() => this.prefs.applyPipeline(this.allRows()));

  readonly hasActiveFilters = computed(
    () => this.prefs.activeFilterCount() > 0 || !!this.prefs.search().trim()
  );

  readonly metricBarrios = computed(() => this.allRows().length);
  readonly metricUnidadesDisponibles = computed(() =>
    this.allRows().reduce((sum, r) => sum + (r.unidadesDisponiblesCount ?? 0), 0)
  );
  readonly metricUnidadesReservadas = computed(() =>
    this.allRows().reduce((sum, r) => sum + (r.unidadesReservadasCount ?? 0), 0)
  );
  readonly metricUnidades = computed(() =>
    this.allRows().reduce((sum, r) => sum + r.unidadesCount, 0)
  );

  readonly selectedCount = computed(() => this.selected().length);

  readonly selectionLabel = computed(() => {
    const n = this.selectedCount();
    return n === 1 ? '1 barrio seleccionado' : `${n} barrios seleccionados`;
  });

  readonly comparativaBarriosLabel = computed(() => {
    const n = this.selectedCount();
    return n === 1 ? 'Generar comparativa (1)' : `Generar comparativa (${n})`;
  });

  readonly pageRowsList = computed(() => {
    const all = this.rows();
    const start = this.pageFirst();
    return all.slice(start, start + this.pageRows());
  });

  readonly allVisibleSelected = computed(() => {
    const page = this.pageRowsList();
    if (!page.length) return false;
    const sel = new Set(this.selected().map((b) => b.id));
    return page.every((r) => sel.has(r.id));
  });

  readonly someVisibleSelected = computed(() => {
    const page = this.pageRowsList();
    if (!page.length) return false;
    const sel = new Set(this.selected().map((b) => b.id));
    const n = page.filter((r) => sel.has(r.id)).length;
    return n > 0 && n < page.length;
  });

  readonly pageSelectionHint = computed(() => {
    const page = this.pageRowsList();
    const filtered = this.rows().length;
    if (!page.length || !this.allVisibleSelected() || filtered <= page.length) return null;
    return `Toda esta página. Los ${filtered} del filtro quedan para más adelante`;
  });

  readonly deleteNameMatches = computed(() => {
    const target = this.deleteTarget();
    if (!target) return false;
    return this.deleteNameInput().trim() === target.nombre;
  });

  readonly visibleColumns = computed(() => this.prefs.visibleColumns());

  readonly tableMinWidth = computed(() => {
    const cols = this.visibleColumns();
    const sum = cols.reduce((acc, c) => acc + this.colMinPx(c), 0);
    return CHECK_COL_WIDTH + sum + ACTIONS_COL_WIDTH;
  });

  readonly stickyLefts = computed(() => {
    const cols = this.visibleColumns();
    const lefts: Record<string, number> = { __check: 0 };
    let left = CHECK_COL_WIDTH;
    cols.slice(0, 2).forEach((c) => {
      lefts[c.id] = left;
      left += this.colMinPx(c);
    });
    return lefts;
  });

  readonly footerLabel = computed(() => {
    const n = this.rows().length;
    const total = this.allRows().length;
    const noun = n === 1 ? 'barrio' : 'barrios';
    const base = `${n} de ${total} ${noun}`;
    return this.hasActiveFilters() ? `${base} · filtrado` : base;
  });

  readonly pageLabel = computed(() => {
    const total = this.rows().length;
    if (!total) return '';
    const pages = Math.max(1, Math.ceil(total / this.pageRows()));
    const page = Math.floor(this.pageFirst() / this.pageRows()) + 1;
    return `página ${page} de ${pages}`;
  });

  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private searchLocal = signal('');

  constructor() {
    this.viewMode.set(this.readStoredViewMode());
    void this.definiciones.load().then(() => this.prefs.resyncCatalog());
    void this.prefs.load();

    effect(() => {
      this.vendedorAcceso.barriosVisibles();
      this.vendedorAcceso.accesoReady();
      this.authService.currentUser();
      void this.reloadAll();
    });

    effect(() => {
      const mode = this.viewMode();
      const userId = this.authService.currentUser()?.['id'] as string | undefined;
      if (!userId || typeof localStorage === 'undefined') return;
      localStorage.setItem(VIEW_MODE_KEY_PREFIX + userId, mode);
    });

    effect(() => {
      const notice = this.prefs.filterRemovedNotice();
      if (!notice) return;
      untracked(() => {
        this.messageService.add({ severity: 'info', summary: 'Filtro', detail: notice, life: 3500 });
        this.prefs.filterRemovedNotice.set(null);
      });
    });

    effect(() => {
      this.prefs.filters();
      this.prefs.search();
      this.prefs.orden();
      untracked(() => this.pageFirst.set(0));
    });
  }

  onSearchInput(value: string): void {
    this.searchLocal.set(value);
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.prefs.setSearch(value);
    }, 200);
  }

  searchValue(): string {
    return this.searchLocal() || this.prefs.search();
  }

  clearFilters(): void {
    this.searchLocal.set('');
    this.prefs.clearFilters();
  }

  setColumnFilter(colId: string, value: ColumnFilterValue): void {
    this.prefs.setFilter(colId, value);
  }

  filterValue(colId: string): ColumnFilterValue | null {
    return this.prefs.filters()[colId] ?? null;
  }

  isColFiltered(colId: string): boolean {
    return isFilterActive(this.prefs.filters()[colId]);
  }

  toggleSort(col: ColumnDef<BarrioConUnidades>): void {
    this.prefs.toggleSort(col.id);
  }

  sortIcon(colId: string): string {
    const o = this.prefs.orden();
    if (!o || o.campo !== colId) return 'pi pi-sort-alt';
    return o.dir === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down';
  }

  isSortActive(colId: string): boolean {
    const o = this.prefs.orden();
    return !!o && o.campo === colId;
  }

  colMinPx(col: ColumnDef<BarrioConUnidades>): number {
    if (col.flex) return Math.max(col.ancho ?? 0, 220);
    return col.ancho ?? 120;
  }

  colWidth(col: ColumnDef<BarrioConUnidades>): string {
    return `${this.colMinPx(col)}px`;
  }

  stickyStyle(colId: string | '__check'): Record<string, string> | null {
    const lefts = this.stickyLefts();
    const left = colId === '__check' ? 0 : lefts[colId];
    if (left == null && colId !== '__check') {
      const cols = this.visibleColumns();
      if (cols[0]?.id !== colId && cols[1]?.id !== colId) return null;
    }
    const l = colId === '__check' ? 0 : left;
    if (l == null) return null;
    return { left: `${l}px` };
  }

  isStickyCol(colId: string): boolean {
    const cols = this.visibleColumns();
    return cols[0]?.id === colId || cols[1]?.id === colId;
  }

  isStickyEdge(colId: string): boolean {
    return this.visibleColumns()[1]?.id === colId;
  }

  onPage(ev: { first?: number | null; rows?: number | null }): void {
    this.pageFirst.set(ev.first ?? 0);
    this.pageRows.set(ev.rows ?? 10);
  }

  openCrearBarrio(): void {
    void this.router.navigate(['/barrios', 'nuevo']);
  }

  toggleViewMode(): void {
    this.viewMode.update((mode) => (mode === 'table' ? 'cards' : 'table'));
  }

  verBarrio(barrio: BarrioConUnidades, event?: Event): void {
    event?.stopPropagation();
    this.clearSelection();
    this.verBarrioId.set(barrio.id);
    this.verDialogVisible.set(true);
  }

  editarBarrio(barrio: BarrioConUnidades, event?: Event): void {
    event?.stopPropagation();
    void this.router.navigate(['/barrios', barrio.id]);
  }

  cargarUnidades(barrio: BarrioConUnidades, event?: Event): void {
    event?.stopPropagation();
    void this.router.navigate(['/barrios', barrio.id], { queryParams: { focus: 'unidad' } });
  }

  onRowClick(barrio: BarrioConUnidades): void {
    this.verBarrio(barrio);
  }

  isSelected(barrio: BarrioConUnidades): boolean {
    return this.selected().some((b) => b.id === barrio.id);
  }

  toggleSelect(barrio: BarrioConUnidades, checked: boolean, event?: Event): void {
    event?.stopPropagation();
    this.selected.update((list) => {
      if (checked) {
        if (list.some((b) => b.id === barrio.id)) return list;
        return [...list, barrio];
      }
      return list.filter((b) => b.id !== barrio.id);
    });
  }

  toggleSelectAll(checked: boolean): void {
    const page = this.pageRowsList();
    if (checked) {
      this.selected.update((list) => {
        const map = new Map(list.map((b) => [b.id, b]));
        for (const r of page) map.set(r.id, r);
        return [...map.values()];
      });
      return;
    }
    const pageIds = new Set(page.map((r) => r.id));
    this.selected.update((list) => list.filter((b) => !pageIds.has(b.id)));
  }

  clearSelection(): void {
    this.selected.set([]);
  }

  openRowMenu(barrio: BarrioConUnidades, event: Event): void {
    event.stopPropagation();
    const items: MenuItem[] = [];
    if (this.canDeleteBarrio()) {
      items.push({
        label: 'Eliminar barrio',
        icon: 'pi pi-trash',
        command: () => this.openDeleteConfirm(barrio)
      });
    }
    if (this.canPublishWeb()) {
      items.push({
        label: 'Publicación web',
        icon: 'pi pi-globe',
        command: () => void this.router.navigate(['/publicacion-web'])
      });
    }
    this.rowMenuItems = items;
    if (!items.length) return;
    this.rowMenu?.toggle(event);
  }

  openDeleteConfirm(barrio: BarrioConUnidades): void {
    this.deleteTarget.set(barrio);
    this.deleteNameInput.set('');
    this.deleteConfirmVisible.set(true);
  }

  cancelDeleteConfirm(): void {
    this.deleteConfirmVisible.set(false);
    this.deleteTarget.set(null);
    this.deleteNameInput.set('');
  }

  async confirmDeleteBarrio(): Promise<void> {
    const barrio = this.deleteTarget();
    if (!barrio || !this.deleteNameMatches() || this.deleting()) return;
    this.deleting.set(true);
    try {
      const { unidades, plantillas } = await this.barriosService.deleteConDependencias(barrio.id);
      this.messageService.add({
        severity: 'success',
        summary: 'Barrio eliminado',
        detail:
          unidades || plantillas
            ? `"${barrio.nombre}" eliminado (${unidades} unidad(es), ${plantillas} plantilla(s)).`
            : `"${barrio.nombre}" eliminado.`
      });
      this.cancelDeleteConfirm();
      this.selected.update((list) => list.filter((b) => b.id !== barrio.id));
      if (this.verBarrioId() === barrio.id) {
        this.verDialogVisible.set(false);
        this.verBarrioId.set(null);
      }
      await this.reloadAll();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el barrio. Puede haber comparativas u otros datos vinculados.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.deleting.set(false);
    }
  }

  async crearComparativaDesdeSeleccion(): Promise<void> {
    if (!this.canCreateComparativa() || this.creatingComparativa()) return;
    const barrios = this.selected();
    if (!barrios.length) return;

    this.creatingComparativa.set(true);
    try {
      const ids = barrios.map((b) => b.id);
      const unidades = await this.unidadesService.listByBarrios(
        ids,
        'estado = "disponible" && web_visible = true'
      );
      if (!unidades.length) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Sin unidades',
          detail: 'Los barrios seleccionados no tienen unidades disponibles visibles en web.'
        });
        return;
      }
      const capped = unidades.slice(0, 5);
      if (unidades.length > 5) {
        this.messageService.add({
          severity: 'info',
          summary: 'Límite de comparativa',
          detail: `Se incluirán 5 de ${unidades.length} unidades (límite del modelo).`
        });
      }
      void this.router.navigate(['/enlaces'], {
        queryParams: { unidades_ids: capped.map((u) => u.id).join(',') }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo preparar la comparativa';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.creatingComparativa.set(false);
    }
  }

  onBarrioEliminado(): void {
    this.verBarrioId.set(null);
    void this.reloadAll();
  }

  onBarrioUnidadesChanged(): void {
    void this.reloadAll();
  }

  geoLabel(barrio: BarrioConUnidades): string {
    const expand = (
      barrio as BarrioConUnidades & {
        expand?: {
          zona_id?: { nombre?: string; expand?: { departamento_id?: { nombre?: string } } };
        };
      }
    ).expand?.zona_id;
    const zona = expand && typeof expand === 'object' ? expand.nombre : '';
    const dept = expand?.expand?.departamento_id?.nombre ?? '';
    if (zona && dept) return `${zona} / ${dept}`;
    return zona || dept || '—';
  }

  tipoChips(barrio: BarrioConUnidades): string[] {
    return (barrio.tipos_unidad ?? []).map(
      (t) => TIPO_UNIDAD_LABELS[t as TipoUnidadIngreso] ?? t
    );
  }

  tipoChipsVisible(barrio: BarrioConUnidades, max = 2): { shown: string[]; extra: number } {
    const all = this.tipoChips(barrio);
    return { shown: all.slice(0, max), extra: Math.max(0, all.length - max) };
  }

  pubBadge(barrio: BarrioConUnidades): PubBadge {
    const pendiente = barrio.pendientePublicarCount ?? 0;
    if (pendiente > 0) {
      return {
        kind: 'pendiente',
        label: pendiente === 1 ? '1 sin publicar' : `${pendiente} sin publicar`
      };
    }
    if (barrio.publicado) {
      return { kind: 'publicado', label: 'Publicado' };
    }
    return { kind: 'sin_publicar', label: 'Sin publicar' };
  }

  portadaUrl(barrio: BarrioConUnidades): string | null {
    const name = barrio.imagen_portada;
    if (!name) return null;
    return this.pb.files.getURL(barrio as Parameters<typeof this.pb.files.getURL>[0], name);
  }

  barSegWidths(barrio: BarrioConUnidades): { disp: number; res: number; vend: number } {
    const d = barrio.unidadesDisponiblesCount ?? 0;
    const r = barrio.unidadesReservadasCount ?? 0;
    const v = barrio.unidadesVendidasCount ?? 0;
    const total = d + r + v;
    if (!total) return { disp: 0, res: 0, vend: 0 };
    return {
      disp: (d / total) * 100,
      res: (r / total) * 100,
      vend: (v / total) * 100
    };
  }

  countsParts(barrio: BarrioConUnidades): { key: string; n: number; label: string }[] {
    const parts: { key: string; n: number; label: string }[] = [];
    const d = barrio.unidadesDisponiblesCount ?? 0;
    const r = barrio.unidadesReservadasCount ?? 0;
    const v = barrio.unidadesVendidasCount ?? 0;
    if (d > 0) parts.push({ key: 'd', n: d, label: 'disp' });
    if (r > 0) parts.push({ key: 'r', n: r, label: 'res' });
    if (v > 0) parts.push({ key: 'v', n: v, label: 'vend' });
    return parts;
  }

  metricDisplay(value: number): string {
    return String(value);
  }

  colSpanEmpty(): number {
    return this.visibleColumns().length + 2;
  }

  private readStoredViewMode(): BarrioListViewMode {
    try {
      const userId = this.authService.currentUser()?.['id'] as string | undefined;
      if (!userId || typeof localStorage === 'undefined') return 'table';
      const raw = localStorage.getItem(VIEW_MODE_KEY_PREFIX + userId);
      return raw === 'cards' ? 'cards' : 'table';
    } catch {
      return 'table';
    }
  }

  private async reloadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const visibleIds = this.resolveVisibleBarrioIds();
      const barrios = await this.barriosService.listFiltered({}, visibleIds);
      const withCounts = await this.barriosService.attachUnidadesCount(barrios);
      this.allRows.set(withCounts);
      this.prefs.resyncCatalog();
      const idSet = new Set(withCounts.map((b) => b.id));
      this.selected.update((list) => list.filter((b) => idSet.has(b.id)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al buscar barrios';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      this.allRows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private resolveVisibleBarrioIds(): string[] | null {
    const { barrioIds, waiting } = this.vendedorAcceso.resolveBarrioIds();
    if (waiting) return [];
    return barrioIds;
  }
}

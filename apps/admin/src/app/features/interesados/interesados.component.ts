import {
  Component,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  InteresadosService,
  AuthService,
  DefinicionesCacheService,
  PreferenciasListadoService,
  VendedorAccesoService,
  BarriosService,
  type ReloadableSignal
} from '@loteomanager/shared-pb-client';
import {
  InteresadosRecord,
  InteresadosResponse,
  ExtraPersistido,
  sanitizeExtrasPayload
} from '@loteomanager/shared-types';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import {
  InteresadoFormDialogComponent,
  type InteresadoFormSavePayload
} from './dialogs/interesado-form-dialog.component';
import {
  ACTIONS_COL_WIDTH,
  CHECK_COL_WIDTH,
  ColumnasDrawerComponent,
  ListadoCellComponent,
  ListadoFilterCellComponent,
  ListadoPrefsController,
  buildInteresadosCatalog,
  isFilterActive,
  type ColumnDef,
  type ColumnFilterValue
} from '../../shared/listado-configurable';

@Component({
  selector: 'app-interesados',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ToastModule,
    TooltipModule,
    CheckboxModule,
    DialogModule,
    SkeletonModule,
    InteresadoFormDialogComponent,
    ColumnasDrawerComponent,
    ListadoFilterCellComponent,
    ListadoCellComponent
  ],
  providers: [MessageService],
  templateUrl: './interesados.component.html',
  styleUrls: [
    './interesados.component.css',
    '../../shared/listado-configurable/listado-configurable.css'
  ]
})
export class InteresadosComponent {
  @ViewChild(InteresadoFormDialogComponent)
  private formDialog?: InteresadoFormDialogComponent;

  private interesadosService = inject(InteresadosService);
  private authService = inject(AuthService);
  private vendedorAcceso = inject(VendedorAccesoService);
  private messageService = inject(MessageService);
  private definicionesCache = inject(DefinicionesCacheService);
  private prefsSvc = inject(PreferenciasListadoService);
  private barriosSvc = inject(BarriosService);
  private router = inject(Router);

  interesados = this.createAccesoList((ids) =>
    this.interesadosService.listVisibles(ids, {
      expand: 'barrio_id,unidad_id,comparativa_id,responsable_id',
      sort: '-created'
    })
  );

  barrioOpts = signal<{ label: string; value: string }[]>([]);

  displayDialog = signal(false);
  isEdit = signal(false);
  currentInteresado = signal<Partial<InteresadosRecord>>({});
  currentExtras = signal<ExtraPersistido[]>([]);
  currentId = '';

  readonly selected = signal<InteresadosResponse[]>([]);
  readonly columnasDrawerVisible = signal(false);
  readonly pageFirst = signal(0);
  readonly pageRows = signal(10);
  readonly bulkEstadoVisible = signal(false);
  readonly bulkEstado = signal<string | null>(null);
  readonly bulkSaving = signal(false);

  private searchLocal = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  estadoOpts = computed(() =>
    this.definicionesCache.estadosActivosPara('interesados').map((s) => ({
      label: s.nombre,
      value: s.code
    }))
  );

  readonly catalog = computed(() =>
    buildInteresadosCatalog(this.definicionesCache.extrasActivosPara('interesados'), {
      estadoOptions: this.estadoOpts(),
      origenOptions: [
        { label: 'Web', value: 'web' },
        { label: 'Manual', value: 'manual' }
      ],
      barrioOptions: this.barrioOpts(),
      syncOptions: [
        { label: 'Pendiente', value: 'pending' },
        { label: 'Sincronizado', value: 'synced' },
        { label: 'Error', value: 'error' }
      ]
    })
  );

  readonly prefs = new ListadoPrefsController<InteresadosResponse>(
    'interesados',
    () => this.catalog(),
    this.prefsSvc,
    () => this.authService.currentUser()?.['id'] as string | undefined
  );

  readonly rows = computed(() => this.prefs.applyPipeline(this.interesados()));

  readonly hasActiveFilters = computed(
    () => this.prefs.activeFilterCount() > 0 || !!this.prefs.search().trim()
  );

  readonly selectedCount = computed(() => this.selected().length);

  readonly canGenerateComparativa = computed(() => this.selectedCount() === 1);
  readonly comparativaHint = computed(() =>
    this.selectedCount() > 1
      ? 'La comparativa se arma con el interés de un contacto: elegí uno solo.'
      : null
  );

  readonly pageRowsList = computed(() => {
    const all = this.rows();
    return all.slice(this.pageFirst(), this.pageFirst() + this.pageRows());
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
    const total = this.interesados().length;
    const noun = n === 1 ? 'contacto' : 'contactos';
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

  constructor() {
    void this.definicionesCache.load().then(() => this.prefs.resyncCatalog());
    void this.prefs.load();
    void this.loadBarrioOpts();

    effect(() => {
      this.vendedorAcceso.barriosVisibles();
      this.vendedorAcceso.accesoReady();
      this.authService.currentUser();
      this.interesados.reload();
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
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.prefs.setSearch(value), 200);
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

  toggleSort(col: ColumnDef<InteresadosResponse>): void {
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

  colMinPx(col: ColumnDef<InteresadosResponse>): number {
    if (col.flex) return Math.max(col.ancho ?? 0, 220);
    return col.ancho ?? 120;
  }

  colWidth(col: ColumnDef<InteresadosResponse>): string {
    return `${this.colMinPx(col)}px`;
  }

  stickyStyle(colId: string | '__check'): Record<string, string> | null {
    const lefts = this.stickyLefts();
    const left = colId === '__check' ? 0 : lefts[colId];
    if (left == null && colId !== '__check') return null;
    return { left: `${left ?? 0}px` };
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

  isSelected(row: InteresadosResponse): boolean {
    return this.selected().some((b) => b.id === row.id);
  }

  toggleSelect(row: InteresadosResponse, checked: boolean): void {
    this.selected.update((list) => {
      if (checked) {
        if (list.some((b) => b.id === row.id)) return list;
        return [...list, row];
      }
      return list.filter((b) => b.id !== row.id);
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

  openBulkEstado(): void {
    this.bulkEstado.set(null);
    this.bulkEstadoVisible.set(true);
  }

  async confirmBulkEstado(): Promise<void> {
    const estado = this.bulkEstado();
    const rows = this.selected();
    if (!estado || !rows.length || this.bulkSaving()) return;
    this.bulkSaving.set(true);
    try {
      await Promise.all(rows.map((r) => this.interesadosService.update(r.id, { estado })));
      this.messageService.add({
        severity: 'success',
        summary: 'Estado actualizado',
        detail: `${rows.length} contacto(s) actualizados`
      });
      this.bulkEstadoVisible.set(false);
      this.clearSelection();
      this.interesados.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo cambiar el estado';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.bulkSaving.set(false);
    }
  }

  generarComparativa(): void {
    const row = this.selected()[0];
    if (!row) return;
    void this.router.navigate(['/enlaces'], {
      queryParams: { interesado_id: row.id }
    });
  }

  colSpanEmpty(): number {
    return this.visibleColumns().length + 2;
  }

  openNew(): void {
    this.currentInteresado.set({
      estado: 'nuevo',
      origen: 'manual',
      responsable_id: this.authService.currentUser()?.['id'] as string
    });
    this.currentExtras.set([]);
    this.isEdit.set(false);
    this.displayDialog.set(true);
  }

  editInteresado(interesado: InteresadosResponse): void {
    this.currentInteresado.set({ ...interesado });
    this.currentId = interesado.id;
    this.currentExtras.set(this.parseExtras((interesado as { extras?: unknown }).extras));
    this.isEdit.set(true);
    this.displayDialog.set(true);
  }

  async onSave(payload: InteresadoFormSavePayload): Promise<void> {
    try {
      const body = {
        ...payload.interesado,
        extras: sanitizeExtrasPayload(payload.extras)
      } as Partial<InteresadosResponse>;
      if (this.isEdit()) {
        await this.interesadosService.update(this.currentId, body);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Interesado actualizado' });
      } else {
        await this.interesadosService.create(body);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Interesado creado' });
      }
      this.displayDialog.set(false);
      this.interesados.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      this.formDialog?.stopSaving();
    }
  }

  async deleteInteresado(interesado: InteresadosResponse): Promise<void> {
    if (confirm(`¿Estás seguro de eliminar el lead ${interesado.nombre}?`)) {
      try {
        await this.interesadosService.delete(interesado.id);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Lead eliminado' });
        this.interesados.reload();
      } catch {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar' });
      }
    }
  }

  async markAsWon(interesado: InteresadosResponse): Promise<void> {
    const unidadId = prompt(
      'Para cerrar como ganado, ingresá el ID de la unidad (en la Fase 4 esto será un modal con buscador):'
    );
    if (unidadId) {
      try {
        await this.interesadosService.cerrarComoGanado(interesado.id, unidadId);
        this.messageService.add({
          severity: 'success',
          summary: 'Cerrado ganado',
          detail: 'Venta registrada exitosamente'
        });
        this.interesados.reload();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al cerrar venta';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    }
  }

  private async loadBarrioOpts(): Promise<void> {
    try {
      const { barrioIds, waiting } = this.vendedorAcceso.resolveBarrioIds();
      if (waiting) return;
      const list = await this.barriosSvc.listVisibles(barrioIds);
      this.barrioOpts.set(list.map((b) => ({ label: b.nombre, value: b.id })));
    } catch {
      this.barrioOpts.set([]);
    }
  }

  private parseExtras(raw: unknown): ExtraPersistido[] {
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const first = raw[0] as { extra_id?: string };
    if (first && typeof first.extra_id === 'string') {
      return raw as ExtraPersistido[];
    }
    return [];
  }

  private createAccesoList<T>(
    loader: (barrioIds: string[] | null) => Promise<T[]>
  ): ReloadableSignal<T[]> {
    const data = signal<T[]>([]) as ReloadableSignal<T[]>;
    const load = async () => {
      const { barrioIds, waiting } = this.vendedorAcceso.resolveBarrioIds();
      if (waiting) {
        data.set([]);
        return;
      }
      data.set(await loader(barrioIds));
      this.prefs.resyncCatalog();
    };
    data.reload = () => {
      void load();
    };
    void load();
    return data;
  }
}

import { Component, computed, effect, inject, signal, untracked, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  AuthService,
  BarriosService,
  DepartamentosService,
  PermisosService,
  POCKETBASE,
  UnidadesService,
  VendedorAccesoService,
  ZonasService,
  type BarrioConUnidades,
  type BarrioListFilters
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
import { BarrioVerDialogComponent } from '../dialogs/ver/barrio-ver-dialog.component';
import { MenuItem, MessageService } from 'primeng/api';

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
    BarrioVerDialogComponent
  ],
  providers: [MessageService],
  templateUrl: './barrios.component.html',
  styleUrls: ['./barrios.component.css']
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

  departamentos = this.departamentosSvc.list(undefined, { sort: 'nombre' });
  zonas = this.zonasSvc.list(undefined, { sort: 'nombre' });

  filterDepartamento = signal<string | null>(null);
  filterZona = signal<string | null>(null);
  filterNombre = signal('');
  filterNombreDebounced = signal('');

  readonly rows = signal<BarrioConUnidades[]>([]);
  readonly loading = signal(false);
  readonly viewMode = signal<BarrioListViewMode>('table');
  readonly verDialogVisible = signal(false);
  readonly verBarrioId = signal<string | null>(null);
  readonly selected = signal<BarrioConUnidades[]>([]);
  readonly creatingComparativa = signal(false);

  readonly deleteConfirmVisible = signal(false);
  readonly deleteTarget = signal<BarrioConUnidades | null>(null);
  readonly deleteNameInput = signal('');
  readonly deleting = signal(false);

  rowMenuItems: MenuItem[] = [];

  readonly hasActiveFilters = computed(
    () =>
      !!this.filterDepartamento() ||
      !!this.filterZona() ||
      !!this.filterNombreDebounced().trim()
  );

  readonly metricBarrios = computed(() => this.rows().length);
  readonly metricUnidadesDisponibles = computed(() =>
    this.rows().reduce((sum, r) => sum + (r.unidadesDisponiblesCount ?? 0), 0)
  );
  readonly metricUnidadesReservadas = computed(() =>
    this.rows().reduce((sum, r) => sum + (r.unidadesReservadasCount ?? 0), 0)
  );
  readonly metricUnidades = computed(() =>
    this.rows().reduce((sum, r) => sum + r.unidadesCount, 0)
  );

  readonly selectedCount = computed(() => this.selected().length);

  readonly selectionLabel = computed(() => {
    const n = this.selectedCount();
    return n === 1 ? '1 barrio seleccionado' : `${n} barrios seleccionados`;
  });

  readonly comparativaBarriosLabel = computed(() => {
    const n = this.selectedCount();
    return n === 1 ? 'Crear comparativa (1 barrio)' : `Crear comparativa (${n} barrios)`;
  });

  readonly allVisibleSelected = computed(() => {
    const rows = this.rows();
    if (!rows.length) return false;
    const sel = new Set(this.selected().map((b) => b.id));
    return rows.every((r) => sel.has(r.id));
  });

  readonly someVisibleSelected = computed(() => {
    const rows = this.rows();
    if (!rows.length) return false;
    const sel = new Set(this.selected().map((b) => b.id));
    const n = rows.filter((r) => sel.has(r.id)).length;
    return n > 0 && n < rows.length;
  });

  readonly canDeleteBarrio = computed(() => this.permisos.can('barrios.delete'));
  readonly canPublishWeb = computed(() => this.permisos.can('web.publish'));
  readonly canCreateComparativa = computed(() => this.permisos.can('comparativas.create'));

  readonly deleteNameMatches = computed(() => {
    const target = this.deleteTarget();
    if (!target) return false;
    return this.deleteNameInput().trim() === target.nombre;
  });

  readonly departamentoOpts = computed(() =>
    this.departamentos().map((d) => ({ label: d.nombre, value: d.id }))
  );

  readonly zonaOpts = computed(() => {
    const deptId = this.filterDepartamento();
    return this.zonas()
      .filter((z) => !deptId || z.departamento_id === deptId)
      .map((z) => ({ label: z.nombre, value: z.id }));
  });

  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.viewMode.set(this.readStoredViewMode());

    effect(() => {
      const nombre = this.filterNombre();
      untracked(() => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.filterNombreDebounced.set(nombre), 300);
      });
    });

    effect(() => {
      this.vendedorAcceso.barriosVisibles();
      this.vendedorAcceso.accesoReady();
      this.authService.currentUser();
      this.filterDepartamento();
      this.filterZona();
      this.filterNombreDebounced();
      void this.runSearch();
    });

    effect(() => {
      const mode = this.viewMode();
      const userId = this.authService.currentUser()?.['id'] as string | undefined;
      if (!userId || typeof localStorage === 'undefined') return;
      localStorage.setItem(VIEW_MODE_KEY_PREFIX + userId, mode);
    });
  }

  clearFilters(): void {
    this.filterDepartamento.set(null);
    this.filterZona.set(null);
    this.filterNombre.set('');
    this.filterNombreDebounced.set('');
  }

  onDepartamentoChange(id: string | null): void {
    this.filterDepartamento.set(id);
    this.filterZona.set(null);
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
    if (checked) {
      this.selected.set([...this.rows()]);
      return;
    }
    const visibleIds = new Set(this.rows().map((r) => r.id));
    this.selected.update((list) => list.filter((b) => !visibleIds.has(b.id)));
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
        label: 'Actualización Web',
        icon: 'pi pi-globe',
        command: () => void this.router.navigate(['/actualizacion-web'])
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
      await this.runSearch();
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

  /**
   * TODO: cuando el módulo de comparativas soporte tipo "comparativa de barrios"
   * (amenities / barrio entero), precargar barrios_ids en lugar de expandir a unidades.
   * v1: precarga unidades disponibles + web_visible de los barrios seleccionados.
   */
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
      void this.router.navigate(['/enlaces'], {
        queryParams: { unidades_ids: unidades.map((u) => u.id).join(',') }
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
    void this.runSearch();
  }

  onBarrioUnidadesChanged(): void {
    void this.runSearch();
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

  private async runSearch(): Promise<void> {
    this.loading.set(true);
    try {
      const visibleIds = this.resolveVisibleBarrioIds();
      const filters: BarrioListFilters = {
        departamentoId: this.filterDepartamento(),
        zonaId: this.filterZona(),
        nombre: this.filterNombreDebounced()
      };
      const barrios = await this.barriosService.listFiltered(filters, visibleIds);
      const withCounts = await this.barriosService.attachUnidadesCount(barrios);
      this.rows.set(withCounts);
      const idSet = new Set(withCounts.map((b) => b.id));
      this.selected.update((list) => list.filter((b) => idSet.has(b.id)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al buscar barrios';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      this.rows.set([]);
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

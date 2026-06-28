import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  AuthService,
  BarriosService,
  DepartamentosService,
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
import { BarrioVerDialogComponent } from '../dialogs/ver/barrio-ver-dialog.component';
import { MessageService } from 'primeng/api';

export type BarrioListViewMode = 'table' | 'cards';

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
    BarrioVerDialogComponent
  ],
  providers: [MessageService],
  templateUrl: './barrios.component.html',
  styleUrls: ['./barrios.component.css']
})
export class BarriosComponent {
  private barriosService = inject(BarriosService);
  private authService = inject(AuthService);
  private vendedorAcceso = inject(VendedorAccesoService);
  private departamentosSvc = inject(DepartamentosService);
  private zonasSvc = inject(ZonasService);
  private messageService = inject(MessageService);
  private router = inject(Router);

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

  readonly hasActiveFilters = computed(
    () =>
      !!this.filterDepartamento() ||
      !!this.filterZona() ||
      !!this.filterNombreDebounced().trim()
  );

  readonly metricBarrios = computed(() => this.rows().length);
  readonly metricUnidadesDisponibles = computed(() =>
    this.rows().reduce((sum, r) => sum + r.unidadesCount, 0)
  );
  readonly metricUnidadesReservadas = computed(() =>
    this.rows().reduce((sum, r) => sum + r.unidadesCount, 0)
  );
  readonly metricUnidades = computed(() =>
    this.rows().reduce((sum, r) => sum + r.unidadesCount, 0)
  );

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
    effect(() => {
      const nombre = this.filterNombre();
      untracked(() => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.filterNombreDebounced.set(nombre), 300);
      });
    });

    effect(() => {
      this.vendedorAcceso.barriosVisibles();
      this.authService.currentUser();
      this.filterDepartamento();
      this.filterZona();
      this.filterNombreDebounced();
      void this.runSearch();
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

  verBarrio(barrio: BarrioConUnidades): void {
    this.verBarrioId.set(barrio.id);
    this.verDialogVisible.set(true);
  }

  geoLabel(barrio: BarrioConUnidades): string {
    const expand = (barrio as BarrioConUnidades & {
      expand?: {
        zona_id?: { nombre?: string; expand?: { departamento_id?: { nombre?: string } } };
      };
    }).expand?.zona_id;
    const zona = expand && typeof expand === 'object' ? expand.nombre : '';
    const dept = expand?.expand?.departamento_id?.nombre ?? '';
    if (zona && dept) return `${zona} / ${dept}`;
    return zona || dept || '—';
  }

  tiposLabel(barrio: BarrioConUnidades): string {
    const tipos = barrio.tipos_unidad ?? [];
    if (!tipos.length) return '—';
    return tipos.map((t) => TIPO_UNIDAD_LABELS[t as TipoUnidadIngreso] ?? t).join(', ');
  }

  metricDisplay(value: number): string {
    return String(value);
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
      this.rows.set(await this.barriosService.attachUnidadesCount(barrios));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al buscar barrios';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private resolveVisibleBarrioIds(): string[] | null {
    const role = this.authService.currentUser()?.['role'] as string | undefined;
    if (!role || role === 'admin') return null;
    return this.vendedorAcceso.barriosVisibles();
  }
}

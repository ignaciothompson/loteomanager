import { Component, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AuthService,
  DepartamentosService,
  SupervisorAccesoService,
  ZonasService
} from '@loteomanager/shared-pb-client';
import type { DepartamentosResponse, ZonasResponse } from '@loteomanager/shared-types';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule, type PaginatorState } from 'primeng/paginator';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
  ZonaFormDialogComponent,
  type ZonaFormSavePayload
} from './dialogs/zona-form-dialog.component';
import { OrganizarUsoService } from '../organizar-uso.service';
import { OrganizarPanelComponent } from '../organizar-panel.component';
import { OrgPanelUi } from '../organizar-panel.ui';

const PAGE_SIZE = 20;
const SISTEMA_TIP = 'Registro del sistema: no se puede editar ni eliminar';

type ZonaRow = ZonasResponse & {
  expand?: { departamento_id?: DepartamentosResponse };
  groupKey?: string;
};

@Component({
  selector: 'app-zonas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TableModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
    TooltipModule,
    PaginatorModule,
    ConfirmDialogModule,
    ZonaFormDialogComponent,
    OrganizarPanelComponent
  ],
  providers: [MessageService, ConfirmationService, OrgPanelUi],
  templateUrl: './zonas.component.html',
  styleUrl: './zonas.component.css'
})
export class ZonasComponent {
  @ViewChild(ZonaFormDialogComponent)
  private formDialog?: ZonaFormDialogComponent;

  private svc = inject(ZonasService);
  private deptSvc = inject(DepartamentosService);
  private auth = inject(AuthService);
  private supervisorAcceso = inject(SupervisorAccesoService);
  private usoSvc = inject(OrganizarUsoService);
  private toast = inject(MessageService);
  private route = inject(ActivatedRoute);
  readonly panel = inject(OrgPanelUi);

  rows = signal<ZonaRow[]>([]);
  departamentos = signal<DepartamentosResponse[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  filterNombre = signal('');
  page = signal(0);
  flashId = signal<string | null>(null);
  supervisorDeptIds = signal<string[] | null>(null);

  uso = signal<Record<string, number>>({});
  usoLoading = signal(true);
  usoFailed = signal(false);

  hanging = signal<{ id: string; nombre: string }[]>([]);
  hangingTotal = signal(0);
  private createDraft = signal<Partial<ZonasResponse>>({ nombre: '', departamento_id: '' });

  readonly sistemaTip = SISTEMA_TIP;
  readonly pageSize = PAGE_SIZE;

  deptOpts = computed(() =>
    this.departamentos().map((d) => ({ label: d.nombre, value: d.id }))
  );

  deptOptsFiltrados = computed(() => {
    const allowed = this.supervisorDeptIds();
    const all = this.deptOpts();
    if (allowed === null) return all;
    if (allowed.length === 0) return [];
    return all.filter((o) => allowed.includes(o.value));
  });

  rowsFiltradas = computed(() => {
    let list = this.rows();
    const allowed = this.supervisorDeptIds();
    if (allowed !== null) {
      if (allowed.length === 0) return [];
      list = list.filter((r) => allowed.includes(r.departamento_id));
    }
    const q = this.filterNombre().trim().toLowerCase();
    if (q) list = list.filter((r) => r.nombre.toLowerCase().includes(q));

    const depts = this.departamentos();
    const others = depts
      .filter((d) => !this.deptSvc.isTodo(d))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const todos = depts.filter((d) => this.deptSvc.isTodo(d));
    const order = [...others, ...todos];
    const out: ZonaRow[] = [];
    for (let i = 0; i < order.length; i++) {
      const d = order[i];
      const zs = list
        .filter((z) => z.departamento_id === d.id)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map((z) => ({ ...z, groupKey: `${String(i).padStart(3, '0')}:${d.id}` }));
      out.push(...zs);
    }
    const known = new Set(order.map((d) => d.id));
    const rest = list.filter((z) => !known.has(z.departamento_id));
    out.push(...rest.map((z) => ({ ...z, groupKey: `999:${z.departamento_id}` })));
    return out;
  });

  pagedRows = computed(() => {
    const list = this.rowsFiltradas();
    if (list.length <= PAGE_SIZE) return list;
    const start = this.page() * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  });

  showPager = computed(() => this.rowsFiltradas().length > PAGE_SIZE);

  selectedRow = computed(() => {
    const id = this.panel.selectedId();
    return this.rows().find((r) => r.id === id) ?? null;
  });

  panelTitle = computed(() => {
    const mode = this.panel.mode();
    if (mode === 'create') return 'Nueva zona';
    if (mode === 'edit') return 'Editar zona';
    return this.selectedRow()?.nombre ?? 'Zona';
  });

  formVisible = computed(() => {
    const m = this.panel.mode();
    return m === 'edit' || m === 'create';
  });

  editingId = computed(() => (this.panel.mode() === 'edit' ? this.panel.selectedId() : null));

  current = computed((): Partial<ZonasResponse> => {
    if (this.panel.mode() === 'create') return this.createDraft();
    return this.selectedRow() ?? {};
  });

  constructor() {
    effect(() => {
      const id = this.panel.selectedId();
      if (id && this.panel.mode() === 'detail') void this.loadHanging(id);
    });
    void this.reload().then(() => {
      const sel = this.route.snapshot.queryParamMap.get('sel');
      this.panel.consumeQuerySel(sel, (id) => this.rows().some((r) => r.id === id));
    });
    void this.loadSupervisorDepts();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [zonas, depts] = await Promise.all([
        this.svc.listAsync(undefined, { sort: 'nombre', expand: 'departamento_id' }),
        this.deptSvc.listAsync(undefined, { sort: 'nombre' })
      ]);
      this.rows.set(zonas as ZonaRow[]);
      this.departamentos.set(depts as DepartamentosResponse[]);
      void this.loadUso();
    } catch {
      this.loadError.set('No se pudieron cargar las zonas.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadUso(): Promise<void> {
    this.usoLoading.set(true);
    this.usoFailed.set(false);
    try {
      const maps = await this.usoSvc.geoUso();
      this.uso.set(maps.zona);
    } catch {
      this.usoFailed.set(true);
      this.uso.set({});
    } finally {
      this.usoLoading.set(false);
    }
  }

  private async loadHanging(id: string): Promise<void> {
    try {
      const all = await this.usoSvc.barriosDeZona(id);
      this.hangingTotal.set(all.length);
      this.hanging.set(all.slice(0, 8));
    } catch {
      this.hanging.set([]);
      this.hangingTotal.set(0);
    }
  }

  private async loadSupervisorDepts(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user || user['role'] !== 'supervisor') {
      this.supervisorDeptIds.set(null);
      return;
    }
    const userId = user['id'] as string;
    if (await this.supervisorAcceso.tieneAccesoTotal(userId)) {
      this.supervisorDeptIds.set(null);
      return;
    }
    const deptIds = await this.supervisorAcceso.getDepartamentosAccesibles(userId);
    this.supervisorDeptIds.set(deptIds ?? []);
  }

  deptNombre(row: ZonaRow): string {
    return row.expand?.departamento_id?.nombre ?? '—';
  }

  isTodo(row: ZonasResponse): boolean {
    return this.svc.isTodo(row);
  }

  usoLabel(row: ZonasResponse): { empty: boolean; text: string } {
    if (this.usoFailed()) return { empty: false, text: '—' };
    const n = this.uso()[row.id] ?? 0;
    if (n === 0) return { empty: true, text: 'sin barrios' };
    return { empty: false, text: n === 1 ? '1 barrio' : `${n} barrios` };
  }

  footerCount(): string {
    const n = this.rowsFiltradas().length;
    return n === 1 ? '1 zona' : `${n} zonas`;
  }

  onPage(ev: PaginatorState): void {
    this.page.set(ev.page ?? 0);
  }

  onFilter(value: string): void {
    this.filterNombre.set(value);
    this.page.set(0);
  }

  dirty(): boolean {
    return !!this.formDialog?.isDirty();
  }

  onRowClick(row: ZonasResponse): void {
    this.panel.toggleRow(row.id, this.dirty());
  }

  openNew(): void {
    this.panel.requestClose(this.dirty(), () => {
      this.createDraft.set({
        nombre: '',
        departamento_id: this.deptOptsFiltrados()[0]?.value ?? ''
      });
      this.panel.openCreate();
    });
  }

  openEdit(row: ZonasResponse, ev: Event): void {
    ev.stopPropagation();
    if (this.isTodo(row)) return;
    this.panel.requestClose(this.dirty(), () => this.panel.openEdit(row.id));
  }

  requestClose(): void {
    this.panel.requestClose(this.dirty());
  }

  onFormCancel(): void {
    this.panel.close();
  }

  async onSave(event: ZonaFormSavePayload): Promise<void> {
    try {
      let id = event.id;
      const nombre = event.body.nombre;
      if (event.id) {
        await this.svc.update(event.id, event.body);
        this.toast.add({ severity: 'success', summary: `${nombre} actualizada` });
      } else {
        const created = await this.svc.create(event.body);
        id = created.id;
        this.toast.add({ severity: 'success', summary: `${nombre} creada` });
      }
      await this.reload();
      this.flash(id);
      if (event.createAnother) {
        this.createDraft.set({
          nombre: '',
          departamento_id: event.body.departamento_id || this.deptOptsFiltrados()[0]?.value || ''
        });
        this.panel.openCreate();
        this.formDialog?.resetForAnother();
      } else if (id) {
        this.panel.openDetail(id);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      this.formDialog?.setFormError(msg);
    }
  }

  async tryDelete(row: ZonasResponse, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (this.isTodo(row)) return;
    const uso = this.usoLabel(row);
    const extra = uso.empty ? '' : ` Está en uso (${uso.text}).`;
    if (!confirm(`¿Eliminar zona "${row.nombre}"?${extra}`)) return;
    try {
      await this.svc.delete(row.id);
      this.toast.add({ severity: 'success', summary: `${row.nombre} eliminada` });
      if (this.panel.selectedId() === row.id) this.panel.close();
      await this.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo eliminar';
      this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  private flash(id: string | null): void {
    if (!id) return;
    this.flashId.set(id);
    queueMicrotask(() => {
      document.getElementById(`org-row-${id}`)?.scrollIntoView({ block: 'nearest' });
    });
    window.setTimeout(() => {
      if (this.flashId() === id) this.flashId.set(null);
    }, 1500);
  }
}

import { Component, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { DepartamentosService } from '@loteomanager/shared-pb-client';
import type { DepartamentosResponse } from '@loteomanager/shared-types';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule, type PaginatorState } from 'primeng/paginator';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
  DepartamentoFormDialogComponent,
  type DepartamentoFormSavePayload
} from './dialogs/departamento-form-dialog.component';
import { OrganizarUsoService, type DeptUso } from '../organizar-uso.service';
import { OrganizarPanelComponent } from '../organizar-panel.component';
import { OrgPanelUi } from '../organizar-panel.ui';

const PAGE_SIZE = 20;
const SISTEMA_TIP = 'Registro del sistema: no se puede editar ni eliminar';

@Component({
  selector: 'app-departamentos',
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
    DepartamentoFormDialogComponent,
    OrganizarPanelComponent
  ],
  providers: [MessageService, ConfirmationService, OrgPanelUi],
  templateUrl: './departamentos.component.html',
  styleUrl: './departamentos.component.css'
})
export class DepartamentosComponent {
  @ViewChild(DepartamentoFormDialogComponent)
  private formDialog?: DepartamentoFormDialogComponent;

  private svc = inject(DepartamentosService);
  private usoSvc = inject(OrganizarUsoService);
  private toast = inject(MessageService);
  private route = inject(ActivatedRoute);
  readonly panel = inject(OrgPanelUi);

  rows = signal<DepartamentosResponse[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  filterNombre = signal('');
  page = signal(0);
  flashId = signal<string | null>(null);

  uso = signal<Record<string, DeptUso>>({});
  usoLoading = signal(true);
  usoFailed = signal(false);

  hanging = signal<{ id: string; nombre: string }[]>([]);
  hangingTotal = signal(0);
  private createDraft = signal<Partial<DepartamentosResponse>>({ nombre: '' });

  readonly sistemaTip = SISTEMA_TIP;
  readonly pageSize = PAGE_SIZE;

  rowsFiltradas = computed(() => {
    const q = this.filterNombre().trim().toLowerCase();
    const list = this.rows();
    if (!q) return list;
    return list.filter((r) => r.nombre.toLowerCase().includes(q));
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
    if (mode === 'create') return 'Nuevo departamento';
    if (mode === 'edit') return 'Editar departamento';
    return this.selectedRow()?.nombre ?? 'Departamento';
  });

  formVisible = computed(() => {
    const m = this.panel.mode();
    return m === 'edit' || m === 'create';
  });

  editingId = computed(() => (this.panel.mode() === 'edit' ? this.panel.selectedId() : null));

  current = computed((): Partial<DepartamentosResponse> => {
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
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.rows.set(
        (await this.svc.listAsync(undefined, { sort: 'nombre' })) as DepartamentosResponse[]
      );
      void this.loadUso();
    } catch {
      this.loadError.set('No se pudieron cargar los departamentos.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadUso(): Promise<void> {
    this.usoLoading.set(true);
    this.usoFailed.set(false);
    try {
      const maps = await this.usoSvc.geoUso();
      this.uso.set(maps.dept);
    } catch {
      this.usoFailed.set(true);
      this.uso.set({});
    } finally {
      this.usoLoading.set(false);
    }
  }

  private async loadHanging(id: string): Promise<void> {
    try {
      const all = await this.usoSvc.zonasDeDepto(id);
      this.hangingTotal.set(all.length);
      this.hanging.set(all.slice(0, 8));
    } catch {
      this.hanging.set([]);
      this.hangingTotal.set(0);
    }
  }

  isTodo(row: DepartamentosResponse): boolean {
    return this.svc.isTodo(row);
  }

  usoLabel(row: DepartamentosResponse): { empty: boolean; text: string } {
    if (this.usoFailed()) return { empty: false, text: '—' };
    const u = this.uso()[row.id];
    if (!u) return { empty: true, text: 'sin usar' };
    if (u.zonas === 0 && u.barrios === 0) return { empty: true, text: 'sin usar' };
    const z = u.zonas === 1 ? '1 zona' : `${u.zonas} zonas`;
    const b = u.barrios === 1 ? '1 barrio' : `${u.barrios} barrios`;
    return { empty: false, text: `${z} · ${b}` };
  }

  footerCount(): string {
    const n = this.rowsFiltradas().length;
    return n === 1 ? '1 departamento' : `${n} departamentos`;
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

  onRowClick(row: DepartamentosResponse): void {
    this.panel.toggleRow(row.id, this.dirty());
  }

  openNew(): void {
    this.panel.requestClose(this.dirty(), () => {
      this.createDraft.set({ nombre: '' });
      this.panel.openCreate();
    });
  }

  openEdit(row: DepartamentosResponse, ev: Event): void {
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

  async onSave(event: DepartamentoFormSavePayload): Promise<void> {
    try {
      let id = event.id;
      const nombre = event.body.nombre;
      if (event.id) {
        await this.svc.update(event.id, event.body);
        this.toast.add({ severity: 'success', summary: `${nombre} actualizado` });
      } else {
        const created = await this.svc.create(event.body);
        id = created.id;
        this.toast.add({ severity: 'success', summary: `${nombre} creado` });
      }
      await this.reload();
      this.flash(id);
      if (event.createAnother) {
        this.createDraft.set({ nombre: '' });
        this.panel.openCreate();
        this.formDialog?.resetForAnother();
      } else if (id) {
        this.panel.openDetail(id);
        void this.loadHanging(id);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      this.formDialog?.setFormError(msg);
    }
  }

  async tryDelete(row: DepartamentosResponse, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (this.isTodo(row)) return;
    const uso = this.usoLabel(row);
    const extra = uso.empty ? '' : ` Está en uso (${uso.text}).`;
    if (!confirm(`¿Eliminar departamento "${row.nombre}"?${extra}`)) return;
    try {
      await this.svc.delete(row.id);
      this.toast.add({ severity: 'success', summary: `${row.nombre} eliminado` });
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

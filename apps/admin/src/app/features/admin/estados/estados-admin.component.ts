import { Component, ViewChild, computed, effect, inject, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EstadosDefinicionesService,
  DefinicionesCacheService
} from '@loteomanager/shared-pb-client';
import type { EstadoDefinicion } from '@loteomanager/shared-types';
import { EstadoBadgeComponent } from '@loteomanager/shared-ui';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule, type PaginatorState } from 'primeng/paginator';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
  EstadoFormDialogComponent,
  type EstadoFormSavePayload
} from './dialogs/estado-form-dialog.component';
import { EstadoReemplazoDialogComponent } from './dialogs/estado-reemplazo-dialog.component';
import { OrganizarUsoService } from '../organizar-uso.service';
import { OrganizarPanelComponent } from '../organizar-panel.component';
import { OrgPanelUi } from '../organizar-panel.ui';

const PAGE_SIZE = 20;
const SISTEMA_TIP = 'Registro del sistema: no se puede editar ni eliminar';

@Component({
  selector: 'app-estados-admin',
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
    EstadoBadgeComponent,
    EstadoFormDialogComponent,
    EstadoReemplazoDialogComponent,
    OrganizarPanelComponent
  ],
  providers: [MessageService, ConfirmationService, OrgPanelUi],
  templateUrl: './estados-admin.component.html',
  styleUrl: './estados-admin.component.css'
})
export class EstadosAdminComponent {
  @ViewChild(EstadoFormDialogComponent)
  private formDialog?: EstadoFormDialogComponent;

  private svc = inject(EstadosDefinicionesService);
  private cache = inject(DefinicionesCacheService);
  private usoSvc = inject(OrganizarUsoService);
  private toast = inject(MessageService);
  private route = inject(ActivatedRoute);
  readonly panel = inject(OrgPanelUi);

  rows = signal<EstadoDefinicion[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  filterNombre = signal('');
  page = signal(0);
  flashId = signal<string | null>(null);

  uso = signal<Record<string, number>>({});
  usoLoading = signal(true);
  usoFailed = signal(false);

  hanging = signal<{ id: string; label: string; link: (string | number)[]; query?: Record<string, string> }[]>([]);
  hangingTotal = signal(0);
  private createDraft = signal<Partial<EstadoDefinicion>>({
    entidad: 'unidades',
    nombre: '',
    code: '',
    color: '#6366f1',
    icono: '',
    activo: true,
    es_core: false,
    orden_display: 0
  });

  replaceVisible = signal(false);
  deleteTarget = signal<EstadoDefinicion | null>(null);
  reemplazoId = model<string | null>(null);

  readonly sistemaTip = SISTEMA_TIP;
  readonly pageSize = PAGE_SIZE;

  reemplazoOpts = computed(() => {
    const t = this.deleteTarget();
    if (!t) return [];
    return this.cache
      .estados()
      .filter((s) => s.entidad === t.entidad && s.id !== t.id && s.activo !== false)
      .map((s) => ({
        label: `${s.nombre} (${s.code})${s.es_core ? ' [core]' : ''}`,
        value: s.id
      }));
  });

  rowsFiltradas = computed(() => {
    const q = this.filterNombre().trim().toLowerCase();
    const list = q
      ? this.rows().filter((r) => r.nombre.toLowerCase().includes(q))
      : this.rows();
    return [...list].sort((a, b) => {
      const ent = a.entidad.localeCompare(b.entidad);
      if (ent) return ent;
      return (a.orden_display ?? 0) - (b.orden_display ?? 0);
    });
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
    if (mode === 'create') return 'Nuevo estado';
    if (mode === 'edit') return 'Editar estado';
    return this.selectedRow()?.nombre ?? 'Estado';
  });

  formVisible = computed(() => {
    const m = this.panel.mode();
    return m === 'edit' || m === 'create';
  });

  editingId = computed(() => (this.panel.mode() === 'edit' ? this.panel.selectedId() : null));

  currentEstado = computed((): Partial<EstadoDefinicion> => {
    if (this.panel.mode() === 'create') return this.createDraft();
    return this.selectedRow() ?? {};
  });

  constructor() {
    effect(() => {
      const row = this.selectedRow();
      if (row && this.panel.mode() === 'detail') void this.loadHanging(row);
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
      this.rows.set(await this.svc.listAllAsync());
      void this.loadUso();
    } catch {
      this.loadError.set('No se pudieron cargar los estados.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadUso(): Promise<void> {
    this.usoLoading.set(true);
    this.usoFailed.set(false);
    try {
      this.uso.set(await this.usoSvc.estadoUso());
    } catch {
      this.usoFailed.set(true);
      this.uso.set({});
    } finally {
      this.usoLoading.set(false);
    }
  }

  private async loadHanging(row: EstadoDefinicion): Promise<void> {
    try {
      const items = await this.usoSvc.registrosDeEstado(row.entidad, row.code);
      this.hanging.set(items);
      const n = this.uso()[`${row.entidad}:${row.code}`] ?? items.length;
      this.hangingTotal.set(n);
    } catch {
      this.hanging.set([]);
      this.hangingTotal.set(0);
    }
  }

  isCore(row: EstadoDefinicion): boolean {
    return row.es_core === true;
  }

  usoLabel(row: EstadoDefinicion): { empty: boolean; text: string } {
    if (this.usoFailed()) return { empty: false, text: '—' };
    const n = this.uso()[`${row.entidad}:${row.code}`] ?? 0;
    if (n === 0) return { empty: true, text: 'sin usar' };
    if (row.entidad === 'interesados') {
      return { empty: false, text: n === 1 ? '1 interesado' : `${n} interesados` };
    }
    return { empty: false, text: n === 1 ? '1 unidad' : `${n} unidades` };
  }

  footerCount(): string {
    const n = this.rowsFiltradas().length;
    return n === 1 ? '1 estado' : `${n} estados`;
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

  onRowClick(row: EstadoDefinicion): void {
    this.panel.toggleRow(row.id, this.dirty());
  }

  openNew(): void {
    this.panel.requestClose(this.dirty(), () => {
      this.createDraft.set({
        entidad: 'unidades',
        nombre: '',
        code: '',
        color: '#6366f1',
        icono: '',
        activo: true,
        es_core: false,
        orden_display: 0
      });
      this.panel.openCreate();
    });
  }

  openEdit(row: EstadoDefinicion, ev: Event): void {
    ev.stopPropagation();
    if (this.isCore(row)) return;
    this.panel.requestClose(this.dirty(), () => this.panel.openEdit(row.id));
  }

  requestClose(): void {
    this.panel.requestClose(this.dirty());
  }

  onFormCancel(): void {
    this.panel.close();
  }

  async onSave(event: EstadoFormSavePayload): Promise<void> {
    try {
      let id = event.id;
      const nombre = String(event.body['nombre'] ?? 'Estado');
      if (event.id) {
        await this.svc.update(event.id, event.body as Partial<EstadoDefinicion>);
        this.toast.add({ severity: 'success', summary: `${nombre} actualizado` });
      } else {
        const created = await this.svc.create({
          ...event.body,
          es_core: false
        } as Partial<EstadoDefinicion>);
        id = created.id;
        this.toast.add({ severity: 'success', summary: `${nombre} creado` });
      }
      this.formDialog?.stopSaving();
      await this.cache.refresh();
      this.rows.set(await this.svc.listAllAsync());
      void this.loadUso();
      this.flash(id);
      if (event.createAnother) {
        this.createDraft.set({
          entidad: (event.body['entidad'] as EstadoDefinicion['entidad']) ?? 'unidades',
          nombre: '',
          code: '',
          color: '#6366f1',
          icono: '',
          activo: true,
          es_core: false,
          orden_display: 0
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

  async tryDelete(row: EstadoDefinicion, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (this.isCore(row)) return;
    this.deleteTarget.set(row);
    this.reemplazoId.set(null);
    const uso = this.usoLabel(row);
    const extra = uso.empty ? '' : ` Está en uso (${uso.text}).`;
    if (!confirm(`¿Eliminar estado "${row.nombre}"?${extra}`)) return;
    try {
      await this.svc.delete(row.id);
      this.toast.add({ severity: 'success', summary: `${row.nombre} eliminado` });
      if (this.panel.selectedId() === row.id) this.panel.close();
      this.rows.set(await this.svc.listAllAsync());
      await this.cache.refresh();
      void this.loadUso();
    } catch (e: unknown) {
      const any = e as {
        response?: { message?: string };
        message?: string;
        data?: { message?: string };
      };
      const msg =
        any.response?.message || any.data?.message || any.message || String(e);
      if (msg.includes('registros') || msg.includes('replace-and-delete')) {
        this.replaceVisible.set(true);
      } else {
        this.toast.add({ severity: 'error', summary: 'No se pudo borrar', detail: msg });
      }
    }
  }

  async confirmReplace(): Promise<void> {
    const t = this.deleteTarget();
    const rid = this.reemplazoId();
    if (!t || !rid) return;
    try {
      const res = await this.svc.replaceAndDelete(t.id, rid);
      this.toast.add({
        severity: 'success',
        summary: 'Estado reemplazado',
        detail: `${res.registros_actualizados} registros actualizados`
      });
      this.replaceVisible.set(false);
      if (this.panel.selectedId() === t.id) this.panel.close();
      this.rows.set(await this.svc.listAllAsync());
      await this.cache.refresh();
      void this.loadUso();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
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

import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ExtrasDefinicionesService,
  DefinicionesCacheService
} from '@loteomanager/shared-pb-client';
import type { EntidadExtra, ExtraTipo, ExtrasDefinicion } from '@loteomanager/shared-types';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule, type PaginatorState } from 'primeng/paginator';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
  ExtraFormDialogComponent,
  type ExtraFormSavePayload
} from './dialogs/extra-form-dialog.component';
import { OrganizarUsoService, type ExtraUso } from '../organizar-uso.service';
import { OrganizarPanelComponent } from '../organizar-panel.component';
import { OrgPanelUi } from '../organizar-panel.ui';

const PAGE_SIZE = 20;
const ENTIDAD_ORDER: EntidadExtra[] = ['barrios', 'unidades', 'interesados'];
const ENTIDAD_LABEL: Record<EntidadExtra, string> = {
  barrios: 'Barrios',
  unidades: 'Unidades',
  interesados: 'Interesados'
};
const TIPO_LABEL: Record<ExtraTipo, string> = {
  texto: 'texto',
  numero: 'número',
  booleano: 'booleano',
  opciones: 'opciones',
  fecha: 'fecha'
};

@Component({
  selector: 'app-extras-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
    TooltipModule,
    PaginatorModule,
    ConfirmDialogModule,
    ExtraFormDialogComponent,
    OrganizarPanelComponent
  ],
  providers: [MessageService, ConfirmationService, OrgPanelUi],
  templateUrl: './extras-admin.component.html',
  styleUrl: './extras-admin.component.css'
})
export class ExtrasAdminComponent {
  @ViewChild(ExtraFormDialogComponent)
  private formDialog?: ExtraFormDialogComponent;

  private svc = inject(ExtrasDefinicionesService);
  private cache = inject(DefinicionesCacheService);
  private usoSvc = inject(OrganizarUsoService);
  private toast = inject(MessageService);
  private route = inject(ActivatedRoute);
  readonly panel = inject(OrgPanelUi);

  rows = signal<ExtrasDefinicion[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  filterNombre = signal('');
  page = signal(0);
  flashId = signal<string | null>(null);

  uso = signal<Record<string, ExtraUso>>({});
  usoLoading = signal(true);
  private createDraft = signal<Partial<ExtrasDefinicion>>({
    entidad: 'barrios',
    tipo: 'texto',
    visible_en_lista: false,
    visible_en_comparativa: false,
    activo: true,
    orden_display: 0
  });

  readonly pageSize = PAGE_SIZE;
  readonly entidadLabel = ENTIDAD_LABEL;

  rowsFiltradas = computed(() => {
    const q = this.filterNombre().trim().toLowerCase();
    let list = this.rows();
    if (q) list = list.filter((r) => r.nombre.toLowerCase().includes(q));
    const out: (ExtrasDefinicion & { groupKey: string })[] = [];
    ENTIDAD_ORDER.forEach((ent, i) => {
      const key = `${String(i).padStart(3, '0')}:${ent}`;
      out.push(
        ...list
          .filter((r) => r.entidad === ent)
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
          .map((r) => ({ ...r, groupKey: key }))
      );
    });
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
    if (mode === 'create') return 'Nuevo extra';
    if (mode === 'edit') return 'Editar extra';
    return this.selectedRow()?.nombre ?? 'Extra';
  });

  formVisible = computed(() => {
    const m = this.panel.mode();
    return m === 'edit' || m === 'create';
  });

  editingId = computed(() => (this.panel.mode() === 'edit' ? this.panel.selectedId() : null));

  currentExtra = computed((): Partial<ExtrasDefinicion> => {
    if (this.panel.mode() === 'create') return this.createDraft();
    return this.selectedRow() ?? {};
  });

  opciones = computed(() => {
    const row = this.selectedRow();
    if (!row || row.tipo !== 'opciones') return [];
    return Array.isArray(row.opciones) ? (row.opciones as string[]) : [];
  });

  constructor() {
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
      this.loadError.set('No se pudieron cargar los extras.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadUso(): Promise<void> {
    this.usoLoading.set(true);
    try {
      this.uso.set(await this.usoSvc.extraUso(this.rows()));
    } catch {
      this.uso.set({});
    } finally {
      this.usoLoading.set(false);
    }
  }

  tipoLabel(tipo: ExtraTipo): string {
    return TIPO_LABEL[tipo] ?? tipo;
  }

  entidadGroupLabel(entidad: EntidadExtra): string {
    return ENTIDAD_LABEL[entidad];
  }

  usoLabel(row: ExtrasDefinicion): { empty: boolean; text: string; tip?: string } {
    const v = this.uso()[row.id];
    if (v === 'over' || v === undefined) {
      return { empty: false, text: '—', tip: 'Conteo no disponible' };
    }
    if (v === 0) return { empty: true, text: 'sin usar' };
    if (row.entidad === 'barrios') {
      return { empty: false, text: v === 1 ? 'en 1 barrio' : `en ${v} barrios` };
    }
    if (row.entidad === 'unidades') {
      return { empty: false, text: v === 1 ? 'en 1 unidad' : `en ${v} unidades` };
    }
    return { empty: false, text: v === 1 ? 'en 1 interesado' : `en ${v} interesados` };
  }

  footerCount(): string {
    const n = this.rowsFiltradas().length;
    return n === 1 ? '1 extra' : `${n} extras`;
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

  onRowClick(row: ExtrasDefinicion): void {
    this.panel.toggleRow(row.id, this.dirty());
  }

  openNew(): void {
    this.panel.requestClose(this.dirty(), () => {
      this.createDraft.set({
        entidad: 'barrios',
        tipo: 'texto',
        visible_en_lista: false,
        visible_en_comparativa: false,
        activo: true,
        orden_display: 0
      });
      this.panel.openCreate();
    });
  }

  openEdit(row: ExtrasDefinicion, ev: Event): void {
    ev.stopPropagation();
    this.panel.requestClose(this.dirty(), () => this.panel.openEdit(row.id));
  }

  requestClose(): void {
    this.panel.requestClose(this.dirty());
  }

  onFormCancel(): void {
    this.panel.close();
  }

  async onSave(event: ExtraFormSavePayload): Promise<void> {
    try {
      let id = event.id;
      const nombre = String(event.body['nombre'] ?? 'Extra');
      if (event.id) {
        await this.svc.update(event.id, event.body as Partial<ExtrasDefinicion>);
        this.toast.add({ severity: 'success', summary: `${nombre} actualizado` });
      } else {
        const created = await this.svc.create(event.body as Partial<ExtrasDefinicion>);
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
          entidad: (event.body['entidad'] as EntidadExtra) ?? 'barrios',
          tipo: 'texto',
          visible_en_lista: false,
          visible_en_comparativa: false,
          activo: true,
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

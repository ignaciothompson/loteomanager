import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  ZonaFormDialogComponent,
  type ZonaFormSavePayload
} from './dialogs/zona-form-dialog.component';

type ZonaRow = ZonasResponse & { expand?: { departamento_id?: DepartamentosResponse } };

@Component({
  selector: 'app-zonas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ToastModule,
    ZonaFormDialogComponent
  ],
  providers: [MessageService],
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
  private toast = inject(MessageService);

  rows = this.svc.list(undefined, { sort: 'nombre', expand: 'departamento_id' });
  departamentos = this.deptSvc.list(undefined, { sort: 'nombre' });

  filterNombre = signal('');
  filterDepartamentoId = signal<string | null>(null);
  supervisorDeptIds = signal<string[] | null>(null);

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
    let list = this.rows() as ZonaRow[];
    const allowed = this.supervisorDeptIds();
    if (allowed === null) {
      // acceso total (admin o supervisor con depto Todo)
    } else if (allowed.length === 0) {
      return [];
    } else {
      list = list.filter((r) => allowed.includes(r.departamento_id));
    }
    const deptId = this.filterDepartamentoId();
    if (deptId) list = list.filter((r) => r.departamento_id === deptId);
    const q = this.filterNombre().trim().toLowerCase();
    if (q) list = list.filter((r) => r.nombre.toLowerCase().includes(q));
    return list;
  });

  hasActiveFilters = computed(
    () => !!this.filterNombre().trim() || !!this.filterDepartamentoId()
  );

  formVisible = signal(false);
  editingId = signal<string | null>(null);
  current = signal<Partial<ZonasResponse>>({});

  constructor() {
    void this.loadSupervisorDepts();
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

  clearFilters(): void {
    this.filterNombre.set('');
    this.filterDepartamentoId.set(null);
  }

  isTodo(row: ZonasResponse): boolean {
    return this.svc.isTodo(row);
  }

  openNew(): void {
    this.editingId.set(null);
    const defaultDept = this.deptOptsFiltrados()[0]?.value ?? '';
    this.current.set({ nombre: '', departamento_id: defaultDept });
    this.formVisible.set(true);
  }

  openEdit(row: ZonasResponse): void {
    this.editingId.set(row.id);
    this.current.set({ ...row });
    this.formVisible.set(true);
  }

  async onSave(event: ZonaFormSavePayload): Promise<void> {
    try {
      if (event.id) {
        await this.svc.update(event.id, event.body);
        this.toast.add({ severity: 'success', summary: 'Guardado' });
      } else {
        await this.svc.create(event.body);
        this.toast.add({ severity: 'success', summary: 'Creado' });
      }
      this.formVisible.set(false);
      this.rows.reload();
    } catch (e: unknown) {
      this.formDialog?.stopSaving();
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async tryDelete(row: ZonasResponse): Promise<void> {
    if (this.isTodo(row)) return;
    if (!confirm(`¿Eliminar zona "${row.nombre}"?`)) return;
    try {
      await this.svc.delete(row.id);
      this.toast.add({ severity: 'success', summary: 'Eliminado' });
      this.rows.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo eliminar';
      this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }
}

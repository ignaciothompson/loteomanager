import { Component, ViewChild, computed, inject, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EstadosDefinicionesService,
  DefinicionesCacheService
} from '@loteomanager/shared-pb-client';
import type { EstadoDefinicion } from '@loteomanager/shared-types';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  EstadoFormDialogComponent,
  type EstadoFormSavePayload
} from './dialogs/estado-form-dialog.component';
import { EstadoReemplazoDialogComponent } from './dialogs/estado-reemplazo-dialog.component';

@Component({
  selector: 'app-estados-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
    EstadoFormDialogComponent,
    EstadoReemplazoDialogComponent
  ],
  providers: [MessageService],
  templateUrl: './estados-admin.component.html',
  styleUrl: './estados-admin.component.css'
})
export class EstadosAdminComponent {
  @ViewChild(EstadoFormDialogComponent)
  private formDialog?: EstadoFormDialogComponent;

  private svc = inject(EstadosDefinicionesService);
  private cache = inject(DefinicionesCacheService);
  private toast = inject(MessageService);

  rows = this.svc.list();

  filterNombre = signal('');
  filterCode = signal('');

  rowsFiltradas = computed(() => {
    let list = this.rows();
    const nombre = this.filterNombre().trim().toLowerCase();
    const code = this.filterCode().trim().toLowerCase();
    if (nombre) list = list.filter((r) => r.nombre.toLowerCase().includes(nombre));
    if (code) list = list.filter((r) => r.code.toLowerCase().includes(code));
    return list;
  });

  hasActiveFilters = computed(
    () => !!this.filterNombre().trim() || !!this.filterCode().trim()
  );

  formVisible = signal(false);
  replaceVisible = signal(false);
  editingId = signal<string | null>(null);
  currentEstado = signal<Partial<EstadoDefinicion>>({});
  deleteTarget = signal<EstadoDefinicion | null>(null);
  reemplazoId = model<string | null>(null);

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

  clearFilters(): void {
    this.filterNombre.set('');
    this.filterCode.set('');
  }

  openNew(): void {
    this.editingId.set(null);
    this.currentEstado.set({
      entidad: 'unidades',
      nombre: '',
      code: '',
      color: '#6366f1',
      icono: '',
      activo: true,
      es_core: false,
      orden_display: 0
    });
    this.formVisible.set(true);
  }

  openEdit(row: EstadoDefinicion): void {
    this.editingId.set(row.id);
    this.currentEstado.set({ ...row });
    this.formVisible.set(true);
  }

  async onSave(event: EstadoFormSavePayload): Promise<void> {
    try {
      if (event.id) {
        await this.svc.update(event.id, event.body);
        this.toast.add({ severity: 'success', summary: 'Guardado' });
      } else {
        await this.svc.create({ ...event.body, es_core: false });
        this.toast.add({ severity: 'success', summary: 'Creado' });
      }
      this.formVisible.set(false);
      this.rows.reload();
      await this.cache.refresh();
    } catch (e: unknown) {
      this.formDialog?.stopSaving();
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async tryDelete(row: EstadoDefinicion): Promise<void> {
    this.deleteTarget.set(row);
    this.reemplazoId.set(null);
    try {
      await this.svc.delete(row.id);
      this.toast.add({ severity: 'success', summary: 'Eliminado' });
      this.rows.reload();
      await this.cache.refresh();
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
      this.rows.reload();
      await this.cache.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }
}

import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DepartamentosService } from '@loteomanager/shared-pb-client';
import type { DepartamentosResponse } from '@loteomanager/shared-types';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  DepartamentoFormDialogComponent,
  type DepartamentoFormSavePayload
} from './dialogs/departamento-form-dialog.component';

@Component({
  selector: 'app-departamentos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
    DepartamentoFormDialogComponent
  ],
  providers: [MessageService],
  templateUrl: './departamentos.component.html',
  styleUrl: './departamentos.component.css'
})
export class DepartamentosComponent {
  @ViewChild(DepartamentoFormDialogComponent)
  private formDialog?: DepartamentoFormDialogComponent;

  private svc = inject(DepartamentosService);
  private toast = inject(MessageService);

  rows = this.svc.list(undefined, { sort: 'nombre' });

  filterNombre = signal('');

  rowsFiltradas = computed(() => {
    const q = this.filterNombre().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter((r) => r.nombre.toLowerCase().includes(q));
  });

  hasActiveFilters = computed(() => !!this.filterNombre().trim());

  formVisible = signal(false);
  editingId = signal<string | null>(null);
  current = signal<Partial<DepartamentosResponse>>({});

  clearFilters(): void {
    this.filterNombre.set('');
  }

  isTodo(row: DepartamentosResponse): boolean {
    return this.svc.isTodo(row);
  }

  openNew(): void {
    this.editingId.set(null);
    this.current.set({ nombre: '' });
    this.formVisible.set(true);
  }

  openEdit(row: DepartamentosResponse): void {
    this.editingId.set(row.id);
    this.current.set({ ...row });
    this.formVisible.set(true);
  }

  async onSave(event: DepartamentoFormSavePayload): Promise<void> {
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

  async tryDelete(row: DepartamentosResponse): Promise<void> {
    if (this.isTodo(row)) return;
    if (!confirm(`¿Eliminar departamento "${row.nombre}"?`)) return;
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

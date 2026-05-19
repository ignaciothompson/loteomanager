import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ExtrasDefinicionesService,
  DefinicionesCacheService
} from '@loteomanager/shared-pb-client';
import type { ExtrasDefinicion } from '@loteomanager/shared-types';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  ExtraFormDialogComponent,
  type ExtraFormSavePayload
} from './dialogs/extra-form-dialog.component';

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
    ExtraFormDialogComponent
  ],
  providers: [MessageService],
  templateUrl: './extras-admin.component.html',
  styleUrl: './extras-admin.component.css'
})
export class ExtrasAdminComponent {
  @ViewChild(ExtraFormDialogComponent)
  private formDialog?: ExtraFormDialogComponent;

  private svc = inject(ExtrasDefinicionesService);
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

  dialogVisible = signal(false);
  editingId = signal<string | null>(null);
  currentExtra = signal<Partial<ExtrasDefinicion>>({});

  clearFilters(): void {
    this.filterNombre.set('');
    this.filterCode.set('');
  }

  openNew(): void {
    this.editingId.set(null);
    this.currentExtra.set({
      entidad: 'barrios',
      tipo: 'texto',
      requerido: false,
      visible_en_lista: false,
      visible_en_comparativa: false,
      activo: true,
      orden_display: 0
    });
    this.dialogVisible.set(true);
  }

  openEdit(row: ExtrasDefinicion): void {
    this.editingId.set(row.id);
    this.currentExtra.set({ ...row });
    this.dialogVisible.set(true);
  }

  async onSave(event: ExtraFormSavePayload): Promise<void> {
    try {
      if (event.id) {
        await this.svc.update(event.id, event.body);
        this.toast.add({ severity: 'success', summary: 'Guardado' });
      } else {
        await this.svc.create(event.body);
        this.toast.add({ severity: 'success', summary: 'Creado' });
      }
      this.dialogVisible.set(false);
      this.rows.reload();
      await this.cache.refresh();
    } catch (e: unknown) {
      this.formDialog?.stopSaving();
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }
}

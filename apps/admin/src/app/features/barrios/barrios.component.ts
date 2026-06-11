import { Component, ViewChild, computed, effect, inject, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AuthService,
  BarriosService,
  VendedorAccesoService,
  type ReloadableSignal
} from '@loteomanager/shared-pb-client';
import {
  BarriosRecord,
  BarriosResponse,
  ExtraPersistido,
  sanitizeExtrasPayload
} from '@loteomanager/shared-types';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import {
  BarrioFormDialogComponent,
  type BarrioFormSavePayload
} from './dialogs/barrio-form-dialog.component';

@Component({
  selector: 'app-barrios',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    ToastModule,
    InputTextModule,
    BarrioFormDialogComponent
  ],
  providers: [MessageService],
  templateUrl: './barrios.component.html',
  styleUrls: ['./barrios.component.css']
})
export class BarriosComponent {
  @ViewChild(BarrioFormDialogComponent)
  private barrioFormDialog?: BarrioFormDialogComponent;

  private barriosService = inject(BarriosService);
  private authService = inject(AuthService);
  private vendedorAcceso = inject(VendedorAccesoService);
  private messageService = inject(MessageService);

  barrios = this.createAccesoList((ids) => this.barriosService.listVisibles(ids));

  constructor() {
    effect(() => {
      this.vendedorAcceso.barriosVisibles();
      this.authService.currentUser();
      this.barrios.reload();
    });
  }

  filtroNombre = signal('');

  readonly barriosFiltrados = computed(() => {
    const q = this.filtroNombre().trim().toLowerCase();
    if (!q) return this.barrios();
    return this.barrios().filter(b => b.nombre.toLowerCase().includes(q));
  });

  readonly hasActiveFilters = computed(() => this.filtroNombre().trim().length > 0);

  displayDialog = signal(false);
  isEdit = signal(false);
  currentBarrio: Partial<BarriosRecord> = {};
  currentId = '';

  extrasModel = model<ExtraPersistido[]>([]);

  clearFilters(): void {
    this.filtroNombre.set('');
  }

  openNew(): void {
    this.currentBarrio = {};
    this.currentId = '';
    this.extrasModel.set([]);
    this.isEdit.set(false);
    this.displayDialog.set(true);
  }

  editBarrio(barrio: BarriosResponse): void {
    this.currentBarrio = { ...barrio };
    this.currentId = barrio.id;
    this.extrasModel.set(this.parseExtras(barrio.extras));
    this.isEdit.set(true);
    this.displayDialog.set(true);
  }

  async onBarrioFormSave(event: BarrioFormSavePayload): Promise<void> {
    try {
      const payload = {
        ...event.barrio,
        extras: sanitizeExtrasPayload(event.extras)
      } as Partial<BarriosResponse>;

      if (this.isEdit()) {
        await this.barriosService.update(this.currentId, payload);
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Barrio actualizado'
        });
      } else {
        await this.barriosService.create(payload);
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Barrio creado'
        });
      }
      this.displayDialog.set(false);
      this.barrios.reload();
    } catch (err: unknown) {
      this.barrioFormDialog?.stopSaving();
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async deleteBarrio(barrio: BarriosResponse): Promise<void> {
    if (!confirm(`¿Estás seguro de eliminar el barrio ${barrio.nombre}?`)) {
      return;
    }
    try {
      await this.barriosService.delete(barrio.id);
      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Barrio eliminado'
      });
      this.barrios.reload();
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo eliminar el barrio'
      });
    }
  }

  private createAccesoList<T>(
    loader: (barrioIds: string[] | null) => Promise<T[]>
  ): ReloadableSignal<T[]> {
    const data = signal<T[]>([]) as ReloadableSignal<T[]>;
    const load = async () => {
      const role = this.authService.currentUser()?.['role'] as string | undefined;
      let barrioIds: string[] | null = null;
      if (role && role !== 'admin') {
        barrioIds = this.vendedorAcceso.barriosVisibles();
        if (barrioIds === null) {
          data.set([]);
          return;
        }
      }
      data.set(await loader(barrioIds));
    };
    data.reload = () => {
      void load();
    };
    void load();
    return data;
  }

  private parseExtras(raw: unknown): ExtraPersistido[] {
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const first = raw[0] as { extra_id?: string };
    if (first && typeof first.extra_id === 'string') {
      return raw as ExtraPersistido[];
    }
    return [];
  }
}

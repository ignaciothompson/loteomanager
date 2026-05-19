import { Component, ViewChild, computed, inject, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  UnidadesService,
  BarriosService,
  ArquitectosService,
  AuthService,
  DefinicionesCacheService
} from '@loteomanager/shared-pb-client';
import { UnidadesRecord, UnidadesResponse, BarriosResponse, ExtraPersistido, sanitizeExtrasPayload } from '@loteomanager/shared-types';
import { EstadoBadgeComponent } from '@loteomanager/shared-ui';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import type { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import {
  UnidadFormDialogComponent,
  type UnidadFormSavePayload
} from './dialogs/unidad-form-dialog.component';
import { BarrioRapidoDialogComponent } from './dialogs/barrio-rapido-dialog.component';

@Component({
  selector: 'app-unidades',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    SelectModule,
    AutoCompleteModule,
    ToastModule,
    EstadoBadgeComponent,
    UnidadFormDialogComponent,
    BarrioRapidoDialogComponent
  ],
  providers: [MessageService],
  templateUrl: './unidades.component.html',
  styleUrls: ['./unidades.component.css']
})
export class UnidadesComponent {
  @ViewChild(UnidadFormDialogComponent)
  private unidadFormDialog?: UnidadFormDialogComponent;

  private unidadesService = inject(UnidadesService);
  private barriosService = inject(BarriosService);
  private arquitectosService = inject(ArquitectosService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);
  definicionesCache = inject(DefinicionesCacheService);

  unidades = this.unidadesService.list(undefined, { expand: 'barrio_id' });
  barrios = this.barriosService.list();
  arquitectos = this.arquitectosService.list();

  displayDialog = signal(false);
  isEdit = signal(false);
  /** Unidad id with inline estado editor open in the table row. */
  editingEstadoUnidadId = signal<string | null>(null);
  currentUnidad: Partial<UnidadesRecord> = {};
  currentId = '';

  extrasModel = model<ExtraPersistido[]>([]);

  displayBarrioDialog = signal(false);
  newBarrioName = signal('');

  unidadEstadoOpts = computed(() =>
    this.definicionesCache.estadosActivosPara('unidades').map((s) => ({
      label: s.nombre,
      value: s.code
    }))
  );

  filterBarrio = signal<BarriosResponse | null>(null);
  filterTipo = signal<string | null>(null);
  filterEstado = signal<string | null>(null);
  barrioSuggestions = signal<BarriosResponse[]>([]);

  /** Keeps table rows in sync when barrios catalog loads after unidades. */
  private readonly barriosCatalogTick = computed(() => this.barrios().length);

  unidadesFiltradas = computed(() => {
    this.barriosCatalogTick();
    let rows = this.unidades();
    const barrioId = this.filterBarrio()?.id;
    const tipo = this.filterTipo();
    const estado = this.filterEstado();
    if (barrioId) rows = rows.filter((u) => this.resolveBarrioId(u.barrio_id) === barrioId);
    if (tipo) rows = rows.filter((u) => u.tipo_unidad === tipo);
    if (estado) rows = rows.filter((u) => u.estado === estado);
    return rows;
  });

  hasActiveFilters = computed(
    () => !!this.filterBarrio() || !!this.filterTipo() || !!this.filterEstado()
  );

  tipos: { label: string; value: string }[] = [
    { label: 'Lote', value: 'lote' },
    { label: 'Casa', value: 'casa' },
    { label: 'Departamento', value: 'departamento' }
  ];

  monedas: { label: string; value: string }[] = [
    { label: 'USD', value: 'USD' },
    { label: 'ARS', value: 'ARS' }
  ];

  searchBarrios(event: AutoCompleteCompleteEvent): void {
    const q = event.query.toLowerCase().trim();
    this.barrioSuggestions.set(
      this.barrios().filter((b) => !q || b.nombre.toLowerCase().includes(q))
    );
  }

  clearFilters(): void {
    this.filterBarrio.set(null);
    this.filterTipo.set(null);
    this.filterEstado.set(null);
    this.barrioSuggestions.set([]);
  }

  getBarrioName(unidad: UnidadesResponse): string {
    const expanded = this.getExpandedBarrio(unidad);
    if (expanded?.nombre) return expanded.nombre;

    const id = this.resolveBarrioId(unidad.barrio_id);
    if (!id) return 'Sin barrio';
    const barrio = this.barrios().find((b) => b.id === id);
    return barrio?.nombre ?? 'Sin barrio';
  }

  private getExpandedBarrio(unidad: UnidadesResponse): BarriosResponse | undefined {
    const expand = (unidad as UnidadesResponse & { expand?: { barrio_id?: BarriosResponse } }).expand;
    const raw = expand?.barrio_id;
    return raw && typeof raw === 'object' && 'nombre' in raw ? raw : undefined;
  }

  private resolveBarrioId(
    barrioId: string | string[] | { id: string } | null | undefined
  ): string | undefined {
    if (typeof barrioId === 'string') return barrioId || undefined;
    if (Array.isArray(barrioId) && barrioId.length) return barrioId[0];
    if (barrioId && typeof barrioId === 'object' && 'id' in barrioId) {
      return barrioId.id;
    }
    return undefined;
  }

  private parseExtras(raw: unknown): ExtraPersistido[] {
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const first = raw[0] as { extra_id?: string };
    if (first && typeof first.extra_id === 'string') {
      return raw as ExtraPersistido[];
    }
    return [];
  }

  openNew() {
    this.currentUnidad = {
      tipo_unidad: 'lote',
      moneda: 'USD',
      estado: 'disponible',
      responsable_id: this.authService.currentUser()?.['id'] as string
    };
    this.extrasModel.set([]);
    this.isEdit.set(false);
    this.displayDialog.set(true);
  }

  editUnidad(unidad: UnidadesResponse) {
    this.currentUnidad = { ...unidad };
    this.currentId = unidad.id;
    this.extrasModel.set(this.parseExtras((unidad as { extras?: unknown }).extras));
    this.isEdit.set(true);
    this.displayDialog.set(true);
  }

  async onUnidadFormSave(event: UnidadFormSavePayload) {
    try {
      const payload: Record<string, unknown> = {
        ...event.unidad,
        extras: sanitizeExtrasPayload(event.extras)
      };
      if (event.galeriaFiles.length) {
        payload['galeria'] = event.galeriaFiles;
      }
      if (event.planoFile) {
        payload['plano_unidad'] = event.planoFile;
      }

      const body = payload as Partial<UnidadesResponse>;

      if (this.isEdit()) {
        await this.unidadesService.update(this.currentId, body);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Unidad actualizada' });
      } else {
        await this.unidadesService.create(body);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Unidad creada' });
      }
      this.displayDialog.set(false);
      this.unidades.reload();
    } catch (err: unknown) {
      this.unidadFormDialog?.stopSaving();
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async deleteUnidad(unidad: UnidadesResponse) {
    if (confirm(`¿Estás seguro de eliminar la unidad ${unidad.codigo_interno}?`)) {
      try {
        await this.unidadesService.delete(unidad.id);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Unidad eliminada' });
        this.unidades.reload();
      } catch {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar la unidad' });
      }
    }
  }

  isEditingEstado(unidadId: string): boolean {
    return this.editingEstadoUnidadId() === unidadId;
  }

  startEstadoInlineEdit(unidadId: unknown): void {
    if (typeof unidadId !== 'string' || !unidadId) return;
    this.editingEstadoUnidadId.set(unidadId);
  }

  cancelEstadoInlineEdit(): void {
    this.editingEstadoUnidadId.set(null);
  }

  async quickCambiarEstado(unidad: UnidadesResponse, nuevoEstado: string) {
    try {
      await this.unidadesService.cambiarEstado(unidad.id, nuevoEstado);
      this.editingEstadoUnidadId.set(null);
      this.unidades.set(
        this.unidades().map((u) =>
          u.id === unidad.id
            ? { ...u, estado: nuevoEstado as UnidadesResponse['estado'] }
            : u
        )
      );
      this.messageService.add({
        severity: 'success',
        summary: 'Estado actualizado',
        detail: `La unidad ahora está en estado ${nuevoEstado}`
      });
      this.unidades.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      this.messageService.add({ severity: 'error', summary: 'Acción denegada', detail: msg });
      this.unidades.reload();
    }
  }

  openNewBarrio() {
    this.newBarrioName.set('');
    this.displayBarrioDialog.set(true);
  }

  async saveNewBarrio() {
    const nombre = this.newBarrioName().trim();
    if (!nombre) return;

    const slug = nombre
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    try {
      const response = await this.barriosService.create({
        nombre,
        slug
      });
      this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Barrio creado rápidamente' });
      this.barrios.reload();
      this.currentUnidad.barrio_id = response.id;
      this.unidadFormDialog?.setBarrioId(response.id);
      this.displayBarrioDialog.set(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear barrio';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }
}

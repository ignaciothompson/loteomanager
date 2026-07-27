import { Component, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  InteresadosService,
  AuthService,
  DefinicionesCacheService,
  VendedorAccesoService,
  type ReloadableSignal,
} from '@loteomanager/shared-pb-client';
import { InteresadosRecord, InteresadosResponse, ExtraPersistido, sanitizeExtrasPayload } from '@loteomanager/shared-types';
import { EstadoBadgeComponent } from '@loteomanager/shared-ui';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import {
  InteresadoFormDialogComponent,
  type InteresadoFormSavePayload
} from './dialogs/interesado-form-dialog.component';

@Component({
  selector: 'app-interesados',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ToastModule,
    TooltipModule,
    EstadoBadgeComponent,
    InteresadoFormDialogComponent
  ],
  providers: [MessageService],
  templateUrl: './interesados.component.html',
  styleUrl: './interesados.component.css'
})
export class InteresadosComponent {
  @ViewChild(InteresadoFormDialogComponent)
  private formDialog?: InteresadoFormDialogComponent;

  private interesadosService = inject(InteresadosService);
  private authService = inject(AuthService);
  private vendedorAcceso = inject(VendedorAccesoService);
  private messageService = inject(MessageService);
  private definicionesCache = inject(DefinicionesCacheService);

interesados = this.createAccesoList((ids) =>
    this.interesadosService.listVisibles(ids, {
      expand: 'barrio_id,unidad_id,comparativa_id',
      sort: '-created',
    })
  );

  displayDialog = signal(false);
  isEdit = signal(false);
  currentInteresado = signal<Partial<InteresadosRecord>>({});
  currentExtras = signal<ExtraPersistido[]>([]);
  currentId = '';

  filterNombre = signal('');
  filterEstado = signal<string | null>(null);

  estadoOpts = computed(() =>
    this.definicionesCache.estadosActivosPara('interesados').map((s) => ({
      label: s.nombre,
      value: s.code
    }))
  );

  interesadosFiltrados = computed(() => {
    let rows = this.interesados();
    const nombre = this.filterNombre().trim().toLowerCase();
    const estado = this.filterEstado();
    if (nombre) rows = rows.filter((i) => i.nombre.toLowerCase().includes(nombre));
    if (estado) rows = rows.filter((i) => i.estado === estado);
    return rows;
  });

  hasActiveFilters = computed(() => !!this.filterNombre().trim() || !!this.filterEstado());

constructor() {
    effect(() => {
      this.vendedorAcceso.barriosVisibles();
      this.vendedorAcceso.accesoReady();
      this.authService.currentUser();
      this.interesados.reload();
    });
  }

  contextoLabel(interesado: InteresadosResponse): string {
    const expand = (interesado as InteresadosResponse & {
      expand?: {
        comparativa_id?: { titulo?: string; id?: string };
        unidad_id?: { codigo?: string; codigo_interno?: string; id?: string };
        barrio_id?: { nombre?: string; id?: string };
      };
    }).expand;

    if (interesado.comparativa_id) {
      const titulo = expand?.comparativa_id?.titulo;
      return titulo ? `Comparativa: ${titulo}` : 'Comparativa';
    }
    if (interesado.unidad_id) {
      const codigo =
        expand?.unidad_id?.codigo_interno || expand?.unidad_id?.codigo;
      return codigo ? `Unidad: ${codigo}` : 'Unidad';
    }
    if (interesado.barrio_id) {
      const nombre = expand?.barrio_id?.nombre;
      return nombre ? `Barrio: ${nombre}` : 'Barrio';
    }
    return 'Contacto general';
  }

  clearFilters(): void {
    this.filterNombre.set('');
    this.filterEstado.set(null);
  }

  openNew(): void {
    this.currentInteresado.set({
      estado: 'nuevo',
      origen: 'manual',
      responsable_id: this.authService.currentUser()?.['id'] as string
    });
    this.currentExtras.set([]);
    this.isEdit.set(false);
    this.displayDialog.set(true);
  }

  editInteresado(interesado: InteresadosResponse): void {
    this.currentInteresado.set({ ...interesado });
    this.currentId = interesado.id;
    this.currentExtras.set(this.parseExtras((interesado as { extras?: unknown }).extras));
    this.isEdit.set(true);
    this.displayDialog.set(true);
  }

  async onSave(payload: InteresadoFormSavePayload): Promise<void> {
    try {
      const body = {
        ...payload.interesado,
        extras: sanitizeExtrasPayload(payload.extras)
      } as Partial<InteresadosResponse>;
      if (this.isEdit()) {
        await this.interesadosService.update(this.currentId, body);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Interesado actualizado' });
      } else {
        await this.interesadosService.create(body);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Interesado creado' });
      }
      this.displayDialog.set(false);
      this.interesados.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      this.formDialog?.stopSaving();
    }
  }

  async deleteInteresado(interesado: InteresadosResponse): Promise<void> {
    if (confirm(`¿Estás seguro de eliminar el lead ${interesado.nombre}?`)) {
      try {
        await this.interesadosService.delete(interesado.id);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Lead eliminado' });
        this.interesados.reload();
      } catch {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar' });
      }
    }
  }

  async markAsWon(interesado: InteresadosResponse): Promise<void> {
    const unidadId = prompt(
      'Para cerrar como ganado, ingresá el ID de la unidad (en la Fase 4 esto será un modal con buscador):'
    );
    if (unidadId) {
      try {
        await this.interesadosService.cerrarComoGanado(interesado.id, unidadId);
        this.messageService.add({
          severity: 'success',
          summary: 'Cerrado ganado',
          detail: 'Venta registrada exitosamente'
        });
        this.interesados.reload();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al cerrar venta';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    }
  }

  private parseExtras(raw: unknown): ExtraPersistido[] {
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const first = raw[0] as { extra_id?: string };
    if (first && typeof first.extra_id === 'string') {
      return raw as ExtraPersistido[];
    }
    return [];
  }

  private createAccesoList<T>(
    loader: (barrioIds: string[] | null) => Promise<T[]>
  ): ReloadableSignal<T[]> {
    const data = signal<T[]>([]) as ReloadableSignal<T[]>;
    const load = async () => {
      const { barrioIds, waiting } = this.vendedorAcceso.resolveBarrioIds();
      if (waiting) {
        data.set([]);
        return;
      }
      data.set(await loader(barrioIds));
    };
    data.reload = () => {
      void load();
    };
    void load();
    return data;
  }
}

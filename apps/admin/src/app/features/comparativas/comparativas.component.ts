import { Component, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ComparativasService,
  InteresadosService,
  UnidadesService,
  AuthService,
  VendedorAccesoService,
  type ReloadableSignal,
  isPocketBaseAutoCancel,
} from '@loteomanager/shared-pb-client';
import { ComparativasRecord, ComparativasResponse } from '@loteomanager/shared-types';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import {
  ComparativaFormDialogComponent,
  type ComparativaFormSavePayload
} from './dialogs/comparativa-form-dialog.component';

@Component({
  selector: 'app-comparativas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
    TooltipModule,
    ComparativaFormDialogComponent
  ],
  providers: [MessageService],
  templateUrl: './comparativas.component.html',
  styleUrl: './comparativas.component.css'
})
export class ComparativasComponent {
  @ViewChild(ComparativaFormDialogComponent)
  private formDialog?: ComparativaFormDialogComponent;

  private comparativasService = inject(ComparativasService);
  private interesadosService = inject(InteresadosService);
  private unidadesService = inject(UnidadesService);
  private authService = inject(AuthService);
  private vendedorAcceso = inject(VendedorAccesoService);
  private messageService = inject(MessageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  interesados = this.createAccesoList((ids) => this.interesadosService.listVisibles(ids));
  unidades = this.createAccesoList((ids) => this.unidadesService.listByBarrios(ids));
  comparativas = this.createAccesoList((ids) =>
    this.comparativasService.listVisibles(ids, this.unidadesService, { sort: '-created' })
  );

  filterCliente = signal('');
  filterTitulo = signal('');

  displayDialog = signal(false);
  readonly initialUnidadesIds = signal<string[]>([]);

  unidadesDisponibles = computed(() =>
    this.unidades().filter((u) => u.estado === 'disponible')
  );

  comparativasFiltradas = computed(() => {
    let rows = this.comparativas();
    const cliente = this.filterCliente().trim().toLowerCase();
    const titulo = this.filterTitulo().trim().toLowerCase();
    if (cliente) {
      rows = rows.filter((c) =>
        (c.cliente_destinatario_nombre || '').toLowerCase().includes(cliente)
      );
    }
    if (titulo) rows = rows.filter((c) => (c.titulo || '').toLowerCase().includes(titulo));
    return rows;
  });

  hasActiveFilters = computed(
    () => !!this.filterCliente().trim() || !!this.filterTitulo().trim()
  );

  constructor() {
    effect(() => {
      this.vendedorAcceso.barriosVisibles();
      this.vendedorAcceso.accesoReady();
      this.authService.currentUser();
      void this.interesados.reload();
      void this.unidades.reload();
      void this.comparativas.reload();
    });

    effect(() => {
      this.vendedorAcceso.accesoReady();
      const { waiting } = this.vendedorAcceso.resolveBarrioIds();
      if (waiting) return;

      const qp = this.route.snapshot.queryParamMap.get('unidades_ids');
      const interesadoQp = this.route.snapshot.queryParamMap.get('interesado_id');
      if (!qp && !interesadoQp) return;

      if (qp) {
        const ids = qp
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (ids.length) this.initialUnidadesIds.set(ids);
      }

      this.displayDialog.set(true);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { unidades_ids: null, interesado_id: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    });
  }

  clearFilters(): void {
    this.filterCliente.set('');
    this.filterTitulo.set('');
  }

  openNew(): void {
    this.initialUnidadesIds.set([]);
    this.displayDialog.set(true);
  }

  async onSave(payload: ComparativaFormSavePayload): Promise<void> {
    try {
      const interesado = this.interesados().find((i) => i.id === payload.interesadoId);
      const body: Partial<ComparativasRecord> = {
        creado_por: this.authService.currentUser()?.['id'] as string,
        tipo: 'comparacion_multiple',
        titulo: 'Comparativa de Lotes',
        unidades_ids: payload.unidades_ids,
        mensaje_personalizado: payload.mensaje_personalizado || '',
        token_publico: Math.random().toString(36).substring(2, 15)
      };
      if (interesado) {
        body.cliente_destinatario_nombre = interesado.nombre;
        body.cliente_destinatario_email = interesado.email;
      }

      const response = await this.comparativasService.crear(
        body as Omit<ComparativasRecord, 'id'>
      );

      if (payload.interesadoId) {
        await this.interesadosService.update(payload.interesadoId, {
          comparativa_id: response.record.id
        });
      }

      // Mostrar ya en tabla (reload a veces no pinta por carrera / cancel PB)
      this.comparativas.update((rows) => [
        response.record,
        ...rows.filter((r) => r.id !== response.record.id)
      ]);

      this.displayDialog.set(false);
      this.formDialog?.stopSaving();

      const url = response.url;
      try {
        await navigator.clipboard.writeText(url);
        this.messageService.add({
          severity: 'success',
          summary: 'Comparativa generada',
          detail: 'Enlace copiado al portapapeles',
          life: 5000
        });
      } catch {
        this.messageService.add({
          severity: 'success',
          summary: 'Comparativa generada',
          detail: url,
          life: 10000
        });
      }

      await this.comparativas.reload();
    } catch (err: unknown) {
      this.formDialog?.stopSaving();
      const msg = err instanceof Error ? err.message : 'Error al generar';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    }
  }

  async deleteComparativa(comp: ComparativasResponse): Promise<void> {
    if (!confirm('¿Estás seguro de eliminar este enlace comparativo?')) return;
    try {
      await this.comparativasService.delete(comp.id);
      this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Comparativa eliminada' });
      this.comparativas.update((rows) => rows.filter((r) => r.id !== comp.id));
      await this.comparativas.reload();
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar' });
    }
  }

  copyLink(token: string): void {
    void navigator.clipboard.writeText(this.publicUrl(token)).then(() => {
      this.messageService.add({
        severity: 'info',
        summary: 'Copiado',
        detail: 'Enlace copiado al portapapeles'
      });
    });
  }

  publicUrl(token: string): string {
    return `${this.comparativasService.getLandingBaseUrl()}/c/${token}`;
  }

  private createAccesoList<T>(
    loader: (barrioIds: string[] | null) => Promise<T[]>
  ): ReloadableSignal<T[]> {
    const data = signal<T[]>([]) as ReloadableSignal<T[]>;
    const load = async () => {
      try {
        const { barrioIds, waiting } = this.vendedorAcceso.resolveBarrioIds();
        if (waiting) {
          data.set([]);
          return;
        }
        data.set(await loader(barrioIds));
      } catch (err) {
        if (isPocketBaseAutoCancel(err)) return;
        console.error('[comparativas] list reload failed', err);
      }
    };
    data.reload = () => {
      void load();
    };
    return data;
  }
}

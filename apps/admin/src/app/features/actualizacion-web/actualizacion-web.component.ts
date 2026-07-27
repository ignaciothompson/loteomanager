import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BarriosService,
  PublicacionService,
  UnidadesService,
} from '@loteomanager/shared-pb-client';
import type {
  BarriosResponse,
  PublicacionHistorialResponse,
  UnidadPublicacionDiff,
  UnidadesResponse,
} from '@loteomanager/shared-types';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { ConfirmationService, MessageService } from 'primeng/api';
import { RadioButtonModule } from 'primeng/radiobutton';

type AccionCampo = 'precio' | 'estado' | 'en_oferta' | 'precio_oferta' | 'web_visible';
type PrecioModo = 'porcentaje' | 'fijo';

type BarrioPendienteRow = {
  barrio: BarriosResponse;
  diffs: UnidadPublicacionDiff[];
  selected: boolean;
  expanded: boolean;
};

@Component({
  selector: 'app-actualizacion-web',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    SelectModule,
    TableModule,
    TabsModule,
    CheckboxModule,
    InputNumberModule,
    InputTextModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    RadioButtonModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './actualizacion-web.component.html',
  styleUrl: './actualizacion-web.component.css',
})
export class ActualizacionWebComponent implements OnInit {
  private barriosSvc = inject(BarriosService);
  private unidadesSvc = inject(UnidadesService);
  private publicacionSvc = inject(PublicacionService);
  private messages = inject(MessageService);
  private confirmation = inject(ConfirmationService);

  readonly loading = signal(false);
  readonly applying = signal(false);
  readonly publishing = signal(false);

  readonly barrios = signal<BarriosResponse[]>([]);
  readonly barrioId = signal<string | null>(null);
  readonly unidades = signal<UnidadesResponse[]>([]);
  readonly selectedUnidadIds = signal<Set<string>>(new Set());

  readonly accionCampo = signal<AccionCampo>('precio');
  readonly precioModo = signal<PrecioModo>('porcentaje');
  readonly porcentaje = signal<number | null>(10);
  readonly precioFijo = signal<number | null>(null);
  readonly estadoValue = signal('disponible');
  readonly enOfertaValue = signal(true);
  readonly precioOfertaValue = signal<number | null>(null);
  readonly webVisibleValue = signal(true);

  readonly pendientes = signal<BarrioPendienteRow[]>([]);

  readonly historial = signal<PublicacionHistorialResponse[]>([]);
  readonly historialBarrioId = signal<string | null>(null);
  readonly rollingBackId = signal<string | null>(null);

  readonly buscarCodigo = signal('');

  readonly barrioOpts = computed(() =>
    this.barrios().map((b) => ({ label: b.nombre, value: b.id })),
  );

  readonly selectedCount = computed(() => this.selectedUnidadIds().size);

  readonly unidadesFiltradas = computed(() => {
    const q = this.buscarCodigo().trim().toLowerCase();
    const rows = this.unidades();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        u.codigo.toLowerCase().includes(q) ||
        (u.estado ?? '').toLowerCase().includes(q) ||
        (u.tipo_unidad ?? '').toLowerCase().includes(q),
    );
  });

  readonly previewLabel = computed(() => {
    const n = this.selectedCount();
    if (!n) return 'Seleccioná unidades para ver la vista previa.';
    const barrio = this.barrios().find((b) => b.id === this.barrioId());
    const nombre = barrio?.nombre ?? 'barrio';
    const campo = this.accionCampo();
    if (campo === 'precio') {
      if (this.precioModo() === 'porcentaje') {
        const p = this.porcentaje();
        const sample = this.unidades().find((u) => this.selectedUnidadIds().has(u.id));
        const antes = sample?.precio ?? 0;
        const despues =
          p != null ? Math.round(antes * (1 + p / 100) * 100) / 100 : antes;
        return `Vas a modificar el precio de ${n} unidades de ${nombre}: ${
          p != null && p >= 0 ? '+' : ''
        }${p}% (ej. ${antes} → ${despues}). No publica en la web.`;
      }
      return `Vas a fijar el precio de ${n} unidades de ${nombre} a ${
        this.precioFijo() ?? '—'
      }. No publica en la web.`;
    }
    return `Vas a modificar ${campo} en ${n} unidades de ${nombre}. No publica en la web.`;
  });

  readonly pendientesBarriosSeleccionados = computed(() =>
    this.pendientes().filter((p) => p.selected).map((p) => p.barrio.id),
  );

  readonly campoOpts: { label: string; value: AccionCampo }[] = [
    { label: 'Precio', value: 'precio' },
    { label: 'Estado', value: 'estado' },
    { label: 'En oferta', value: 'en_oferta' },
    { label: 'Precio oferta', value: 'precio_oferta' },
    { label: 'Visible en web', value: 'web_visible' },
  ];

  readonly estadoOpts = [
    { label: 'Disponible', value: 'disponible' },
    { label: 'Reservado', value: 'reservado' },
    { label: 'Bloqueado', value: 'bloqueado' },
    { label: 'Vendido', value: 'vendido' },
  ];

  ngOnInit(): void {
    void this.bootstrap();
  }

  async bootstrap(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.barriosSvc.listAsync(undefined, { sort: 'nombre' });
      this.barrios.set(rows);
    } finally {
      this.loading.set(false);
    }
  }

  async onBarrioChange(id: string | null): Promise<void> {
    this.barrioId.set(id);
    this.selectedUnidadIds.set(new Set());
    if (!id) {
      this.unidades.set([]);
      return;
    }
    const rows = await this.unidadesSvc.listByBarrio(id, { sort: 'codigo' });
    this.unidades.set(rows);
  }

  toggleAll(checked: boolean): void {
    if (!checked) {
      this.selectedUnidadIds.set(new Set());
      return;
    }
    this.selectedUnidadIds.set(new Set(this.unidadesFiltradas().map((u) => u.id)));
  }

  toggleOne(id: string, checked: boolean): void {
    const next = new Set(this.selectedUnidadIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedUnidadIds.set(next);
  }

  isSelected(id: string): boolean {
    return this.selectedUnidadIds().has(id);
  }

  async aplicarCambios(): Promise<void> {
    const ids = [...this.selectedUnidadIds()];
    if (!ids.length) {
      this.messages.add({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Seleccioná al menos una unidad',
      });
      return;
    }
    this.applying.set(true);
    try {
      const campo = this.accionCampo();
      if (campo === 'precio' && this.precioModo() === 'porcentaje') {
        const p = this.porcentaje() ?? 0;
        const byId = new Map(this.unidades().map((u) => [u.id, u]));
        await Promise.all(
          ids.map((id) => {
            const u = byId.get(id);
            const base = u?.precio ?? 0;
            const precio = Math.round(base * (1 + p / 100) * 100) / 100;
            return this.unidadesSvc.update(id, { precio });
          }),
        );
      } else {
        const patch = this.buildPatch();
        await Promise.all(ids.map((id) => this.unidadesSvc.update(id, patch)));
      }
      this.messages.add({
        severity: 'success',
        summary: 'Guardado',
        detail: `${ids.length} unidad(es) actualizadas. Quedan pendientes de publicar.`,
      });
      await this.onBarrioChange(this.barrioId());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al aplicar';
      this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.applying.set(false);
    }
  }

  async loadPendientes(): Promise<void> {
    this.loading.set(true);
    try {
      const barrioIds = await this.publicacionSvc.getBarriosConCambiosPendientes();
      const rows: BarrioPendienteRow[] = [];
      for (const id of barrioIds) {
        const barrio =
          this.barrios().find((b) => b.id === id) ??
          (await this.barriosSvc.getAsync(id));
        const diffs = await this.publicacionSvc.diffBarrio(id, barrio);
        rows.push({ barrio, diffs, selected: false, expanded: false });
      }
      rows.sort((a, b) => a.barrio.nombre.localeCompare(b.barrio.nombre));
      this.pendientes.set(rows);
    } finally {
      this.loading.set(false);
    }
  }

  onTabChange(value: string | number | undefined): void {
    if (String(value) === 'pendientes') void this.loadPendientes();
    if (String(value) === 'historial' && this.historialBarrioId()) {
      void this.loadHistorial();
    }
  }

  async onHistorialBarrioChange(id: string | null): Promise<void> {
    this.historialBarrioId.set(id);
    if (!id) {
      this.historial.set([]);
      return;
    }
    await this.loadHistorial();
  }

  async loadHistorial(): Promise<void> {
    const id = this.historialBarrioId();
    if (!id) return;
    this.loading.set(true);
    try {
      const rows = await this.publicacionSvc.listHistorial(id);
      this.historial.set(rows);
    } finally {
      this.loading.set(false);
    }
  }

  confirmarRollback(entry: PublicacionHistorialResponse): void {
    const id = this.historialBarrioId();
    if (!id) return;
    this.confirmation.confirm({
      header: 'Restaurar versión anterior',
      message: `Se reemplazará la publicación actual por la versión del ${new Date(
        entry.publicado_at,
      ).toLocaleString('es-UY')}. ¿Continuar?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Restaurar',
      rejectLabel: 'Cancelar',
      accept: () => void this.rollback(id, entry.id),
    });
  }

  private async rollback(barrioId: string, historialId: string): Promise<void> {
    this.rollingBackId.set(historialId);
    try {
      await this.publicacionSvc.rollback(barrioId, historialId);
      this.messages.add({
        severity: 'success',
        summary: 'Restaurado',
        detail: 'Se restauró la versión seleccionada y se publicó en la web.',
      });
      await this.loadHistorial();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al restaurar';
      this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.rollingBackId.set(null);
    }
  }

  togglePendienteBarrio(id: string, checked: boolean): void {
    this.pendientes.update((rows) =>
      rows.map((r) => (r.barrio.id === id ? { ...r, selected: checked } : r)),
    );
  }

  toggleExpand(id: string): void {
    this.pendientes.update((rows) =>
      rows.map((r) =>
        r.barrio.id === id ? { ...r, expanded: !r.expanded } : r,
      ),
    );
  }

  confirmarPublicarSeleccionados(): void {
    const ids = this.pendientesBarriosSeleccionados();
    if (!ids.length) {
      this.messages.add({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Seleccioná al menos un barrio',
      });
      return;
    }
    const nombres = this.pendientes()
      .filter((p) => p.selected)
      .map((p) => `${p.barrio.nombre} (${p.diffs.length} cambios)`)
      .join(', ');
    this.confirmation.confirm({
      header: 'Publicar barrios',
      message: `Se publicará cada barrio completo (no por unidad suelta): ${nombres}. ¿Continuar?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Publicar',
      rejectLabel: 'Cancelar',
      accept: () => void this.publicarIds(ids),
    });
  }

  confirmarPublicarTodo(): void {
    const ids = this.pendientes().map((p) => p.barrio.id);
    if (!ids.length) return;
    this.confirmation.confirm({
      header: 'Publicar todo',
      message: `Se publicarán ${ids.length} barrio(s) con todos sus cambios pendientes. ¿Continuar?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Publicar todo',
      rejectLabel: 'Cancelar',
      accept: () => void this.publicarIds(ids),
    });
  }

  async publicarIds(ids: string[]): Promise<void> {
    this.publishing.set(true);
    try {
      await this.publicacionSvc.publicarTodo(ids);
      this.messages.add({
        severity: 'success',
        summary: 'Publicado',
        detail: `${ids.length} barrio(s) publicados en la web.`,
      });
      await this.loadPendientes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al publicar';
      this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.publishing.set(false);
    }
  }

  kindSeverity(
    kind: UnidadPublicacionDiff['kind'],
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (kind) {
      case 'nueva':
        return 'success';
      case 'modificada':
        return 'warn';
      case 'oculta':
        return 'secondary';
      case 'eliminada':
        return 'danger';
      default:
        return 'info';
    }
  }

  private buildPatch(): Partial<UnidadesResponse> {
    switch (this.accionCampo()) {
      case 'precio':
        return { precio: this.precioFijo() ?? 0 };
      case 'estado':
        return { estado: this.estadoValue() };
      case 'en_oferta':
        return { en_oferta: this.enOfertaValue() };
      case 'precio_oferta':
        return { precio_oferta: this.precioOfertaValue() ?? undefined };
      case 'web_visible':
        return { web_visible: this.webVisibleValue() };
    }
  }
}

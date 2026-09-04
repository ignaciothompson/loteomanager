import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BarriosService,
  PublicacionService,
} from '@loteomanager/shared-pb-client';
import type {
  BarriosResponse,
  DiffUnidad,
  TipoCambio,
  VersionPublicacion,
} from '@loteomanager/shared-types';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { formatDateShort } from '../../shared/listado-configurable/listado-filter.util';

type BarrioPendienteRow = {
  barrio: BarriosResponse;
  diffs: DiffUnidad[];
  selected: boolean;
  expanded: boolean;
};

const TIPO_LABEL: Record<TipoCambio, { one: string; many: string; severity: 'success' | 'warn' | 'secondary' | 'danger' }> = {
  nueva: { one: 'nueva', many: 'nuevas', severity: 'success' },
  modificada: { one: 'modificada', many: 'modificadas', severity: 'warn' },
  oculta: { one: 'ocultada', many: 'ocultadas', severity: 'secondary' },
  eliminada: { one: 'eliminada', many: 'eliminadas', severity: 'danger' },
};

@Component({
  selector: 'app-publicacion-web',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CheckboxModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './publicacion-web.component.html',
  styleUrl: './publicacion-web.component.css',
})
export class PublicacionWebComponent implements OnInit {
  private barriosSvc = inject(BarriosService);
  private publicacionSvc = inject(PublicacionService);
  private messages = inject(MessageService);
  private confirmation = inject(ConfirmationService);

  readonly loading = signal(false);
  readonly publishing = signal(false);
  readonly barrios = signal<BarriosResponse[]>([]);
  readonly pendientes = signal<BarrioPendienteRow[]>([]);
  readonly panelBarrioId = signal<string | null>(null);
  readonly versiones = signal<VersionPublicacion[]>([]);
  readonly panelOpenMobile = signal(false);

  readonly selectedIds = computed(() =>
    this.pendientes().filter((p) => p.selected).map((p) => p.barrio.id),
  );

  readonly unidadesAfectadas = computed(() =>
    this.pendientes().reduce((n, r) => n + r.diffs.length, 0),
  );

  readonly publicadosSobreTotal = computed(() => {
    const all = this.barrios();
    const pub = all.filter((b) => b.publicado || b.snapshot).length;
    return { pub, total: all.length };
  });

  readonly ultimaPublicacion = computed(() => {
    const dates = this.barrios()
      .map((b) => b.publicado_at)
      .filter((d): d is string => !!d)
      .sort()
      .reverse();
    return dates[0] ? formatDateShort(dates[0]) : null;
  });

  readonly panelBarrio = computed(() => {
    const id = this.panelBarrioId();
    if (!id) return null;
    return (
      this.pendientes().find((p) => p.barrio.id === id) ??
      this.barrios()
        .filter((b) => b.id === id)
        .map((barrio) => ({ barrio, diffs: [] as DiffUnidad[], selected: false, expanded: false }))[0] ??
      null
    );
  });

  ngOnInit(): void {
    void this.bootstrap();
  }

  async bootstrap(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.barriosSvc.listAsync(undefined, { sort: 'nombre' });
      this.barrios.set(rows);
      await this.loadPendientes(rows);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudieron cargar los cambios';
      this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loading.set(false);
    }
  }

  async loadPendientes(barriosPre?: BarriosResponse[]): Promise<void> {
    const barrioIds = await this.publicacionSvc.getBarriosConCambiosPendientes();
    const known = barriosPre ?? this.barrios();
    const rows: BarrioPendienteRow[] = [];
    for (const id of barrioIds) {
      const barrio = known.find((b) => b.id === id) ?? (await this.barriosSvc.getAsync(id));
      const diffs = await this.publicacionSvc.diffBarrio(id, barrio);
      rows.push({ barrio, diffs, selected: false, expanded: false });
    }
    rows.sort((a, b) => a.barrio.nombre.localeCompare(b.barrio.nombre));
    this.pendientes.set(rows);
  }

  conteos(diffs: DiffUnidad[]): { tipo: TipoCambio; n: number }[] {
    const map = new Map<TipoCambio, number>();
    for (const d of diffs) map.set(d.tipo, (map.get(d.tipo) ?? 0) + 1);
    return (['modificada', 'nueva', 'oculta', 'eliminada'] as TipoCambio[])
      .map((tipo) => ({ tipo, n: map.get(tipo) ?? 0 }))
      .filter((c) => c.n > 0);
  }

  chipLabel(tipo: TipoCambio, n: number): string {
    const meta = TIPO_LABEL[tipo];
    return `${n} ${n === 1 ? meta.one : meta.many}`;
  }

  chipSeverity(tipo: TipoCambio) {
    return TIPO_LABEL[tipo].severity;
  }

  tipoLabel(tipo: TipoCambio): string {
    return TIPO_LABEL[tipo].one;
  }

  nuncaPublicado(b: BarriosResponse): boolean {
    return !b.publicado && !b.snapshot;
  }

  fechaPub(b: BarriosResponse): string | null {
    return b.publicado_at ? formatDateShort(b.publicado_at) : null;
  }

  formatFecha(iso: string): string {
    return formatDateShort(iso);
  }

  toggleSelect(id: string, checked: boolean): void {
    this.pendientes.update((rows) =>
      rows.map((r) => (r.barrio.id === id ? { ...r, selected: checked } : r)),
    );
  }

  toggleExpand(id: string): void {
    this.pendientes.update((rows) =>
      rows.map((r) => (r.barrio.id === id ? { ...r, expanded: !r.expanded } : r)),
    );
    this.selectPanel(id);
  }

  selectPanel(id: string): void {
    this.panelBarrioId.set(id);
    this.panelOpenMobile.set(true);
    void this.loadVersiones(id);
  }

  closePanelMobile(): void {
    this.panelOpenMobile.set(false);
  }

  async loadVersiones(barrioId: string): Promise<void> {
    try {
      const rows = await this.publicacionSvc.listarVersiones(barrioId);
      this.versiones.set(rows);
    } catch (err) {
      console.error('[publicacion-web] no se pudo cargar el historial', err);
      this.versiones.set([]);
      this.messages.add({
        severity: 'warn',
        summary: 'Historial',
        detail: 'No se pudo cargar el historial de este barrio.',
      });
    }
  }

  confirmarPublicarSeleccionados(): void {
    const ids = this.selectedIds();
    if (!ids.length) return;
    this.confirmarPublicar(ids, 'Publicar seleccionados');
  }

  confirmarPublicarTodo(): void {
    const ids = this.pendientes().map((p) => p.barrio.id);
    if (!ids.length) return;
    this.confirmarPublicar(ids, 'Publicar todo');
  }

  confirmarPublicarEste(): void {
    const id = this.panelBarrioId();
    if (!id) return;
    this.confirmarPublicar([id], 'Publicar este barrio');
  }

  private confirmarPublicar(ids: string[], header: string): void {
    const nombres = ids
      .map((id) => {
        const row = this.pendientes().find((p) => p.barrio.id === id);
        const b = row?.barrio ?? this.barrios().find((x) => x.id === id);
        const n = row?.diffs.length ?? 0;
        return b ? `${b.nombre} (${n} cambios)` : id;
      })
      .join(', ');
    const total = ids.reduce((acc, id) => {
      const row = this.pendientes().find((p) => p.barrio.id === id);
      return acc + (row?.diffs.length ?? 0);
    }, 0);
    this.confirmation.confirm({
      header,
      message: `Se publicará${ids.length === 1 ? '' : 'n'} ${ids.length} barrio${ids.length === 1 ? '' : 's'} (${total} cambios). La versión actual queda en el historial. Se regenera el catálogo web completo del barrio, no solo las unidades que cambiaron. ${nombres}`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Publicar',
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
        detail: `${ids.length} barrio${ids.length === 1 ? '' : 's'} publicado${ids.length === 1 ? '' : 's'} en la web.`,
      });
      const keepPanel = this.panelBarrioId();
      await this.bootstrap();
      if (keepPanel) {
        this.panelBarrioId.set(keepPanel);
        await this.loadVersiones(keepPanel);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al publicar';
      this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.publishing.set(false);
    }
  }
}

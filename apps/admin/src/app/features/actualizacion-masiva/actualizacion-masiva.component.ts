import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BarriosService,
  DefinicionesCacheService,
  PermisosService,
  PublicacionService,
  UnidadesService,
} from '@loteomanager/shared-pb-client';
import type { BarriosResponse, UnidadesResponse } from '@loteomanager/shared-types';
import { formatPrecio, TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
import type { TipoUnidadIngreso } from '@loteomanager/shared-types';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { EstadoBadgeComponent } from '@loteomanager/shared-ui';
import { ListadoFilterCellComponent } from '../../shared/listado-configurable/listado-filter-cell.component';
import type {
  ColumnDef,
  ColumnFilterValue,
  ColumnFilters,
} from '../../shared/listado-configurable/column-def';
import { CHECK_COL_WIDTH } from '../../shared/listado-configurable/column-def';
import {
  formatMoney,
  formatNumber,
  rowMatchesFilters,
} from '../../shared/listado-configurable/listado-filter.util';
import { buildUnidadesMasivaCatalog } from './unidades-masiva.columns';

type AccionCampo = 'precio' | 'estado' | 'en_oferta' | 'web_visible';
type PrecioModo = 'porcentaje' | 'fijo';

@Component({
  selector: 'app-actualizacion-masiva',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    SelectModule,
    TableModule,
    CheckboxModule,
    InputNumberModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    RadioButtonModule,
    EstadoBadgeComponent,
    ListadoFilterCellComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './actualizacion-masiva.component.html',
  styleUrls: [
    '../../shared/listado-configurable/listado-configurable.css',
    './actualizacion-masiva.component.css',
  ],
})
export class ActualizacionMasivaComponent implements OnInit {
  private barriosSvc = inject(BarriosService);
  private unidadesSvc = inject(UnidadesService);
  private publicacionSvc = inject(PublicacionService);
  private definiciones = inject(DefinicionesCacheService);
  private permisos = inject(PermisosService);
  private messages = inject(MessageService);
  private confirmation = inject(ConfirmationService);

  readonly loading = signal(false);
  readonly applying = signal(false);
  readonly barrios = signal<BarriosResponse[]>([]);
  readonly barrioId = signal<string | null>(null);
  readonly unidades = signal<UnidadesResponse[]>([]);
  readonly selectedUnidadIds = signal<Set<string>>(new Set());
  readonly filters = signal<ColumnFilters>({});
  readonly pendientesCount = signal(0);

  readonly accionCampo = signal<AccionCampo>('precio');
  readonly precioModo = signal<PrecioModo>('porcentaje');
  readonly porcentaje = signal<number | null>(10);
  readonly precioFijo = signal<number | null>(null);
  readonly estadoValue = signal('');
  readonly enOfertaValue = signal(true);
  readonly webVisibleValue = signal(true);

  readonly canPublish = computed(() => this.permisos.can('web.publish'));

  readonly barrioOpts = computed(() =>
    this.barrios().map((b) => ({ label: b.nombre, value: b.id })),
  );

  readonly catalog = computed(() =>
    buildUnidadesMasivaCatalog(this.definiciones.estadosActivosPara('unidades')),
  );

  readonly estadoOpts = computed(() =>
    this.definiciones.estadosActivosPara('unidades').map((e) => ({
      label: e.nombre,
      value: e.code,
    })),
  );

  readonly campoOpts: { label: string; value: AccionCampo }[] = [
    { label: 'Precio', value: 'precio' },
    { label: 'Estado', value: 'estado' },
    { label: 'En oferta', value: 'en_oferta' },
    { label: 'Visible en la web', value: 'web_visible' },
  ];

  readonly selectedCount = computed(() => this.selectedUnidadIds().size);

  readonly unidadesFiltradas = computed(() =>
    this.unidades().filter((row) => rowMatchesFilters(row, this.catalog(), this.filters(), '')),
  );

  readonly allFilteredSelected = computed(() => {
    const rows = this.unidadesFiltradas();
    if (!rows.length) return false;
    return rows.every((u) => this.selectedUnidadIds().has(u.id));
  });

  readonly someFilteredSelected = computed(() => {
    const rows = this.unidadesFiltradas();
    const n = rows.filter((u) => this.selectedUnidadIds().has(u.id)).length;
    return n > 0 && n < rows.length;
  });

  readonly previewValid = computed(() => {
    const campo = this.accionCampo();
    if (campo === 'precio') {
      return this.precioModo() === 'porcentaje'
        ? this.porcentaje() != null
        : this.precioFijo() != null;
    }
    if (campo === 'estado') return !!this.estadoValue();
    return true;
  });

  readonly checkColWidth = CHECK_COL_WIDTH;

  ngOnInit(): void {
    void this.bootstrap();
  }

  async bootstrap(): Promise<void> {
    this.loading.set(true);
    try {
      const [rows, pendingIds] = await Promise.all([
        this.barriosSvc.listAsync(undefined, { sort: 'nombre' }),
        this.publicacionSvc.getBarriosConCambiosPendientes(),
      ]);
      this.barrios.set(rows);
      this.pendientesCount.set(pendingIds.length);
      const estados = this.definiciones.estadosActivosPara('unidades');
      if (estados.length && !this.estadoValue()) {
        this.estadoValue.set(estados[0].code);
      }
    } finally {
      this.loading.set(false);
    }
  }

  async onBarrioChange(id: string | null): Promise<void> {
    this.barrioId.set(id);
    this.selectedUnidadIds.set(new Set());
    this.filters.set({});
    if (!id) {
      this.unidades.set([]);
      return;
    }
    this.loading.set(true);
    try {
      const rows = await this.unidadesSvc.listByBarrio(id, { sort: 'codigo' });
      this.unidades.set(rows);
    } finally {
      this.loading.set(false);
    }
  }

  filterValue(colId: string): ColumnFilterValue | null {
    return this.filters()[colId] ?? null;
  }

  setColumnFilter(colId: string, value: ColumnFilterValue): void {
    this.filters.update((cur) => ({ ...cur, [colId]: value }));
  }

  colWidth(col: ColumnDef<UnidadesResponse>): string {
    return col.ancho ? `${col.ancho}px` : '8rem';
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

  tipoLabel(code: string): string {
    return TIPO_UNIDAD_LABELS[code as TipoUnidadIngreso] ?? code;
  }

  precioText(u: UnidadesResponse): string {
    if (u.precio == null) return '—';
    return formatMoney(u.precio, u.moneda) || formatPrecio(u.precio, u.moneda);
  }

  m2Text(u: UnidadesResponse): string {
    const n = u.metros_cuadrados ?? u.area_m2;
    if (n == null) return '—';
    return formatNumber(n);
  }

  previewAfter(u: UnidadesResponse): string | null {
    if (!this.previewValid() || !this.isSelected(u.id)) return null;
    const campo = this.accionCampo();
    if (campo === 'precio') {
      const next = this.nextPrecio(u);
      return next == null ? null : formatMoney(next, u.moneda) || formatPrecio(next, u.moneda);
    }
    if (campo === 'estado') {
      return this.definiciones.estadoPorCode('unidades', this.estadoValue())?.nombre ?? this.estadoValue();
    }
    if (campo === 'en_oferta') return this.enOfertaValue() ? 'Sí' : 'No';
    return this.webVisibleValue() ? 'Sí' : 'No';
  }

  previewBefore(u: UnidadesResponse): string {
    const campo = this.accionCampo();
    if (campo === 'precio') return this.precioText(u);
    if (campo === 'estado') {
      return this.definiciones.estadoPorCode('unidades', u.estado)?.nombre ?? u.estado;
    }
    if (campo === 'en_oferta') return u.en_oferta ? 'Sí' : 'No';
    return u.web_visible ? 'Sí' : 'No';
  }

  confirmarAplicar(): void {
    const n = this.selectedCount();
    if (!n || !this.previewValid()) return;
    const barrio = this.barrios().find((b) => b.id === this.barrioId());
    const nombre = barrio?.nombre ?? 'barrio';
    this.confirmation.confirm({
      header: 'Aplicar cambios',
      message: `${nombre}: ${n} unidad${n === 1 ? '' : 'es'} · ${this.cambioFrase()}. Se actualizan los datos vivos del admin. La web sigue mostrando la versión publicada hasta que publiques el barrio.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Aplicar',
      rejectLabel: 'Cancelar',
      accept: () => void this.aplicarCambios(),
    });
  }

  async aplicarCambios(): Promise<void> {
    const ids = [...this.selectedUnidadIds()];
    if (!ids.length) return;
    this.applying.set(true);
    try {
      const byId = new Map(this.unidades().map((u) => [u.id, u]));
      const results = await Promise.allSettled(
        ids.map((id) => this.unidadesSvc.update(id, this.buildPatch(byId.get(id)))),
      );
      const ok: string[] = [];
      const fail: string[] = [];
      results.forEach((r, i) => {
        const code = byId.get(ids[i])?.codigo ?? ids[i];
        if (r.status === 'fulfilled') ok.push(code);
        else fail.push(code);
      });
      if (fail.length) {
        this.messages.add({
          severity: 'warn',
          summary: 'Parcial',
          detail: `${ok.length} unidades actualizadas · no se pudieron ${fail.length}: ${fail.join(', ')}`,
        });
        this.selectedUnidadIds.set(new Set(ids.filter((_, i) => results[i].status === 'rejected')));
      } else {
        this.messages.add({
          severity: 'success',
          summary: 'Actualizado',
          detail: `${ok.length} unidades actualizadas · quedaron pendientes de publicar`,
        });
        this.selectedUnidadIds.set(new Set());
      }
      await this.reloadUnidades();
      const pendingIds = await this.publicacionSvc.getBarriosConCambiosPendientes();
      this.pendientesCount.set(pendingIds.length);
    } finally {
      this.applying.set(false);
    }
  }

  private async reloadUnidades(): Promise<void> {
    const id = this.barrioId();
    if (!id) return;
    const rows = await this.unidadesSvc.listByBarrio(id, { sort: 'codigo' });
    this.unidades.set(rows);
  }

  private nextPrecio(u: UnidadesResponse): number | null {
    if (this.precioModo() === 'porcentaje') {
      const p = this.porcentaje();
      if (p == null) return null;
      return Math.round((u.precio ?? 0) * (1 + p / 100) * 100) / 100;
    }
    return this.precioFijo();
  }

  private cambioFrase(): string {
    const campo = this.accionCampo();
    if (campo === 'precio') {
      if (this.precioModo() === 'porcentaje') {
        const p = this.porcentaje() ?? 0;
        const sign = p > 0 ? '+' : '';
        return `precio ${sign}${p}%`;
      }
      return `precio fijo ${this.precioFijo() ?? '—'}`;
    }
    if (campo === 'estado') {
      const label =
        this.definiciones.estadoPorCode('unidades', this.estadoValue())?.nombre ?? this.estadoValue();
      return `estado → ${label}`;
    }
    if (campo === 'en_oferta') return `en oferta → ${this.enOfertaValue() ? 'Sí' : 'No'}`;
    return `visible en la web → ${this.webVisibleValue() ? 'Sí' : 'No'}`;
  }

  private buildPatch(u: UnidadesResponse | undefined): Partial<UnidadesResponse> {
    switch (this.accionCampo()) {
      case 'precio':
        return { precio: u ? (this.nextPrecio(u) ?? u.precio) : this.precioFijo() ?? 0 };
      case 'estado':
        return { estado: this.estadoValue() };
      case 'en_oferta':
        return { en_oferta: this.enOfertaValue() };
      case 'web_visible':
        return { web_visible: this.webVisibleValue() };
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  BarriosService,
  EstadosDefinicionesService,
  UnidadesService
} from '@loteomanager/shared-pb-client';
import { TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
import type {
  BarriosResponse,
  TipoUnidadIngreso,
  UnidadesResponse
} from '@loteomanager/shared-types';
import { EstadoBadgeComponent } from '@loteomanager/shared-ui';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';

export type BarrioVerAgruparPor = 'none' | 'precio' | 'tamano' | 'orientacion' | 'estado';

type UnidadGrupo = {
  key: string;
  label: string;
  sortOrder: number;
  unidades: UnidadesResponse[];
};

const AGRUPAR_OPTS: { label: string; value: BarrioVerAgruparPor }[] = [
  { label: 'Sin agrupar', value: 'none' },
  { label: 'Precio', value: 'precio' },
  { label: 'Tamaño', value: 'tamano' },
  { label: 'Orientación', value: 'orientacion' },
  { label: 'Estado', value: 'estado' }
];

@Component({
  selector: 'app-barrio-ver-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    SelectModule,
    TabsModule,
    TableModule,
    EstadoBadgeComponent
  ],
  templateUrl: './barrio-ver-dialog.component.html',
  styleUrl: './barrio-ver-dialog.component.css'
})
export class BarrioVerDialogComponent {
  visible = model(false);
  barrioId = input<string | null>(null);

  private barriosSvc = inject(BarriosService);
  private unidadesSvc = inject(UnidadesService);
  private estadosSvc = inject(EstadosDefinicionesService);
  private router = inject(Router);

  readonly loading = signal(false);
  readonly barrio = signal<BarriosResponse | null>(null);
  readonly unidades = signal<UnidadesResponse[]>([]);
  readonly activeTipo = model<TipoUnidadIngreso | null>(null);
  readonly agruparPor = model<BarrioVerAgruparPor>('none');
  readonly expandedGroups = signal<Set<string>>(new Set());

  readonly agruparOpts = AGRUPAR_OPTS;

  private readonly estadosOrden = signal<Record<string, number>>({});

  readonly tipoTabs = computed(() => {
    const barrio = this.barrio();
    const fromBarrio = barrio?.tipos_unidad ?? [];
    const fromUnidades = [...new Set(this.unidades().map((u) => u.tipo_unidad))] as TipoUnidadIngreso[];
    const tipos = (fromBarrio.length ? fromBarrio : fromUnidades) as TipoUnidadIngreso[];
    return tipos.map((value) => ({
      value,
      label: TIPO_UNIDAD_LABELS[value] ?? value
    }));
  });

  readonly unidadesFiltradas = computed(() => {
    const tipo = this.activeTipo();
    if (!tipo) return [];
    return this.unidades()
      .filter((u) => u.tipo_unidad === tipo)
      .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }));
  });

  readonly grupos = computed((): UnidadGrupo[] => {
    if (this.agruparPor() === 'none') return [];
    const mode = this.agruparPor();
    const map = new Map<string, UnidadesResponse[]>();

    for (const u of this.unidadesFiltradas()) {
      const key = this.groupKey(u, mode);
      const list = map.get(key) ?? [];
      list.push(u);
      map.set(key, list);
    }

    return [...map.entries()]
      .map(([key, unidades]) => ({
        key,
        label: this.groupLabel(key, mode, unidades[0]),
        sortOrder: this.groupSortOrder(key, mode, unidades[0]),
        unidades: [...unidades].sort((a, b) =>
          (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true })
        )
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  });

  readonly headerGeo = computed(() => {
    const barrio = this.barrio();
    if (!barrio) return '—';
    const expand = (barrio as BarriosResponse & {
      expand?: {
        zona_id?: { nombre?: string; expand?: { departamento_id?: { nombre?: string } } };
      };
    }).expand?.zona_id;
    const zona = expand && typeof expand === 'object' ? expand.nombre : '';
    const dept = expand?.expand?.departamento_id?.nombre ?? '';
    if (zona && dept) return `${zona} / ${dept}`;
    return zona || dept || '—';
  });

  readonly headerTipos = computed(() => {
    const tipos = this.barrio()?.tipos_unidad ?? [];
    if (!tipos.length) return '—';
    return tipos.map((t) => TIPO_UNIDAD_LABELS[t as TipoUnidadIngreso] ?? t).join(', ');
  });

  async onShow(): Promise<void> {
    const id = this.barrioId();
    if (!id) return;

    this.loading.set(true);
    this.agruparPor.set('none');
    this.expandedGroups.set(new Set());

    try {
      const [barrioRows, unidades, estados] = await Promise.all([
        this.barriosSvc.listAsync(`id="${id}"`, {
          expand: 'zona_id,zona_id.departamento_id'
        }),
        this.unidadesSvc.listByBarrio(id, { sort: 'codigo' }),
        this.estadosSvc.listByEntidadAsync('unidades')
      ]);

      const barrio = barrioRows[0] ?? null;
      this.barrio.set(barrio);
      this.unidades.set(unidades);
      this.estadosOrden.set(
        Object.fromEntries(estados.map((e, i) => [e.code, e.orden_display ?? i]))
      );

      const tabs = (barrio?.tipos_unidad?.length
        ? barrio.tipos_unidad
        : [...new Set(unidades.map((u) => u.tipo_unidad))]) as TipoUnidadIngreso[];
      this.activeTipo.set(tabs[0] ?? null);
    } finally {
      this.loading.set(false);
    }
  }

  onHide(): void {
    this.barrio.set(null);
    this.unidades.set([]);
    this.activeTipo.set(null);
    this.agruparPor.set('none');
    this.expandedGroups.set(new Set());
  }

  onAgruparChange(value: BarrioVerAgruparPor): void {
    this.agruparPor.set(value);
    this.expandedGroups.set(new Set());
  }

  irAlIngreso(): void {
    const id = this.barrioId();
    if (!id) return;
    this.visible.set(false);
    void this.router.navigate(['/barrios', id]);
  }

  toggleGrupo(key: string): void {
    this.expandedGroups.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  isGrupoExpanded(key: string): boolean {
    return this.expandedGroups().has(key);
  }

  unidadCodigo(u: UnidadesResponse): string {
    return u.codigo || u.codigo_interno || '—';
  }

  unidadNombre(u: UnidadesResponse): string {
    return u.numero_unidad?.trim() || '—';
  }

  unidadPrecio(u: UnidadesResponse): string {
    if (u.precio == null) return '—';
    return `${u.precio} ${u.moneda ?? 'USD'}`;
  }

  unidadTamano(u: UnidadesResponse): number | null {
    return u.area_m2 ?? u.metros_cuadrados ?? u.metros_construidos ?? null;
  }

  unidadOtros(u: UnidadesResponse): string {
    const parts: string[] = [];
    const tam = this.unidadTamano(u);
    if (tam != null) parts.push(`${tam} m²`);
    if (u.orientacion) parts.push(u.orientacion);
    if (u.metros_construidos != null && u.metros_construidos !== tam) {
      parts.push(`${u.metros_construidos} m² cub.`);
    }
    if (u.cocheras != null) parts.push(`${u.cocheras} coch.`);
    const extras = (u.extras ?? {}) as Record<string, unknown>;
    if (typeof extras['dormitorios'] === 'number') parts.push(`${extras['dormitorios']} dorm.`);
    if (typeof extras['banos'] === 'number') parts.push(`${extras['banos']} baños`);
    return parts.join(' · ') || '—';
  }

  tipoLabel(tipo: string): string {
    return TIPO_UNIDAD_LABELS[tipo as TipoUnidadIngreso] ?? tipo;
  }

  private groupKey(u: UnidadesResponse, mode: BarrioVerAgruparPor): string {
    switch (mode) {
      case 'precio':
        return `precio|${u.precio ?? ''}|${u.moneda ?? 'USD'}`;
      case 'tamano': {
        const t = this.unidadTamano(u);
        return `tamano|${t ?? ''}`;
      }
      case 'orientacion':
        return `orientacion|${u.orientacion ?? ''}`;
      case 'estado':
        return `estado|${u.estado ?? ''}`;
      default:
        return u.id;
    }
  }

  private groupLabel(key: string, mode: BarrioVerAgruparPor, sample: UnidadesResponse): string {
    switch (mode) {
      case 'precio':
        return sample.precio == null ? 'Sin precio' : `${sample.precio} ${sample.moneda ?? 'USD'}`;
      case 'tamano': {
        const t = this.unidadTamano(sample);
        return t == null ? 'Sin tamaño' : `${t} m²`;
      }
      case 'orientacion':
        return sample.orientacion ?? 'Sin orientación';
      case 'estado':
        return sample.estado || 'Sin estado';
      default:
        return key;
    }
  }

  private groupSortOrder(key: string, mode: BarrioVerAgruparPor, sample: UnidadesResponse): number {
    switch (mode) {
      case 'precio':
        return sample.precio ?? Number.MAX_SAFE_INTEGER;
      case 'tamano':
        return this.unidadTamano(sample) ?? Number.MAX_SAFE_INTEGER;
      case 'orientacion':
        return 0;
      case 'estado':
        return this.estadosOrden()[sample.estado] ?? Number.MAX_SAFE_INTEGER;
      default:
        return 0;
    }
  }
}

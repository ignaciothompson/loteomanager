import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  UnidadesService,
  InteresadosService,
  ComparativasService,
  AuthService,
  VendedorAccesoService,
  type ReloadableSignal,
  isPocketBaseAutoCancel,
} from '@loteomanager/shared-pb-client';
import {
  ComparativasResponse,
  InteresadosResponse,
  UnidadesResponse,
} from '@loteomanager/shared-types';
import { EstadoBadgeComponent } from '@loteomanager/shared-ui';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { LayoutService } from '@/app/layout/service/layout.service';

const CLOSED_LEAD_STATES = new Set(['cerrado_ganado', 'cerrado_perdido']);
const RESERVED_STATES = new Set(['reservado', 'sena']);
const SOLD_STATES = new Set(['vendido', 'escriturado']);
const TABLE_LIMIT = 8;
const WEEK_COUNT = 12;

const COLOR_DISPONIBLES = '#199e70';
const COLOR_RESERVADAS = '#c98500';
const COLOR_VENDIDAS = '#3987e5';
const FILL_DISPONIBLES = 'rgba(25, 158, 112, 0.22)';
const FILL_RESERVADAS = 'rgba(201, 133, 0, 0.22)';
const FILL_VENDIDAS = 'rgba(57, 135, 229, 0.22)';

type InteresadoConExpand = InteresadosResponse & {
  expand?: {
    comparativa_id?: { titulo?: string };
    unidad_id?: { codigo?: string; codigo_interno?: string };
    barrio_id?: { nombre?: string };
  };
};

type UnidadConFechas = UnidadesResponse & {
  created?: string;
  updated?: string;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ChartModule,
    TableModule,
    ButtonModule,
    EstadoBadgeComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private unidadesService = inject(UnidadesService);
  private interesadosService = inject(InteresadosService);
  private comparativasService = inject(ComparativasService);
  private authService = inject(AuthService);
  private vendedorAcceso = inject(VendedorAccesoService);
  private layoutService = inject(LayoutService);

  unidades = this.createAccesoList('unidades', (ids) => this.unidadesService.listByBarrios(ids));
  interesados = this.createAccesoList('interesados', (ids) =>
    this.interesadosService.listVisibles(ids, {
      expand: 'barrio_id,unidad_id,comparativa_id',
      sort: '-created',
    })
  );
  comparativas = this.createAccesoList('comparativas', () => this.comparativasService.listAsync());

  disponiblesCount = computed(
    () => this.unidades().filter((u) => u.estado === 'disponible').length
  );
  reservadasCount = computed(
    () => this.unidades().filter((u) => u.estado === 'reservado' || u.estado === 'sena').length
  );
  ventasCount = computed(
    () => this.unidades().filter((u) => u.estado === 'vendido' || u.estado === 'escriturado').length
  );
  leadsActivosCount = computed(
    () => this.interesados().filter((i) => !CLOSED_LEAD_STATES.has(i.estado)).length
  );

  leadsRecientes = computed(() =>
    [...this.interesados()]
      .sort((a, b) => recordTimestamp(b).localeCompare(recordTimestamp(a)))
      .slice(0, TABLE_LIMIT)
  );

  private comparativasVisibles = computed(() => {
    const rows = this.comparativas();
    const { barrioIds, waiting } = this.vendedorAcceso.resolveBarrioIds();
    if (waiting) return [];
    let visible = rows;
    if (barrioIds !== null) {
      const unitIds = new Set(this.unidades().map((u) => u.id));
      if (unitIds.size === 0) return [];
      visible = rows.filter((c) => (c.unidades_ids || []).some((id) => unitIds.has(id)));
    }
    return [...visible].sort((a, b) => recordTimestamp(b).localeCompare(recordTimestamp(a)));
  });

  actividadReciente = computed(() => this.comparativasVisibles().slice(0, TABLE_LIMIT));

  private evolucionSemanal = computed(() => buildEvolucionSemanal(this.unidades()));

  chartData = computed((): ChartData<'line'> => {
    const series = this.evolucionSemanal();
    return {
      labels: series.map((w) => w.label),
      datasets: [
        {
          label: 'Vendidas',
          data: series.map((w) => w.vendidas),
          fill: true,
          backgroundColor: FILL_VENDIDAS,
          borderColor: COLOR_VENDIDAS,
          tension: 0,
          pointRadius: 0,
          borderWidth: 2,
          stack: 'stock',
        },
        {
          label: 'Reservadas',
          data: series.map((w) => w.reservadas),
          fill: true,
          backgroundColor: FILL_RESERVADAS,
          borderColor: COLOR_RESERVADAS,
          tension: 0,
          pointRadius: 0,
          borderWidth: 2,
          stack: 'stock',
        },
        {
          label: 'Disponibles',
          data: series.map((w) => w.disponibles),
          fill: true,
          backgroundColor: FILL_DISPONIBLES,
          borderColor: COLOR_DISPONIBLES,
          tension: 0,
          pointRadius: 0,
          borderWidth: 2,
          stack: 'stock',
        },
      ],
    };
  });

  chartOptions = computed((): ChartOptions<'line'> => {
    const dark = this.layoutService.isDarkTheme();
    const legendColor = dark ? '#c3c2b7' : '#334155';
    const gridColor = dark ? '#2c2c2a' : 'rgba(0, 0, 0, 0.08)';
    const tickColor = dark ? '#c3c2b7' : '#334155';
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: legendColor },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            footer: (items: TooltipItem<'line'>[]) => {
              const total = items.reduce((sum, item) => sum + (item.parsed.y ?? 0), 0);
              return `Ingresadas: ${total}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: tickColor, maxTicksLimit: 5 },
          grid: { display: false },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { color: tickColor, precision: 0 },
          grid: { color: gridColor },
        },
      },
    };
  });

  constructor() {
    effect(() => {
      this.vendedorAcceso.barriosVisibles();
      this.vendedorAcceso.accesoReady();
      this.authService.currentUser();
      this.unidades.reload();
      this.interesados.reload();
      this.comparativas.reload();
    });
  }

  contextoLabel(interesado: InteresadosResponse): string {
    const expand = (interesado as InteresadoConExpand).expand;
    if (interesado.comparativa_id) {
      const titulo = expand?.comparativa_id?.titulo;
      return titulo ? `Comparativa: ${titulo}` : 'Comparativa';
    }
    if (interesado.unidad_id) {
      const codigo = expand?.unidad_id?.codigo_interno || expand?.unidad_id?.codigo;
      return codigo ? `Unidad: ${codigo}` : 'Unidad';
    }
    if (interesado.barrio_id) {
      const nombre = expand?.barrio_id?.nombre;
      return nombre ? `Barrio: ${nombre}` : 'Barrio';
    }
    return 'Contacto general';
  }

  fechaLabel(row: object): string {
    const raw = recordTimestamp(row);
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return formatDdMmYyyy(d);
  }

  vistasCount(comp: ComparativasResponse): number {
    return comp.vistas_count ?? 0;
  }

  private createAccesoList<T>(
    label: string,
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
        const detail = (err as { data?: unknown }).data ?? err;
        console.error(`[dashboard] ${label} reload failed`, detail);
      }
    };
    data.reload = () => {
      void load();
    };
    return data;
  }
}

type SemanaStock = {
  label: string;
  ingresadas: number;
  vendidas: number;
  reservadas: number;
  disponibles: number;
};

function buildEvolucionSemanal(unidades: UnidadesResponse[]): SemanaStock[] {
  const weeks = lastWeekEnds(WEEK_COUNT);
  const dated = unidades.map(unidadFechas);
  return weeks.map((week) => {
    const t = week.endMs;
    let ingresadas = 0;
    let vendidas = 0;
    let reservadas = 0;
    for (const u of dated) {
      if (u.ingresoMs > t) continue;
      ingresadas += 1;
      const sold = u.ventaMs !== null && u.ventaMs <= t;
      if (sold) {
        vendidas += 1;
        continue;
      }
      if (u.reservaMs !== null && u.reservaMs <= t) {
        reservadas += 1;
      }
    }
    return {
      label: week.label,
      ingresadas,
      vendidas,
      reservadas,
      disponibles: Math.max(0, ingresadas - reservadas - vendidas),
    };
  });
}

function unidadFechas(unidad: UnidadesResponse): {
  ingresoMs: number;
  reservaMs: number | null;
  ventaMs: number | null;
} {
  const row = unidad as UnidadConFechas;
  const updatedMs = parseTime(row.updated);
  const ingresoMs =
    parseTime(row.created) ?? parseTime(unidad.fecha_ingreso) ?? updatedMs ?? 0;
  const ventaMs =
    parseTime(unidad.fecha_venta) ??
    parseTime(unidad.fecha_escritura) ??
    (SOLD_STATES.has(unidad.estado) ? (updatedMs ?? 0) : null);
  const reservaMs =
    parseTime(unidad.fecha_reserva) ??
    parseTime(unidad.fecha_sena) ??
    (RESERVED_STATES.has(unidad.estado) && ventaMs === null ? (updatedMs ?? 0) : null);
  return { ingresoMs, reservaMs, ventaMs };
}

function lastWeekEnds(count: number): { label: string; endMs: number }[] {
  const thisWeekStart = startOfWeek(new Date());
  const weeks: { label: string; endMs: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(thisWeekStart);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setMilliseconds(-1);
    weeks.push({ label: formatDdMm(start), endMs: end.getTime() });
  }
  return weeks;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseTime(iso?: string | null): number | null {
  if (!iso) return null;
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T');
  const t = Date.parse(normalized);
  return Number.isNaN(t) ? null : t;
}

function formatDdMm(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function formatDdMmYyyy(d: Date): string {
  return `${formatDdMm(d)}/${d.getFullYear()}`;
}

function recordTimestamp(row: object): string {
  const r = row as { created?: string; updated?: string };
  return r.created || r.updated || '';
}

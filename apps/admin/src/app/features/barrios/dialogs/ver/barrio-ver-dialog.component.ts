import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  BarriosService,
  EstadosDefinicionesService,
  PermisosService,
  UnidadesService
} from '@loteomanager/shared-pb-client';
import { formatPrecio, TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
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
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem, MessageService } from 'primeng/api';

export type BarrioVerAgruparPor = 'none' | 'precio' | 'tamano' | 'orientacion' | 'estado';
export type BarrioVerEstadoFiltro = 'disponibles' | 'reservadas' | 'todas';
export type BarrioVerPrecioOrden = 'asc' | 'desc' | 'none';

type UnidadGrupo = {
  key: string;
  label: string;
  sortOrder: number;
  unidades: UnidadesResponse[];
};

type PubBadgeKind = 'publicado' | 'sin_publicar' | 'pendiente';

const AGRUPAR_OPTS: { label: string; value: BarrioVerAgruparPor }[] = [
  { label: 'Sin agrupar', value: 'none' },
  { label: 'Precio', value: 'precio' },
  { label: 'Tamaño', value: 'tamano' },
  { label: 'Orientación', value: 'orientacion' },
  { label: 'Estado', value: 'estado' }
];

const RESERVED = new Set(['reservado', 'sena']);

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
    CheckboxModule,
    TooltipModule,
    InputTextModule,
    MenuModule,
    EstadoBadgeComponent,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './barrio-ver-dialog.component.html',
  styleUrl: './barrio-ver-dialog.component.css'
})
export class BarrioVerDialogComponent {
  @ViewChild('footerMenu') footerMenu?: Menu;

  visible = model(false);
  barrioId = input<string | null>(null);
  deleted = output<void>();
  unidadesChanged = output<void>();

  private barriosSvc = inject(BarriosService);
  private unidadesSvc = inject(UnidadesService);
  private estadosSvc = inject(EstadosDefinicionesService);
  private permisos = inject(PermisosService);
  private router = inject(Router);
  private messages = inject(MessageService);

  readonly loading = signal(false);
  readonly deleting = signal(false);
  readonly barrio = signal<BarriosResponse | null>(null);
  readonly unidades = signal<UnidadesResponse[]>([]);
  readonly activeTipo = model<TipoUnidadIngreso | null>(null);
  readonly agruparPor = model<BarrioVerAgruparPor>('none');
  readonly estadoFiltro = signal<BarrioVerEstadoFiltro>('disponibles');
  readonly precioOrden = signal<BarrioVerPrecioOrden>('none');
  readonly expandedGroups = signal<Set<string>>(new Set());
  readonly selectedUnidades = signal<UnidadesResponse[]>([]);

  readonly deleteConfirmVisible = signal(false);
  readonly deleteNameInput = signal('');

  footerMenuItems: MenuItem[] = [];

  readonly agruparOpts = AGRUPAR_OPTS;

  private readonly estadosOrden = signal<Record<string, number>>({});

  readonly canDeleteBarrio = computed(() => this.permisos.can('barrios.delete'));
  readonly canCreateComparativa = computed(() => this.permisos.can('comparativas.create'));
  readonly canPublishWeb = computed(() => this.permisos.can('web.publish'));

  readonly deleteNameMatches = computed(() => {
    const barrio = this.barrio();
    if (!barrio) return false;
    return this.deleteNameInput().trim() === barrio.nombre;
  });

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

  readonly stats = computed(() => {
    const all = this.unidades();
    const disp = all.filter((u) => u.estado === 'disponible');
    const res = all.filter((u) => RESERVED.has(u.estado ?? ''));
    let precioDesde: number | null = null;
    let moneda: 'USD' | 'ARS' = 'USD';
    for (const u of disp) {
      if (u.precio == null) continue;
      if (precioDesde == null || u.precio < precioDesde) {
        precioDesde = u.precio;
        moneda = (u.moneda === 'ARS' ? 'ARS' : 'USD') as 'USD' | 'ARS';
      }
    }
    return {
      total: all.length,
      disponibles: disp.length,
      reservadas: res.length,
      precioDesde,
      moneda,
      precioLabel:
        precioDesde == null ? '—' : formatPrecio(precioDesde, moneda)
    };
  });

  readonly pubBadge = computed(() => {
    const all = this.unidades();
    const pendiente = all.filter((u) => u.pendiente_publicar === true).length;
    if (pendiente > 0) {
      return {
        kind: 'pendiente' as PubBadgeKind,
        label: pendiente === 1 ? '1 sin publicar' : `${pendiente} sin publicar`
      };
    }
    if (this.barrio()?.publicado) {
      return { kind: 'publicado' as PubBadgeKind, label: 'Publicado' };
    }
    return { kind: 'sin_publicar' as PubBadgeKind, label: 'Sin publicar' };
  });

  readonly unidadesFiltradas = computed(() => {
    const tipo = this.activeTipo();
    if (!tipo) return [];
    const filtro = this.estadoFiltro();
    let rows = this.unidades().filter((u) => u.tipo_unidad === tipo);
    if (filtro === 'disponibles') {
      rows = rows.filter((u) => u.estado === 'disponible');
    } else if (filtro === 'reservadas') {
      rows = rows.filter((u) => RESERVED.has(u.estado ?? ''));
    }
    const orden = this.precioOrden();
    if (orden === 'asc' || orden === 'desc') {
      const dir = orden === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const pa = a.precio ?? Number.MAX_SAFE_INTEGER;
        const pb = b.precio ?? Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return (pa - pb) * dir;
        return (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true });
      });
    } else {
      rows = [...rows].sort((a, b) =>
        (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true })
      );
    }
    return rows;
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
    const expand = (
      barrio as BarriosResponse & {
        expand?: {
          zona_id?: { nombre?: string; expand?: { departamento_id?: { nombre?: string } } };
        };
      }
    ).expand?.zona_id;
    const zona = expand && typeof expand === 'object' ? expand.nombre : '';
    const dept = expand?.expand?.departamento_id?.nombre ?? '';
    if (zona && dept) return `${zona} / ${dept}`;
    return zona || dept || '—';
  });

  readonly selectedCount = computed(() => this.selectedUnidades().length);

  readonly comparativaUnidadesLabel = computed(() => {
    const n = this.selectedCount();
    return n === 1 ? 'Crear comparativa (1 unidad)' : `Crear comparativa (${n} unidades)`;
  });

  async onShow(): Promise<void> {
    const id = this.barrioId();
    if (!id) return;

    this.loading.set(true);
    this.agruparPor.set('none');
    this.precioOrden.set('none');
    this.expandedGroups.set(new Set());
    this.selectedUnidades.set([]);

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

      const hasDisp = unidades.some((u) => u.estado === 'disponible');
      this.estadoFiltro.set(hasDisp ? 'disponibles' : 'todas');
    } finally {
      this.loading.set(false);
    }
  }

  onHide(): void {
    this.barrio.set(null);
    this.unidades.set([]);
    this.activeTipo.set(null);
    this.agruparPor.set('none');
    this.precioOrden.set('none');
    this.expandedGroups.set(new Set());
    this.selectedUnidades.set([]);
    this.deleteConfirmVisible.set(false);
    this.deleteNameInput.set('');
  }

  setEstadoFiltro(value: BarrioVerEstadoFiltro): void {
    this.estadoFiltro.set(value);
    this.selectedUnidades.set([]);
  }

  onTipoChange(value: TipoUnidadIngreso): void {
    this.activeTipo.set(value);
    this.selectedUnidades.set([]);
  }

  togglePrecioOrden(): void {
    this.precioOrden.update((o) => (o === 'none' ? 'asc' : o === 'asc' ? 'desc' : 'none'));
  }

  onAgruparChange(value: BarrioVerAgruparPor): void {
    this.agruparPor.set(value);
    this.expandedGroups.set(new Set());
  }

  isSelected(u: UnidadesResponse): boolean {
    return this.selectedUnidades().some((x) => x.id === u.id);
  }

  toggleSelect(u: UnidadesResponse, checked: boolean): void {
    this.selectedUnidades.update((list) => {
      if (checked) {
        if (list.some((x) => x.id === u.id)) return list;
        return [...list, u];
      }
      return list.filter((x) => x.id !== u.id);
    });
  }

  irAlIngreso(focusUnidad = false): void {
    const id = this.barrioId();
    if (!id) return;
    this.visible.set(false);
    void this.router.navigate(
      ['/barrios', id],
      focusUnidad ? { queryParams: { focus: 'unidad' } } : undefined
    );
  }

  editarUnidad(u: UnidadesResponse): void {
    const id = this.barrioId();
    if (!id) return;
    this.visible.set(false);
    void this.router.navigate(['/barrios', id], { queryParams: { unidad: u.id } });
  }

  crearComparativa(): void {
    if (!this.canCreateComparativa()) return;
    const disponibles = this.selectedUnidades().filter((u) => u.estado === 'disponible');
    if (!disponibles.length) {
      this.messages.add({
        severity: 'warn',
        summary: 'Sin disponibles',
        detail: 'Seleccioná al menos una unidad disponible para crear la comparativa.'
      });
      return;
    }
    this.visible.set(false);
    void this.router.navigate(['/enlaces'], {
      queryParams: { unidades_ids: disponibles.map((u) => u.id).join(',') }
    });
  }

  openFooterMenu(event: Event): void {
    const items: MenuItem[] = [];
    if (this.canDeleteBarrio()) {
      items.push({
        label: 'Eliminar barrio',
        icon: 'pi pi-trash',
        command: () => this.openDeleteConfirm()
      });
    }
    if (this.canPublishWeb()) {
      items.push({
        label: 'Actualización Web',
        icon: 'pi pi-globe',
        command: () => {
          this.visible.set(false);
          void this.router.navigate(['/actualizacion-web']);
        }
      });
    }
    this.footerMenuItems = items;
    if (!items.length) return;
    this.footerMenu?.toggle(event);
    // Flip up if menu would overflow viewport bottom
    setTimeout(() => this.flipMenuIfNeeded(event), 0);
  }

  private flipMenuIfNeeded(event: Event): void {
    const trigger = event.currentTarget as HTMLElement | null;
    if (!trigger) return;
    const panel =
      document.querySelector<HTMLElement>('.p-menu-overlay') ??
      document.querySelector<HTMLElement>('.p-tieredmenu-overlay') ??
      Array.from(document.querySelectorAll<HTMLElement>('.p-menu')).find((el) =>
        el.classList.contains('p-connected-overlay-enter-done') ||
        el.classList.contains('p-connected-overlay-visible') ||
        getComputedStyle(el).display !== 'none'
      );
    if (!panel) return;
    const btn = trigger.getBoundingClientRect();
    const menuH = panel.getBoundingClientRect().height;
    const spaceBelow = window.innerHeight - btn.bottom;
    if (menuH > spaceBelow - 8) {
      const top = Math.max(8, btn.top - menuH - 4);
      panel.style.top = `${top}px`;
      panel.style.bottom = 'auto';
    }
  }

  openDeleteConfirm(): void {
    this.deleteNameInput.set('');
    this.deleteConfirmVisible.set(true);
  }

  cancelDeleteConfirm(): void {
    this.deleteConfirmVisible.set(false);
    this.deleteNameInput.set('');
  }

  async confirmDeleteBarrio(): Promise<void> {
    const barrio = this.barrio();
    if (!barrio || !this.deleteNameMatches() || this.deleting()) return;
    this.deleting.set(true);
    try {
      const { unidades, plantillas } = await this.barriosSvc.deleteConDependencias(barrio.id);
      this.messages.add({
        severity: 'success',
        summary: 'Barrio eliminado',
        detail:
          unidades || plantillas
            ? `"${barrio.nombre}" eliminado (${unidades} unidad(es), ${plantillas} plantilla(s)).`
            : `"${barrio.nombre}" eliminado.`
      });
      this.deleteConfirmVisible.set(false);
      this.visible.set(false);
      this.deleted.emit();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el barrio. Puede haber comparativas u otros datos vinculados a sus unidades.';
      this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.deleting.set(false);
    }
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

  unidadPrecio(u: UnidadesResponse): string {
    if (u.precio == null) return '—';
    return formatPrecio(u.precio, u.moneda ?? 'USD');
  }

  unidadTamano(u: UnidadesResponse): number | null {
    return u.area_m2 ?? u.metros_cuadrados ?? u.metros_construidos ?? null;
  }

  unidadDetalle(u: UnidadesResponse): string {
    const parts: string[] = [];
    const tam = this.unidadTamano(u);
    if (tam != null) parts.push(`${tam} m²`);
    if (u.orientacion) parts.push(u.orientacion);
    return parts.join(' · ') || '—';
  }

  tipoLabel(tipo: string): string {
    return TIPO_UNIDAD_LABELS[tipo as TipoUnidadIngreso] ?? tipo;
  }

  precioOrdenLabel(): string {
    const o = this.precioOrden();
    if (o === 'asc') return 'Precio ↑';
    if (o === 'desc') return 'Precio ↓';
    return 'Precio';
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
        return sample.precio == null ? 'Sin precio' : this.unidadPrecio(sample);
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

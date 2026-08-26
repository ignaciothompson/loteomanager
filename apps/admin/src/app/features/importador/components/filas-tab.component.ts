import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FilaExtendida } from '../importador-types';
import type { CabezalBarrio, CorreccionSugerida, FilaLote, MapeoGeografia } from '../parser/types';
import { ImportadorService } from '../services/importador.service';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { Popover, PopoverModule } from 'primeng/popover';
import { EstadoBadgeComponent } from '@loteomanager/shared-ui';
import { formatPrecio } from '../importador-ui';
import { inferirPatronCodigo } from '../parser/patron-codigo';

export type FiltroTabla = 'todos' | 'revisar' | 'omitir' | 'sugerencias' | 'ids';

type HojaGrupo = { ref: string; cabezal: FilaExtendida; lotes: FilaExtendida[] };

@Component({
  selector: 'app-filas-tab',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    TooltipModule,
    CheckboxModule,
    PopoverModule,
    EstadoBadgeComponent,
  ],
  templateUrl: './filas-tab.component.html',
})
export class FilasTabComponent implements OnChanges {
  @ViewChild('cabPop') cabPop?: Popover;

  @Input() filas: FilaExtendida[] = [];
  @Input() estadoOpts: { label: string; value: string }[] = [];
  @Input() mapeo: MapeoGeografia | null = null;
  @Input() departamentos: Array<{ id: string; nombre: string }> = [];
  @Input() zonas: Array<{ id: string; nombre: string }> = [];
  @Input() filtro: FiltroTabla = 'todos';
  @Input() filtroIds: string[] | null = null;
  @Input() readonly = false;
  @Output() filasChanged = new EventEmitter<void>();
  @Output() mass = new EventEmitter<{ kind: 'estado' | 'moneda' | 'omitir'; ids: string[] }>();

  private importadorService = inject(ImportadorService);
  private messageService = inject(MessageService);

  saving = signal(false);
  selectedIds = signal<string[]>([]);
  collapsed = signal<Set<string>>(new Set());
  cabezalEdit = signal<HojaGrupo | null>(null);
  private lastSelectIndex: number | null = null;
  private didInitExpand = false;

  readonly monedaOpts = [
    { label: 'USD', value: 'USD' },
    { label: 'UYU', value: 'UYU' },
  ];

  readonly orientacionOpts = [
    { label: '(vacía)', value: '' },
    { label: 'Norte', value: 'Norte' },
    { label: 'Sur', value: 'Sur' },
    { label: 'Este', value: 'Este' },
    { label: 'Oeste', value: 'Oeste' },
    { label: 'Noreste', value: 'Noreste' },
    { label: 'Noroeste', value: 'Noroeste' },
    { label: 'Sureste', value: 'Sureste' },
    { label: 'Suroeste', value: 'Suroeste' },
  ];

  readonly formatPrecio = formatPrecio;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filas'] && this.filas.length && !this.didInitExpand) {
      this.didInitExpand = true;
      const collapsed = new Set<string>();
      for (const h of this.hojas) {
        if (!this.hasProblemas(h)) collapsed.add(h.ref);
      }
      this.collapsed.set(collapsed);
    }
  }

  get hojas(): HojaGrupo[] {
    const groups: HojaGrupo[] = [];
    const byRef = new Map<string, FilaExtendida[]>();
    for (const f of this.filas) {
      const ref = f.ref_barrio || f.nombre_hoja || '?';
      const arr = byRef.get(ref) ?? [];
      arr.push(f);
      byRef.set(ref, arr);
    }
    for (const [ref, rows] of byRef) {
      const cabezal = rows.find((r) => r.tipo_fila === 'barrio') ?? rows[0];
      const lotes = rows.filter((r) => r.tipo_fila === 'unidad');
      groups.push({ ref, cabezal, lotes });
    }
    return groups;
  }

  hojasVisibles(): HojaGrupo[] {
    if (this.filtro === 'todos') return this.hojas;
    return this.hojas
      .map((h) => ({ ...h, lotes: h.lotes.filter((f) => this.pasaFiltro(f)) }))
      .filter((h) => h.lotes.length || this.pasaFiltro(h.cabezal));
  }

  pasaFiltro(f: FilaExtendida): boolean {
    if (this.filtro === 'todos') return true;
    if (this.filtro === 'ids') return (this.filtroIds ?? []).includes(f.id);
    if (this.filtro === 'omitir') return f.decision_usuario === 'omitir' || f.estado_fila === 'duplicado';
    if (this.filtro === 'sugerencias') return (f.correcciones_sugeridas?.length ?? 0) > 0;
    if (this.filtro === 'revisar') {
      return (
        (f.estado_fila === 'error' || f.estado_fila === 'advertencia') &&
        f.decision_usuario !== 'omitir'
      );
    }
    return true;
  }

  cabezal(f: FilaExtendida): CabezalBarrio {
    return (f.datos_normalizados ?? {}) as CabezalBarrio;
  }

  lote(f: FilaExtendida): FilaLote {
    return (f.datos_normalizados ?? {}) as FilaLote;
  }

  sugDe(f: FilaExtendida, campo: string): CorreccionSugerida | undefined {
    return (f.correcciones_sugeridas ?? []).find((c) => c.campo === campo);
  }

  hasProblemas(h: HojaGrupo): boolean {
    if (h.cabezal.estado_fila === 'error' || h.cabezal.estado_fila === 'advertencia') return true;
    return h.lotes.some(
      (l) =>
        (l.estado_fila === 'error' || l.estado_fila === 'advertencia') &&
        l.decision_usuario !== 'omitir'
    );
  }

  warnCount(h: HojaGrupo): number {
    return h.lotes.filter(
      (l) =>
        (l.estado_fila === 'error' || l.estado_fila === 'advertencia') &&
        l.decision_usuario !== 'omitir'
    ).length;
  }

  /** Oculta aviso geo del cabezal: ya vive en panel izquierda. */
  cabezalMsgs(h: HojaGrupo): string[] {
    return (h.cabezal.mensajes ?? []).filter((m) => !/sin mapear|geograf/i.test(m));
  }

  isOpen(h: HojaGrupo): boolean {
    return !this.collapsed().has(h.ref);
  }

  toggle(ref: string): void {
    const next = new Set(this.collapsed());
    if (next.has(ref)) next.delete(ref);
    else next.add(ref);
    this.collapsed.set(next);
  }

  geoLabel(c: CabezalBarrio): string {
    const deptoId = this.mapeo?.departamentos.find((d) => d.valor_excel === c.departamento_excel)?.departamento_id;
    const zonaId = this.mapeo?.zonas.find(
      (z) => z.valor_excel === c.zona_excel && z.departamento_excel === c.departamento_excel
    )?.zona_id;
    const depto = this.departamentos.find((d) => d.id === deptoId)?.nombre || c.departamento_excel;
    const zona = this.zonas.find((z) => z.id === zonaId)?.nombre || c.zona_excel;
    return [depto, zona].filter(Boolean).join(' · ');
  }

  rowStatus(f: FilaExtendida): 'ok' | 'revisar' | 'error' | 'omitir' {
    if (f.decision_usuario === 'omitir' || f.estado_fila === 'duplicado') return 'omitir';
    if (f.estado_fila === 'error') return 'error';
    if (f.estado_fila === 'advertencia') return 'revisar';
    return 'ok';
  }

  campoMal(f: FilaExtendida, campo: string): boolean {
    const msgs = f.mensajes ?? [];
    if (campo === 'metros_cuadrados') return msgs.some((m) => /metros/i.test(m));
    if (campo === 'precio') return msgs.some((m) => /precio/i.test(m));
    if (campo === 'numero_lote') return msgs.some((m) => /numero_lote|número de lote/i.test(m));
    if (campo === 'estado') return msgs.some((m) => /estado/i.test(m));
    if (campo === 'moneda') return msgs.some((m) => /moneda/i.test(m));
    if (campo === 'orientacion') return msgs.some((m) => /orientaci/i.test(m));
    return false;
  }

  origTip(f: FilaExtendida, campo: string): string | undefined {
    const orig = f.datos_originales as Record<string, unknown> | undefined;
    if (!orig) return undefined;
    const v = orig[campo];
    if (v == null || v === '') return undefined;
    return `en el archivo decía: ${String(v)}`;
  }

  cellTip(f: FilaExtendida, campo: string): string | undefined {
    const parts: string[] = [];
    const orig = this.origTip(f, campo);
    if (orig) parts.push(orig);
    const s = this.sugDe(f, campo);
    if (s) {
      parts.push(`sugerido: ${s.valor_sugerido}${s.motivo ? ` (${s.motivo})` : ''}`);
    }
    return parts.length ? parts.join(' · ') : undefined;
  }

  problemaTip(f: FilaExtendida): string {
    const hoja = f.nombre_hoja || f.ref_barrio || '';
    const fila = (f.datos_originales as Record<string, unknown> | undefined)?.['_fila_excel'];
    const where = fila != null ? `hoja «${hoja}», fila ${fila}` : `hoja «${hoja}»`;
    const msg = f.mensajes?.[0];
    return msg ? `${msg} (${where})` : where;
  }

  plantillaId(c: CabezalBarrio): string | null {
    return c.plantilla_fila_id ?? null;
  }

  plantillaLote(h: HojaGrupo): FilaLote | null {
    const id = this.cabezal(h.cabezal).plantilla_fila_id;
    if (!id) return null;
    const f = h.lotes.find((l) => l.id === id);
    return f ? this.lote(f) : null;
  }

  patron(codigo: string): string {
    return inferirPatronCodigo(codigo);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  toggleSelect(id: string, on: boolean, index: number, lotes: FilaExtendida[]): void {
    const cur = new Set(this.selectedIds());
    if (on && this.lastSelectIndex != null && index !== this.lastSelectIndex) {
      const from = Math.min(this.lastSelectIndex, index);
      const to = Math.max(this.lastSelectIndex, index);
      for (let i = from; i <= to; i++) cur.add(lotes[i].id);
    } else if (on) {
      cur.add(id);
    } else {
      cur.delete(id);
    }
    this.lastSelectIndex = index;
    this.selectedIds.set([...cur]);
  }

  omitirSel(): void {
    this.mass.emit({ kind: 'omitir', ids: this.selectedIds() });
  }

  openCabezal(ev: Event, h: HojaGrupo): void {
    ev.stopPropagation();
    this.cabezalEdit.set(h);
    this.cabPop?.toggle(ev);
  }

  async incluir(id: string): Promise<void> {
    try {
      await this.importadorService.incluirFilas([id]);
      this.filasChanged.emit();
    } catch (err: unknown) {
      this.fail(err);
    }
  }

  async patch(id: string, cambios: Record<string, unknown>): Promise<void> {
    this.saving.set(true);
    try {
      await this.importadorService.editarFilas([id], cambios);
      this.filasChanged.emit();
    } catch (err: unknown) {
      this.fail(err);
    } finally {
      this.saving.set(false);
    }
  }

  selectAll(event: Event): void {
    const t = event.target;
    if (!(t instanceof HTMLInputElement)) return;
    // p-inputNumber reformats on focus; select after that paint
    requestAnimationFrame(() => t.select());
  }

  async togglePlantilla(cabezalId: string, loteId: string, c: CabezalBarrio): Promise<void> {
    const next = this.plantillaId(c) === loteId ? null : loteId;
    try {
      await this.importadorService.marcarPlantilla(cabezalId, next);
      this.filasChanged.emit();
    } catch (err: unknown) {
      this.fail(err);
    }
  }

  private fail(err: unknown): void {
    const msg = err instanceof Error ? err.message : 'Error al guardar';
    this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
  }
}

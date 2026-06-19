import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DefinicionesCacheService } from '@loteomanager/shared-pb-client';
import type { EntidadExtra, ExtraValor, ExtrasDefinicion } from '@loteomanager/shared-types';
import { ExtraValueEditorComponent } from '@loteomanager/shared-ui';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

type ExtraRow = { def: ExtrasDefinicion; valor: ExtraValor };

@Component({
  selector: 'app-extras-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    ExtraValueEditorComponent
  ],
  templateUrl: './extras-editor.component.html',
  styleUrl: './extras-editor.component.scss'
})
export class ExtrasEditorComponent {
  private cache = inject(DefinicionesCacheService);

  entidad = input.required<EntidadExtra>();
  extras = input<Record<string, unknown>>({});
  disabled = input(false);

  extrasChange = output<Record<string, unknown>>();

  readonly filtro = signal('');
  readonly showSuggestions = signal(false);
  readonly selectedDef = signal<ExtrasDefinicion | null>(null);
  readonly draftValor = signal<ExtraValor>(null);
  readonly editingCode = signal<string | null>(null);

  private definiciones = computed(() => this.cache.extrasActivosPara(this.entidad()));

  readonly rows = signal<ExtraRow[]>([]);

  readonly sugerencias = computed(() => {
    const used = new Set(
      this.rows()
        .map((r) => r.def.code)
        .filter((code) => code !== this.editingCode())
    );
    const q = this.filtro().toLowerCase().trim();
    return this.definiciones().filter((d) => {
      if (used.has(d.code)) return false;
      if (!q) return true;
      return d.nombre.toLowerCase().includes(q) || d.code.toLowerCase().includes(q);
    });
  });

  readonly isEditing = computed(() => this.editingCode() != null);

  readonly valorPlaceholder = computed(() => {
    const def = this.selectedDef();
    if (!def) return 'Seleccioná un campo para ingresar el valor';
    const placeholders: Record<ExtrasDefinicion['tipo'], string> = {
      texto: 'Ingresá texto…',
      numero: 'Ingresá un número…',
      booleano: 'Activado / desactivado',
      opciones: 'Seleccioná una opción…',
      fecha: 'Seleccioná una fecha…'
    };
    return placeholders[def.tipo] ?? 'Ingresá el valor…';
  });

  constructor() {
    effect(() => {
      const defs = this.definiciones();
      const raw = this.extras();
      this.rows.set(this.buildRows(raw, defs));
    });
  }

  onFiltroChange(value: string): void {
    this.filtro.set(value);
    this.showSuggestions.set(true);
  }

  onSearchFocus(): void {
    if (!this.disabled()) this.showSuggestions.set(true);
  }

  onSearchBlur(): void {
    setTimeout(() => this.showSuggestions.set(false), 150);
  }

  seleccionarDef(def: ExtrasDefinicion): void {
    this.selectedDef.set(def);
    this.filtro.set(def.nombre);
    this.showSuggestions.set(false);
    if (this.editingCode() !== def.code) {
      this.editingCode.set(null);
      this.draftValor.set(def.tipo === 'booleano' ? false : null);
    }
  }

  onDraftValorChange(valor: ExtraValor): void {
    this.draftValor.set(valor);
  }

  agregarOActualizar(): void {
    const def = this.selectedDef();
    if (!def || this.disabled()) return;

    const row: ExtraRow = { def, valor: this.draftValor() };
    const editing = this.editingCode();

    if (editing) {
      this.rows.update((rows) => rows.map((r) => (r.def.code === editing ? row : r)));
    } else if (!this.rows().some((r) => r.def.code === def.code)) {
      this.rows.update((rows) => [...rows, row]);
    }

    this.emitChange();
    this.limpiarEntrada();
  }

  editarFila(row: ExtraRow): void {
    if (this.disabled()) return;
    this.selectedDef.set(row.def);
    this.draftValor.set(row.valor);
    this.editingCode.set(row.def.code);
    this.filtro.set(row.def.nombre);
  }

  eliminarFila(row: ExtraRow): void {
    if (this.disabled()) return;
    this.rows.update((rows) => rows.filter((r) => r.def.code !== row.def.code));
    if (this.editingCode() === row.def.code) {
      this.limpiarEntrada();
    }
    this.emitChange();
  }

  limpiarEntrada(): void {
    this.selectedDef.set(null);
    this.draftValor.set(null);
    this.editingCode.set(null);
    this.filtro.set('');
    this.showSuggestions.set(false);
  }

  formatValor(row: ExtraRow): string {
    const v = row.valor;
    if (v === null || v === undefined || v === '') return '—';
    if (row.def.tipo === 'booleano') return v === true ? 'Sí' : 'No';
    if (row.def.tipo === 'fecha' && typeof v === 'string') {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-UY');
    }
    return String(v);
  }

  private buildRows(raw: Record<string, unknown>, defs: ExtrasDefinicion[]): ExtraRow[] {
    const byCode = new Map(defs.map((d) => [d.code, d]));
    const rows: ExtraRow[] = [];
    for (const [code, valor] of Object.entries(raw)) {
      const def = byCode.get(code);
      if (!def) continue;
      rows.push({ def, valor: valor as ExtraValor });
    }
    return rows.sort((a, b) => (a.def.orden_display ?? 0) - (b.def.orden_display ?? 0));
  }

  private emitChange(): void {
    const next: Record<string, unknown> = {};
    for (const row of this.rows()) {
      next[row.def.code] = row.valor;
    }
    this.extrasChange.emit(next);
  }
}

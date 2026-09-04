import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EstadoBadgeComponent } from '@loteomanager/shared-ui';
import { TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
import type { TipoUnidadIngreso } from '@loteomanager/shared-types';
import type { ColumnDef } from './column-def';
import { formatDateShort, formatMoney, formatNumber } from './listado-filter.util';
import { UnidadesStackBarComponent, type UnidadesStackCounts } from './unidades-stack-bar.component';

@Component({
  selector: 'app-listado-cell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, EstadoBadgeComponent, UnidadesStackBarComponent],
  template: `
    @switch (column().tipo) {
      @case ('bool') {
        @if (truthy()) {
          <span class="listado-cell-bool-yes">Sí</span>
        } @else {
          <span class="listado-cell-muted">—</span>
        }
      }
      @case ('date') {
        @if (dateText()) {
          <span>{{ dateText() }}</span>
        } @else {
          <span class="listado-cell-muted">—</span>
        }
      }
      @case ('number') {
        @if (numberText(); as n) {
          <span
            class="listado-cell-num"
            [class.listado-cell-muted]="isZero()"
            [class.listado-cell-amber]="column().id === 'sin_publicar' && !isZero()"
            >{{ n }}</span
          >
        } @else {
          <span class="listado-cell-muted">—</span>
        }
      }
      @case ('state') {
        <lib-estado-badge [code]="stringValue()" [entidad]="'interesados'" />
      }
      @case ('tags') {
        <span class="listado-cell-tags">
          @for (t of tags(); track t) {
            <span class="listado-cell-tag">{{ t }}</span>
          } @empty {
            <span class="listado-cell-muted">—</span>
          }
        </span>
      }
      @case ('compuesta') {
        <app-unidades-stack-bar [counts]="stackCounts()" />
      }
      @default {
        @if (textValue()) {
          <span class="listado-cell-text" [attr.title]="fullTitle() || null">{{ textValue() }}</span>
        } @else {
          <span class="listado-cell-muted">—</span>
        }
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        overflow: hidden;
      }
      .listado-cell-text {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .listado-cell-muted {
        color: var(--p-text-muted-color, #94a3b8);
      }
      .listado-cell-bool-yes {
        color: var(--p-green-600, #16a34a);
        font-weight: 500;
      }
      .listado-cell-num {
        font-variant-numeric: tabular-nums;
        font-family: ui-monospace, monospace;
      }
      .listado-cell-amber {
        color: var(--p-amber-600, #d97706);
        font-weight: 600;
      }
      .listado-cell-tags {
        display: flex;
        flex-wrap: nowrap;
        gap: 0.25rem;
        overflow: hidden;
      }
      .listado-cell-tag {
        flex-shrink: 0;
        font-size: 0.7rem;
        padding: 0.1rem 0.35rem;
        border: 1px solid var(--p-content-border-color);
        border-radius: 4px;
        color: var(--p-text-muted-color);
      }
    `
  ]
})
export class ListadoCellComponent {
  column = input.required<ColumnDef>();
  row = input.required<unknown>();
  /** Optional money currency resolver */
  moneda = input<string | null>(null);
  stack = input<UnidadesStackCounts | null>(null);

  value = computed(() => this.column().getValue(this.row()));

  truthy = computed(() => !!this.value());
  isZero = computed(() => Number(this.value()) === 0);
  stringValue = computed(() => String(this.value() ?? ''));

  dateText = computed(() => formatDateShort(this.value()));

  numberText = computed(() => {
    const v = this.value();
    if (v == null || v === '') return '';
    if (this.column().formato === 'money') return formatMoney(v, this.moneda());
    return formatNumber(v);
  });

  tags = computed(() => {
    const v = this.value();
    if (!Array.isArray(v)) return [] as string[];
    return v.map((t) => TIPO_UNIDAD_LABELS[t as TipoUnidadIngreso] ?? String(t));
  });

  textValue = computed(() => {
    if (this.column().tipo === 'select' && this.column().opciones) {
      const hit = this.column().opciones!.find((o) => o.value === String(this.value() ?? ''));
      if (hit) return hit.label;
    }
    const search = this.column().getSearchText?.(this.row());
    if (search) return search;
    const v = this.value();
    if (v == null || v === '') return '';
    return String(v);
  });

  fullTitle = computed(() => {
    if (this.column().id === 'descripcion' || this.column().id === 'mensaje') {
      return this.textValue();
    }
    return '';
  });

  stackCounts = computed((): UnidadesStackCounts => {
    return (
      this.stack() ?? {
        disponible: 0,
        reservado: 0,
        vendido: 0,
        total: Number(this.value()) || 0
      }
    );
  });
}

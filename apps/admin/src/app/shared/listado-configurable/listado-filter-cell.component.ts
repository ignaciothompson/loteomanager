import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  input,
  output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { Popover, PopoverModule } from 'primeng/popover';
import { InputNumberModule } from 'primeng/inputnumber';
import type {
  BoolFilter,
  ColumnDef,
  ColumnFilterValue,
  DateRangeFilter,
  NumberRangeFilter,
  SelectFilter
} from './column-def';
import { filterButtonLabel, isFilterActive } from './listado-filter.util';

@Component({
  selector: 'app-listado-filter-cell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    CheckboxModule,
    PopoverModule,
    InputNumberModule
  ],
  template: `
    @if (column().tipo === 'compuesta' || !column().filtrable) {
      <span class="listado-filter-empty"></span>
    } @else {
      <button
        pButton
        type="button"
        class="p-button-text p-button-sm listado-filter-btn"
        [class.listado-filter--active]="active()"
        [label]="buttonLabel()"
        icon="pi pi-filter"
        (click)="op.toggle($event)"
      ></button>
      <p-popover #op [appendTo]="'body'">
        @if (column().tipo === 'text') {
          <div class="listado-filter-pop">
            <input
              pInputText
              class="w-full"
              placeholder="contiene…"
              [ngModel]="textModel"
              (ngModelChange)="onText($event)"
            />
          </div>
        } @else if (column().tipo === 'bool') {
          <div class="listado-filter-pop">
            @for (opt of boolOpts; track opt.value) {
              <button
                type="button"
                class="listado-filter-opt"
                [class.listado-filter-opt--on]="boolValue === opt.value"
                (click)="emitBool(opt.value); op.hide()"
              >
                {{ opt.label }}
              </button>
            }
          </div>
        } @else if (column().tipo === 'select' || column().tipo === 'state' || column().tipo === 'tags') {
          <div class="listado-filter-pop">
            @for (opt of column().opciones ?? []; track opt.value) {
              <label class="listado-filter-check">
                <p-checkbox
                  [binary]="true"
                  [ngModel]="isSelected(opt.value)"
                  (ngModelChange)="toggleOpt(opt.value, $event)"
                />
                <span>{{ opt.label }}</span>
              </label>
            }
            @if (!(column().opciones ?? []).length) {
              <span class="text-sm text-muted-color">Sin opciones</span>
            }
          </div>
        } @else if (column().tipo === 'number') {
          <div class="listado-filter-pop listado-filter-pop--range">
            <label>
              <span>Mínimo</span>
              <p-inputNumber
                [ngModel]="numMin"
                (ngModelChange)="numMin = $event; emitNumber()"
                [useGrouping]="false"
              />
            </label>
            <label>
              <span>Máximo</span>
              <p-inputNumber
                [ngModel]="numMax"
                (ngModelChange)="numMax = $event; emitNumber()"
                [useGrouping]="false"
              />
            </label>
          </div>
        } @else if (column().tipo === 'date') {
          <div class="listado-filter-pop listado-filter-pop--range">
            <label>
              <span>Desde</span>
              <input type="date" [ngModel]="dateFrom" (ngModelChange)="dateFrom = $event; emitDate()" />
            </label>
            <label>
              <span>Hasta</span>
              <input type="date" [ngModel]="dateTo" (ngModelChange)="dateTo = $event; emitDate()" />
            </label>
          </div>
        }
      </p-popover>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .listado-filter-btn {
        width: 100%;
        justify-content: flex-start;
        font-size: 0.75rem;
        padding: 0.25rem 0.45rem;
        border: 1px solid var(--p-content-border-color, #334155) !important;
        border-radius: 6px;
        background: var(--p-content-background, transparent) !important;
        color: var(--p-text-muted-color) !important;
      }
      .listado-filter-btn.listado-filter--active {
        color: var(--p-primary-color) !important;
        border-color: var(--p-primary-color) !important;
      }
      .listado-filter-pop {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        min-width: 12rem;
        max-height: 16rem;
        overflow: auto;
        padding: 0.25rem;
      }
      .listado-filter-pop--range label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.75rem;
      }
      .listado-filter-check {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8rem;
        cursor: pointer;
      }
      .listado-filter-opt {
        display: block;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        color: inherit;
        padding: 0.4rem 0.5rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
      }
      .listado-filter-opt:hover,
      .listado-filter-opt--on {
        background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
        color: var(--p-primary-color);
      }
      .listado-filter-empty {
        display: block;
        height: 1.75rem;
      }
    `
  ]
})
export class ListadoFilterCellComponent {
  @ViewChild('op') op?: Popover;

  column = input.required<ColumnDef>();
  value = input<ColumnFilterValue | null>(null);
  valueChange = output<ColumnFilterValue>();

  boolOpts: { label: string; value: BoolFilter }[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Sí', value: 'yes' },
    { label: 'No', value: 'no' }
  ];

  private textTimer: ReturnType<typeof setTimeout> | undefined;
  private localText: string | null = null;
  numMin: number | null = null;
  numMax: number | null = null;
  dateFrom: string | null = null;
  dateTo: string | null = null;

  get textModel(): string {
    if (this.localText != null) return this.localText;
    const v = this.value();
    return typeof v === 'string' ? v : '';
  }

  active(): boolean {
    return isFilterActive(this.value() ?? undefined);
  }

  get boolValue(): BoolFilter {
    const v = this.value();
    return v === 'yes' || v === 'no' ? v : 'all';
  }

  buttonLabel(): string {
    if (this.column().tipo === 'text') {
      const t = this.textModel.trim();
      return t ? t : 'Todos';
    }
    return filterButtonLabel(this.column().tipo, this.value() ?? undefined, this.column().opciones);
  }

  onText(v: string): void {
    this.localText = v;
    clearTimeout(this.textTimer);
    this.textTimer = setTimeout(() => {
      this.valueChange.emit(v);
      this.localText = null;
    }, 200);
  }

  emitBool(v: BoolFilter): void {
    this.valueChange.emit(v === 'all' ? null : v);
  }

  isSelected(opt: string): boolean {
    const v = this.value();
    return Array.isArray(v) && v.includes(opt);
  }

  toggleOpt(opt: string, on: boolean): void {
    const cur = Array.isArray(this.value()) ? [...(this.value() as SelectFilter)] : [];
    if (on && !cur.includes(opt)) cur.push(opt);
    if (!on) {
      const i = cur.indexOf(opt);
      if (i >= 0) cur.splice(i, 1);
    }
    this.valueChange.emit(cur.length ? cur : null);
  }

  emitNumber(): void {
    const next: NumberRangeFilter = { min: this.numMin, max: this.numMax };
    this.valueChange.emit(next.min == null && next.max == null ? null : next);
  }

  emitDate(): void {
    const next: DateRangeFilter = { from: this.dateFrom, to: this.dateTo };
    this.valueChange.emit(!next.from && !next.to ? null : next);
  }
}

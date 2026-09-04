import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray
} from '@angular/cdk/drag-drop';
import type { ColumnDef } from './column-def';
import { normalizeText } from './listado-filter.util';

@Component({
  selector: 'app-columnas-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    DrawerModule,
    ButtonModule,
    InputTextModule,
    CheckboxModule,
    DragDropModule
  ],
  template: `
    <p-drawer
      [visible]="visible()"
      (visibleChange)="visibleChange.emit($event)"
      header="Columnas"
      position="right"
      [style]="drawerStyle"
      styleClass="columnas-drawer"
    >
      <div class="columnas-drawer__body">
        <input
          pInputText
          class="w-full mb-3"
          placeholder="Buscar campo…"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
        />

        @if (orderedVisible().length) {
          <div class="columnas-drawer__group">
            <div class="columnas-drawer__group-title">
              <span>Orden visibles</span>
              <span class="columnas-drawer__hint">arrastrá para reordenar</span>
            </div>
            <div
              class="columnas-drawer__drag-list"
              cdkDropList
              (cdkDropListDropped)="onDrop($event)"
            >
              @for (col of orderedVisible(); track col.id; let i = $index) {
                <div class="columnas-drawer__drag-row" cdkDrag>
                  <i class="pi pi-bars columnas-drawer__grip" cdkDragHandle></i>
                  <span class="columnas-drawer__label">
                    {{ col.label }}
                    @if (i < 2) {
                      <span class="columnas-drawer__badge">fija</span>
                    }
                    @if (col.flex) {
                      <span class="columnas-drawer__badge">flex</span>
                    }
                  </span>
                  <span class="columnas-drawer__tipo">{{ col.tipo }}</span>
                </div>
              }
            </div>
          </div>
        }

        @for (group of grouped(); track group.name) {
          <div class="columnas-drawer__group">
            <div class="columnas-drawer__group-title">
              <span>{{ group.name }}</span>
              @if (group.hint) {
                <span class="columnas-drawer__hint">{{ group.hint }}</span>
              }
            </div>
            @for (col of group.cols; track col.id) {
              <div class="columnas-drawer__row" [class.columnas-drawer__row--on]="isVisible(col.id)">
                <p-checkbox
                  [binary]="true"
                  [ngModel]="isVisible(col.id)"
                  (ngModelChange)="toggle(col.id, $event)"
                  [inputId]="'col-' + col.id"
                />
                <label [for]="'col-' + col.id" class="columnas-drawer__label">
                  {{ col.label }}
                </label>
                <span class="columnas-drawer__tipo">{{ col.tipo }}</span>
              </div>
            }
          </div>
        }
      </div>

      <ng-template pTemplate="footer">
        <div class="columnas-drawer__footer">
          <span class="text-sm text-muted-color">
            {{ visibleIds().length }} de {{ catalog().length }} columnas visibles
          </span>
          <button
            pButton
            type="button"
            label="Restaurar por defecto"
            class="p-button-text"
            (click)="restore.emit()"
          ></button>
        </div>
      </ng-template>
    </p-drawer>
  `,
  styles: [
    `
      .columnas-drawer__body {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding-bottom: 1rem;
      }
      .columnas-drawer__group {
        margin-bottom: 0.75rem;
      }
      .columnas-drawer__group-title {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        font-weight: 600;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        color: var(--p-text-muted-color);
        margin: 0.5rem 0 0.35rem;
      }
      .columnas-drawer__hint {
        font-weight: 400;
        text-transform: none;
        letter-spacing: 0;
        font-size: 0.75rem;
      }
      .columnas-drawer__row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 0.5rem;
        align-items: center;
        padding: 0.35rem 0.25rem;
        border-radius: 6px;
      }
      .columnas-drawer__row--on {
        background: color-mix(in srgb, var(--p-primary-color) 6%, transparent);
      }
      .columnas-drawer__label {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.875rem;
        cursor: pointer;
        min-width: 0;
      }
      .columnas-drawer__badge {
        font-size: 0.65rem;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--p-primary-color);
        border: 1px solid color-mix(in srgb, var(--p-primary-color) 40%, transparent);
        border-radius: 4px;
        padding: 0 0.3rem;
      }
      .columnas-drawer__tipo {
        font-family: ui-monospace, monospace;
        font-size: 0.65rem;
        color: var(--p-text-muted-color);
      }
      .columnas-drawer__drag-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 0.5rem;
      }
      .columnas-drawer__drag-row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 0.5rem;
        align-items: center;
        padding: 0.45rem 0.4rem;
        border-radius: 6px;
        border: 1px solid var(--p-content-border-color, #334155);
        background: color-mix(in srgb, var(--p-primary-color) 6%, transparent);
        cursor: grab;
      }
      .columnas-drawer__drag-row.cdk-drag-preview {
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        opacity: 0.95;
      }
      .columnas-drawer__drag-row.cdk-drag-placeholder {
        opacity: 0.35;
      }
      .columnas-drawer__grip {
        color: var(--p-text-muted-color);
        cursor: grab;
      }
      .columnas-drawer__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        width: 100%;
      }
    `
  ]
})
export class ColumnasDrawerComponent {
  visible = input(false);
  catalog = input.required<ColumnDef[]>();
  visibleIds = input.required<string[]>();

  visibleChange = output<boolean>();
  visibleIdsChange = output<string[]>();
  restore = output<void>();

  query = signal('');

  drawerStyle = { width: 'min(24.375rem, 100vw)' };

  orderedVisible = computed(() => {
    const byId = new Map(this.catalog().map((c) => [c.id, c]));
    return this.visibleIds()
      .map((id) => byId.get(id))
      .filter((c): c is ColumnDef => !!c);
  });

  grouped = computed(() => {
    const q = normalizeText(this.query()).trim();
    const cols = this.catalog().filter((c) => !q || normalizeText(c.label).includes(q));
    const map = new Map<string, { name: string; hint?: string; cols: ColumnDef[] }>();
    for (const c of cols) {
      if (!map.has(c.grupo)) map.set(c.grupo, { name: c.grupo, hint: c.grupoHint, cols: [] });
      map.get(c.grupo)!.cols.push(c);
    }
    return [...map.values()];
  });

  isVisible(id: string): boolean {
    return this.visibleIds().includes(id);
  }

  toggle(id: string, on: boolean): void {
    const cur = [...this.visibleIds()];
    if (on && !cur.includes(id)) cur.push(id);
    if (!on) {
      const i = cur.indexOf(id);
      if (i >= 0) cur.splice(i, 1);
    }
    if (!cur.length) return;
    this.visibleIdsChange.emit(cur);
  }

  onDrop(event: CdkDragDrop<ColumnDef[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const ids = [...this.visibleIds()];
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    this.visibleIdsChange.emit(ids);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DefinicionesCacheService } from '@loteomanager/shared-pb-client';
import type { EntidadExtra, ExtraPersistido, ExtraValor, ExtrasDefinicion } from '@loteomanager/shared-types';
import { ExtraValueEditorComponent } from '../extra-value-editor/extra-value-editor.component';

@Component({
  selector: 'lib-extras-editor',
  standalone: true,
  imports: [CommonModule, ExtraValueEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      @for (grupo of gruposOrdenados(); track grupo.key) {
        <div class="flex flex-col gap-2">
          @if (grupo.key !== '__sin_grupo__') {
            <span class="font-semibold text-sm text-surface-600">{{ grupo.label }}</span>
          }
          @for (def of grupo.items; track def.id) {
            <div class="flex flex-col gap-1 p-2 rounded border border-surface-200 dark:border-surface-700">
              <label class="text-sm font-medium">
                {{ def.nombre }}
                @if (def.requerido) {
                  <span class="text-red-500">*</span>
                }
              </label>
              @if (def.descripcion) {
                <small class="text-surface-500">{{ def.descripcion }}</small>
              }
              <lib-extra-value-editor
                [definicion]="def"
                [valor]="valorPara(def)"
                (valorChange)="onValor(def, $event)"
              />
            </div>
          }
        </div>
      }
    </div>
  `
})
export class ExtrasEditorComponent {
  private cache = inject(DefinicionesCacheService);

  entidad = input.required<EntidadExtra>();
  extras = model<ExtraPersistido[]>([]);
  /** Optional case-insensitive filter on definicion nombre */
  filterQuery = input('');

  private definiciones = computed(() => {
    const all = this.cache.extrasActivosPara(this.entidad());
    const q = this.filterQuery().toLowerCase().trim();
    if (!q) return all;
    return all.filter((d) => d.nombre.toLowerCase().includes(q));
  });

  gruposOrdenados = computed(() => {
    const defs = this.definiciones();
    const map = new Map<string, { key: string; label: string; items: ExtrasDefinicion[] }>();
    for (const d of defs) {
      const key = (d.grupo && String(d.grupo).trim()) || '__sin_grupo__';
      const label = key === '__sin_grupo__' ? '' : String(d.grupo);
      if (!map.has(key)) {
        map.set(key, { key, label, items: [] });
      }
      map.get(key)!.items.push(d);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  });

  valorPara(def: ExtrasDefinicion): ExtraValor {
    const row = this.extras().find((x) => x.extra_id === def.id);
    return row ? row.valor : null;
  }

  onValor(def: ExtrasDefinicion, valor: ExtraValor) {
    const next = [...this.extras()];
    const idx = next.findIndex((x) => x.extra_id === def.id);
    const row: ExtraPersistido = {
      extra_id: def.id,
      code: def.code,
      nombre: def.nombre,
      valor
    };
    if (idx >= 0) {
      next[idx] = row;
    } else {
      next.push(row);
    }
    this.extras.set(next);
  }
}

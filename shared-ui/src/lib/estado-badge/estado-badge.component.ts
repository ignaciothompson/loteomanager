import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DefinicionesCacheService } from '@loteomanager/shared-pb-client';
import type { EntidadEstado } from '@loteomanager/shared-types';

@Component({
  selector: 'lib-estado-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 px-2 py-1 border-round text-xs font-medium"
      [style.background]="meta().bg"
      [style.color]="meta().fg"
    >
      @if (meta().icon) {
        <i [class]="'pi ' + meta().icon"></i>
      }
      {{ meta().label }}
    </span>
  `
})
export class EstadoBadgeComponent {
  private cache = inject(DefinicionesCacheService);

  code = input.required<string>();
  entidad = input.required<EntidadEstado>();

  meta = computed(() => {
    const def = this.cache.estadoPorCode(this.entidad(), this.code());
    const color = def?.color || '#64748b';
    const label = def?.nombre || this.code();
    const icon = def?.icono || '';
    return {
      label,
      icon,
      bg: color + '22',
      fg: color
    };
  });
}

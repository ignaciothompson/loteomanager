import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DefinicionesCacheService } from '@loteomanager/shared-pb-client';
import type { EntidadEstado } from '@loteomanager/shared-types';

@Component({
  selector: 'lib-estado-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .estado-badge--clickable {
        cursor: pointer;
        transition: opacity 0.15s ease;
      }
      .estado-badge--clickable:hover {
        opacity: 0.85;
      }
    `
  ],
  template: `
    <span
      class="inline-flex items-center gap-1 px-2 py-1 border-round text-xs font-medium"
      [class.estado-badge--clickable]="clickable()"
      [style.background]="meta().bg"
      [style.color]="meta().fg"
      [attr.role]="clickable() ? 'button' : null"
      [attr.tabindex]="clickable() ? 0 : null"
      (click)="onBadgeClick($event)"
      (keydown.enter)="onBadgeKeydown($event)"
      (keydown.space)="onBadgeKeydown($event)"
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
  /** When true, the badge emits `badgeClick` with optional `clickValue`. */
  clickable = input(false, { transform: booleanAttribute });
  /** Optional payload for `badgeClick`; omit for click-only handlers. */
  clickValue = input<unknown>();

  badgeClick = output<unknown>();

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

  onBadgeClick(event: Event): void {
    if (!this.clickable()) return;
    event.stopPropagation();
    this.badgeClick.emit(this.clickValue());
  }

  onBadgeKeydown(event: Event): void {
    if (!this.clickable()) return;
    event.preventDefault();
    event.stopPropagation();
    this.badgeClick.emit(this.clickValue());
  }
}

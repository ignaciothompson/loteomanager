import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DefinicionesCacheService } from '@loteomanager/shared-pb-client';

export type UnidadesStackCounts = {
  disponible: number;
  reservado: number;
  vendido: number;
  otro?: number;
  total: number;
};

@Component({
  selector: 'app-unidades-stack-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="stack-bar" [attr.title]="title()">
      <div class="stack-bar__track">
        @for (seg of segments(); track seg.key) {
          @if (seg.pct > 0) {
            <span class="stack-bar__seg" [style.width.%]="seg.pct" [style.background]="seg.color"></span>
          }
        }
      </div>
      <span class="stack-bar__total">{{ counts().total }}</span>
    </div>
  `,
  styles: [
    `
      .stack-bar {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        max-width: 100%;
      }
      .stack-bar__track {
        display: flex;
        width: 74px;
        height: 6px;
        border-radius: 3px;
        overflow: hidden;
        background: var(--p-content-border-color, #e2e8f0);
        flex-shrink: 0;
      }
      .stack-bar__seg {
        display: block;
        height: 100%;
      }
      .stack-bar__total {
        font-variant-numeric: tabular-nums;
        font-family: ui-monospace, monospace;
        font-size: 0.8rem;
      }
    `
  ]
})
export class UnidadesStackBarComponent {
  private cache = inject(DefinicionesCacheService);

  counts = input.required<UnidadesStackCounts>();

  segments = computed(() => {
    const c = this.counts();
    const total = Math.max(c.total, 1);
    const color = (code: string, fallback: string) =>
      this.cache.estadoPorCode('unidades', code)?.color || fallback;
    return [
      { key: 'disponible', pct: (c.disponible / total) * 100, color: color('disponible', '#16a34a') },
      {
        key: 'reservado',
        pct: (c.reservado / total) * 100,
        color: color('reservado', '#d97706')
      },
      { key: 'vendido', pct: (c.vendido / total) * 100, color: color('vendido', '#2563eb') },
      {
        key: 'otro',
        pct: ((c.otro ?? Math.max(0, c.total - c.disponible - c.reservado - c.vendido)) / total) * 100,
        color: '#94a3b8'
      }
    ];
  });

  title = computed(() => {
    const c = this.counts();
    return `Disp. ${c.disponible} · Res. ${c.reservado} · Vend. ${c.vendido} · Total ${c.total}`;
  });
}

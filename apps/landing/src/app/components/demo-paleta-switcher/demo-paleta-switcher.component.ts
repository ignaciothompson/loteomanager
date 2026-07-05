import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { applyLandingPrimaryPalette, DEMO_PALETAS, type PrimaryScale } from '../../theme/landing-theme';

@Component({
  selector: 'demo-paleta-switcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-6 left-6 z-50 bg-surface-0 dark:bg-surface-800
                border border-surface-200 dark:border-surface-700
                rounded-2xl shadow-soft-lg p-3 flex gap-2 items-center">
      <span class="text-xs font-medium text-surface-500 pr-1">Paleta (demo):</span>
      @for (p of paletas; track p.nombre) {
        <button type="button"
                [title]="p.nombre"
                (click)="elegir(p.scale, p.nombre)"
                class="w-7 h-7 rounded-full shrink-0 transition-transform hover:scale-110 border-2 border-surface-0"
                [class.ring-2]="seleccionada() === p.nombre"
                [class.ring-offset-2]="seleccionada() === p.nombre"
                [class.ring-primary]="seleccionada() === p.nombre"
                [style.background-color]="p.scale[500]">
        </button>
      }
    </div>
  `,
})
export class DemoPaletaSwitcherComponent {
  paletas = DEMO_PALETAS;
  seleccionada = signal('Terracota');

  elegir(scale: PrimaryScale, nombre: string) {
    this.seleccionada.set(nombre);
    applyLandingPrimaryPalette(scale);
  }
}

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { ConfigPublicaService } from '../../services/config-publica.service';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'landing-topbar',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  template: `
    <header class="sticky top-0 z-40 flex items-center justify-between
                   px-4 lg:px-8 py-3
                   bg-surface-0/90 backdrop-blur
                   border-b border-surface-200 dark:border-transparent
                   transition-colors">
      <!-- Logo + nombre -->
      <div class="flex items-center gap-3">
        @if (config().logoUrl) {
          <img [src]="config().logoUrl" [alt]="config().nombreInmobiliaria"
               class="h-8 w-auto object-contain" />
        } @else {
          <span class="flex items-center justify-center w-8 h-8 rounded-lg
                       bg-primary text-primary-contrast text-sm font-bold">
            {{ config().nombreInmobiliaria.charAt(0) }}
          </span>
        }
        <span class="font-semibold text-base hidden sm:inline">
          {{ config().nombreInmobiliaria }}
        </span>
      </div>

      <!-- Theme toggle -->
      <button (click)="theme.toggle()"
              class="theme-toggle flex items-center justify-center
                     w-9 h-9 rounded-full
                     bg-surface-100 hover:bg-surface-200
                     text-surface-700
                     transition-colors"
              [attr.aria-label]="theme.isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'">
        @if (theme.isDark()) {
          <i class="pi pi-sun text-base"></i>
        } @else {
          <i class="pi pi-moon text-base"></i>
        }
      </button>
    </header>
  `,
})
export class LandingTopbarComponent {
  readonly theme = inject(ThemeService);
  readonly config = inject(ConfigPublicaService).config;
}

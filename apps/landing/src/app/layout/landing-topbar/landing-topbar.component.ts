import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { ConfigPublicaService } from '../../services/config-publica.service';

@Component({
  selector: 'landing-topbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="fixed top-0 z-40 w-full bg-surface-warm/90 dark:bg-surface-900/90 backdrop-blur-md
                   border-b border-surface-200 dark:border-surface-700 shadow-soft">
      <div class="max-w-7xl mx-auto flex items-center justify-between px-5 py-3">
        <div class="flex items-center gap-8">
          <a routerLink="/" class="font-extrabold text-xl text-primary tracking-tight">
            {{ config().nombreInmobiliaria }}
          </a>
          <nav class="hidden md:flex items-center gap-6">
            <a routerLink="/"
               routerLinkActive="text-primary border-primary"
               [routerLinkActiveOptions]="{ exact: true }"
               class="text-sm font-medium text-surface-600 dark:text-surface-300 hover:text-primary
                      transition-colors pb-0.5 border-b-2 border-transparent">
              Explorar
            </a>
            <a routerLink="/mapa"
               routerLinkActive="text-primary border-primary"
               class="text-sm font-medium text-surface-600 dark:text-surface-300 hover:text-primary
                      transition-colors pb-0.5 border-b-2 border-transparent">
              Mapa
            </a>
          </nav>
        </div>
        <button (click)="theme.toggle()"
                class="theme-toggle flex items-center justify-center w-9 h-9 rounded-full
                       bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700
                       text-surface-700 dark:text-surface-200 transition-colors"
                [attr.aria-label]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'">
          @if (theme.isDark()) {
            <i class="pi pi-sun"></i>
          } @else {
            <i class="pi pi-moon"></i>
          }
        </button>
      </div>
    </header>
  `,
})
export class LandingTopbarComponent {
  readonly theme = inject(ThemeService);
  readonly config = inject(ConfigPublicaService).config;
}

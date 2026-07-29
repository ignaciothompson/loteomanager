import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
            <a routerLink="/contacto"
               routerLinkActive="text-primary border-primary"
               class="text-sm font-medium text-surface-600 dark:text-surface-300 hover:text-primary
                      transition-colors pb-0.5 border-b-2 border-transparent">
              Contacto
            </a>
          </nav>
        </div>
      </div>
    </header>
  `,
})
export class LandingTopbarComponent {
  readonly config = inject(ConfigPublicaService).config;
}

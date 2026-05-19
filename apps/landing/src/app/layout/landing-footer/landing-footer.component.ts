import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigPublicaService } from '../../services/config-publica.service';

@Component({
  selector: 'landing-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="mt-16 border-t border-surface-200 dark:border-surface-700">
      <div class="max-w-5xl mx-auto px-4 py-8 text-center text-sm text-surface-500">
        <span>© {{ year }} {{ config().nombreInmobiliaria }} — Todos los derechos reservados</span>
      </div>
    </footer>
  `,
})
export class LandingFooterComponent {
  readonly config = inject(ConfigPublicaService).config;
  readonly year = new Date().getFullYear();
}

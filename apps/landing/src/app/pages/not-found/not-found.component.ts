import { Component } from '@angular/core';
import { LandingTopbarComponent } from '../../layout/landing-topbar/landing-topbar.component';
import { LandingFooterComponent } from '../../layout/landing-footer/landing-footer.component';

@Component({
  selector: 'page-not-found',
  standalone: true,
  imports: [LandingTopbarComponent, LandingFooterComponent],
  template: `
    <landing-topbar />

    <main class="max-w-2xl mx-auto px-4 py-20 lg:py-32 text-center">
      <i class="pi pi-exclamation-circle text-6xl text-surface-400 mb-6 block"></i>
      <h1 class="text-3xl lg:text-4xl font-semibold mb-3">Página no encontrada</h1>
      <p class="text-surface-600 mb-8">
        El link que seguiste no existe o fue removido.
      </p>
    </main>

    <landing-footer />
  `,
})
export class NotFoundComponent {}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LandingTopbarComponent } from '../../layout/landing-topbar/landing-topbar.component';
import { LandingFooterComponent } from '../../layout/landing-footer/landing-footer.component';
import { ContactoFormComponent } from '../../components/contacto-form/contacto-form.component';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [CommonModule, LandingTopbarComponent, LandingFooterComponent, ContactoFormComponent],
  template: `
    <div class="min-h-screen bg-surface-warm dark:bg-surface-900 flex flex-col">
      <landing-topbar />

      <main class="flex-1 pt-24 pb-16 px-5">
        <div class="max-w-xl mx-auto">
          <h1 class="text-3xl lg:text-4xl font-extrabold text-surface-900 dark:text-surface-0 mb-3">
            Contacto
          </h1>
          <p class="text-surface-600 dark:text-surface-300 mb-8 leading-relaxed">
            Dejanos tu consulta y te respondemos a la brevedad.
          </p>
          <div
            class="bg-surface-0 dark:bg-surface-800 rounded-2xl border border-surface-200
                   dark:border-surface-700 p-6 lg:p-8 shadow-soft"
          >
            <contacto-form />
          </div>
        </div>
      </main>

      <landing-footer />
    </div>
  `,
})
export class ContactoPageComponent {}

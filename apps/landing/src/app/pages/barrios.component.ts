import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BarriosService, POCKETBASE, type BarrioConUnidades } from '@loteomanager/shared-pb-client';
import { LandingTopbarComponent } from '../layout/landing-topbar/landing-topbar.component';
import { LandingFooterComponent } from '../layout/landing-footer/landing-footer.component';

@Component({
  selector: 'app-barrios',
  standalone: true,
  imports: [CommonModule, RouterModule, LandingTopbarComponent, LandingFooterComponent],
  template: `
    <div class="min-h-screen bg-surface-50 dark:bg-surface-900">
      <landing-topbar />

      <main class="container mx-auto px-4 py-12">
        <h1 class="text-3xl lg:text-4xl font-bold text-center mb-2 text-surface-900 dark:text-surface-0">
          Barrios
        </h1>
        <p class="text-center text-muted-color mb-10 max-w-2xl mx-auto">
          Explorá nuestros barrios y encontrá la unidad ideal para vos.
        </p>

        @if (loading()) {
          <div class="flex justify-center py-16">
            <i class="pi pi-spin pi-spinner text-3xl text-surface-400"></i>
          </div>
        } @else if (barrios().length === 0) {
          <p class="text-center py-16 text-muted-color">
            No hay barrios publicados por el momento.
          </p>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            @for (barrio of barrios(); track barrio.id) {
              <a [routerLink]="['/barrios', barrio.slug]"
                 class="bg-surface-0 dark:bg-surface-800 rounded-xl shadow-md overflow-hidden
                        hover:shadow-xl transition-shadow border border-surface-200 dark:border-surface-700 block">
                <div class="h-48 bg-surface-200 dark:bg-surface-700 relative">
                  @if (portadaUrl(barrio)) {
                    <img [src]="portadaUrl(barrio)!" [alt]="barrio.nombre"
                         class="w-full h-full object-cover" loading="lazy" />
                  } @else {
                    <div class="w-full h-full flex items-center justify-center">
                      <i class="pi pi-image text-4xl text-surface-400"></i>
                    </div>
                  }
                </div>
                <div class="p-6">
                  <h2 class="text-xl font-bold text-surface-900 dark:text-surface-0 m-0 mb-2">
                    {{ barrio.nombre }}
                  </h2>
                  @if (barrio.ubicacion_texto) {
                    <p class="text-muted-color text-sm mb-3 flex items-center gap-1">
                      <i class="pi pi-map-marker"></i>
                      {{ barrio.ubicacion_texto }}
                    </p>
                  }
                  <p class="text-sm text-surface-600 dark:text-surface-300 m-0">
                    <i class="pi pi-th-large mr-1"></i>
                    {{ barrio.unidadesCount }} unidad(es) disponible(s)
                  </p>
                </div>
              </a>
            }
          </div>
        }
      </main>

      <landing-footer />
    </div>
  `,
})
export class BarriosComponent implements OnInit {
  private barriosSvc = inject(BarriosService);
  private pb = inject(POCKETBASE);

  readonly loading = signal(true);
  readonly barrios = signal<BarrioConUnidades[]>([]);

  ngOnInit(): void {
    void this.load();
  }

  portadaUrl(barrio: BarrioConUnidades): string | null {
    if (!barrio.imagen_portada) return null;
    return this.pb.files.getUrl(barrio, barrio.imagen_portada);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.barriosSvc.listFiltered({ soloPublicados: true }, null, {
        sort: 'nombre',
      });
      const withCounts = await this.barriosSvc.attachUnidadesDisponiblesWebCount(rows);
      this.barrios.set(withCounts);
    } finally {
      this.loading.set(false);
    }
  }
}

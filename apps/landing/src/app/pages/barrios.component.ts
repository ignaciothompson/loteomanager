import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BarriosService, POCKETBASE, type BarrioConCatalogo, attachCatalogStatsFromSnapshots, isBarrioWebReady } from '@loteomanager/shared-pb-client';
import { LandingTopbarComponent } from '../layout/landing-topbar/landing-topbar.component';
import { LandingFooterComponent } from '../layout/landing-footer/landing-footer.component';
import { formatAreaRange, formatPrecioDesde } from '../utils/catalog-format';
import { PLACEHOLDER_BARRIO_URL } from '../utils/placeholder-images';

@Component({
  selector: 'app-barrios',
  standalone: true,
  imports: [CommonModule, RouterModule, LandingTopbarComponent, LandingFooterComponent],
  template: `
    <div class="min-h-screen bg-surface-warm dark:bg-surface-900">
      <landing-topbar />

      <main class="pt-20">
        <!-- Hero -->
        <section class="px-5 py-12 text-center">
          <h1 class="text-4xl md:text-5xl font-extrabold text-surface-900 dark:text-surface-0 mb-4 tracking-tight">
            Encontrá el lote ideal
          </h1>
          <p class="text-surface-600 dark:text-surface-300 max-w-2xl mx-auto mb-8">
            Barrios seleccionados con unidades disponibles. Explorá ubicaciones, tamaños y precios desde.
          </p>
          <div class="bg-surface-100/80 dark:bg-surface-800/80 backdrop-blur-md p-4 rounded-3xl shadow-soft-lg
                      border border-surface-200 dark:border-surface-700 max-w-3xl mx-auto">
            <div class="flex flex-col sm:flex-row gap-3">
              <input type="search"
                     [value]="busqueda()"
                     (input)="busqueda.set($any($event.target).value)"
                     placeholder="Buscar barrio o ubicación..."
                     class="flex-1 bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-600
                            rounded-full px-5 py-3 text-sm focus:outline-none focus:border-primary transition-colors" />
              <a routerLink="/mapa"
                 class="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-600 text-white
                        px-6 py-3 rounded-full font-bold text-sm shadow-soft transition-all active:scale-95">
                <i class="pi pi-map"></i> Ver mapa
              </a>
            </div>
          </div>
        </section>

        <!-- Grid -->
        <section class="max-w-7xl mx-auto px-5 pb-16">
          <div class="flex justify-between items-end mb-8">
            <div>
              <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Barrios disponibles</h2>
              <p class="text-surface-600 dark:text-surface-400 text-sm">Ubicaciones con stock web</p>
            </div>
          </div>

          @if (loading()) {
            <div class="flex justify-center py-16">
              <i class="pi pi-spin pi-spinner text-3xl text-surface-400"></i>
            </div>
          } @else if (filtrados().length === 0) {
            <p class="text-center py-16 text-surface-500">No hay barrios publicados por el momento.</p>
          } @else {
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (barrio of filtrados(); track barrio.id) {
                <a [routerLink]="['/barrios', barrio.slug]"
                   class="group bg-surface-0 dark:bg-surface-800 rounded-2xl overflow-hidden
                          border border-surface-200 dark:border-surface-700 shadow-soft
                          hover:shadow-soft-lg transition-all duration-300 block">
                  <div class="relative h-56 overflow-hidden">
                    <img [src]="portadaUrl(barrio)" [alt]="barrio.nombre"
                         class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                         loading="lazy" />
                    @if (barrio.unidadesCount > 0) {
                      <span class="absolute top-4 left-4 bg-sage-50 text-sage-700 dark:bg-sage-900/40 dark:text-sage-200
                                   px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">
                        Disponible
                      </span>
                    }
                  </div>
                  <div class="p-5">
                    <div class="flex justify-between items-start gap-2 mb-2">
                      <h3 class="font-bold text-lg text-surface-900 dark:text-surface-0">{{ barrio.nombre }}</h3>
                      @if (precioLabel(barrio); as pl) {
                        <span class="font-bold text-primary whitespace-nowrap">{{ pl }}</span>
                      }
                    </div>
                    @if (barrio.ubicacion_texto) {
                      <p class="text-surface-500 text-xs mb-4 flex items-center gap-1">
                        <i class="pi pi-map-marker text-[10px]"></i>{{ barrio.ubicacion_texto }}
                      </p>
                    }
                    <div class="flex items-center justify-between pt-4 border-t border-surface-200 dark:border-surface-700">
                      <div class="flex gap-4 text-sm">
                        <div>
                          <span class="text-[9px] text-surface-500 uppercase font-bold block">Unidades</span>
                          <span class="font-bold text-surface-800 dark:text-surface-100">{{ barrio.unidadesCount }}</span>
                        </div>
                        <div>
                          <span class="text-[9px] text-surface-500 uppercase font-bold block">Tamaño</span>
                          <span class="font-bold text-surface-800 dark:text-surface-100">{{ areaLabel(barrio) }}</span>
                        </div>
                      </div>
                      <i class="pi pi-arrow-right text-primary group-hover:translate-x-1 transition-transform"></i>
                    </div>
                  </div>
                </a>
              }
            </div>
          }
        </section>

        <!-- CTA -->
        <section class="max-w-7xl mx-auto px-5 pb-20">
          <div class="bg-surface-100 dark:bg-surface-800 rounded-[32px] p-10 md:p-14 text-center md:text-left
                      flex flex-col md:flex-row items-center gap-8 border border-surface-200 dark:border-surface-700">
            <div class="md:flex-1">
              <h2 class="text-3xl font-extrabold text-surface-900 dark:text-surface-0 mb-3">
                ¿Listo para tu próximo lote?
              </h2>
              <p class="text-surface-600 dark:text-surface-300 max-w-lg">
                Contactanos y te ayudamos a encontrar la unidad que mejor se adapte a vos.
              </p>
            </div>
            <a routerLink="/mapa"
               class="bg-primary hover:bg-primary-600 text-white px-8 py-4 rounded-full font-bold shadow-soft
                      transition-all active:scale-95 shrink-0">
              Explorar en mapa
            </a>
          </div>
        </section>
      </main>

      <landing-footer />
    </div>
  `,
})
export class BarriosComponent implements OnInit {
  private barriosSvc = inject(BarriosService);
  private pb = inject(POCKETBASE);

  readonly loading = signal(true);
  readonly barrios = signal<BarrioConCatalogo[]>([]);
  readonly busqueda = signal('');

  readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const rows = this.barrios();
    if (!q) return rows;
    return rows.filter(
      (b) =>
        b.nombre.toLowerCase().includes(q) ||
        (b.ubicacion_texto?.toLowerCase().includes(q) ?? false),
    );
  });

  ngOnInit(): void {
    void this.load();
  }

  portadaUrl(barrio: BarrioConCatalogo): string {
    if (!barrio.imagen_portada) return PLACEHOLDER_BARRIO_URL;
    return this.pb.files.getURL(barrio, barrio.imagen_portada);
  }

  precioLabel(barrio: BarrioConCatalogo): string | null {
    return formatPrecioDesde(barrio.precioDesde, barrio.moneda);
  }

  areaLabel(barrio: BarrioConCatalogo): string {
    return formatAreaRange(barrio.areaMin, barrio.areaMax);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.barriosSvc.listFiltered({ soloPublicados: true }, null, {
        sort: 'nombre',
      });
      this.barrios.set(attachCatalogStatsFromSnapshots(rows.filter(isBarrioWebReady)));
    } finally {
      this.loading.set(false);
    }
  }
}

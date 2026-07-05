import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { BarriosService, POCKETBASE, type BarrioConCatalogo } from '@loteomanager/shared-pb-client';
import { LandingTopbarComponent } from '../layout/landing-topbar/landing-topbar.component';
import { LandingMapaComponent, type MapaMarcador } from '../components/landing-mapa/landing-mapa.component';
import { formatAreaRange, formatPrecioDesde } from '../utils/catalog-format';

@Component({
  selector: 'app-barrios-mapa',
  standalone: true,
  imports: [CommonModule, RouterModule, LandingTopbarComponent, LandingMapaComponent],
  template: `
    <div class="min-h-screen bg-surface-warm dark:bg-surface-900 flex flex-col">
      <landing-topbar />

      <div class="pt-16 flex flex-1 min-h-0 flex-col md:flex-row">
        <!-- Sidebar -->
        <aside class="w-full md:w-96 shrink-0 border-r border-surface-200 dark:border-surface-700
                       bg-surface-0 dark:bg-surface-900 overflow-y-auto max-h-[40vh] md:max-h-none">
          <div class="p-5">
            <h2 class="text-xl font-bold text-surface-900 dark:text-surface-0 mb-1">Barrios en mapa</h2>
            <p class="text-xs text-surface-500 mb-4">{{ conUbicacion().length }} con ubicación</p>

            @if (loading()) {
              <div class="flex justify-center py-8">
                <i class="pi pi-spin pi-spinner text-2xl text-surface-400"></i>
              </div>
            } @else if (conUbicacion().length === 0) {
              <p class="text-sm text-surface-500">No hay barrios con coordenadas publicadas.</p>
            } @else {
              <div class="space-y-3">
                @for (b of conUbicacion(); track b.id) {
                  <a [routerLink]="['/barrios', b.slug]"
                     class="p-4 rounded-2xl border flex gap-3 transition-all block"
                     [class.border-primary]="seleccionado()?.id === b.id"
                     [class.bg-primary/5]="seleccionado()?.id === b.id"
                     [class.border-surface-200]="seleccionado()?.id !== b.id"
                     [class.dark:border-surface-700]="seleccionado()?.id !== b.id"
                     [class.hover:shadow-soft]="seleccionado()?.id !== b.id"
                     (mouseenter)="hoverBarrio(b)">
                    @if (thumbUrl(b); as thumb) {
                      <img [src]="thumb" [alt]="b.nombre"
                           class="w-16 h-16 rounded-xl object-cover shrink-0" loading="lazy" />
                    } @else {
                      <div class="w-16 h-16 rounded-xl bg-surface-200 dark:bg-surface-700 flex items-center justify-center shrink-0">
                        <i class="pi pi-image text-surface-400"></i>
                      </div>
                    }
                    <div class="min-w-0">
                      <h4 class="font-bold text-sm text-surface-900 dark:text-surface-0 truncate">{{ b.nombre }}</h4>
                      @if (b.ubicacion_texto) {
                        <p class="text-xs text-surface-500 truncate mb-1">{{ b.ubicacion_texto }}</p>
                      }
                      @if (precioLabel(b); as pl) {
                        <span class="text-primary font-bold text-sm">{{ pl }}</span>
                      }
                      <p class="text-[10px] text-surface-500 mt-0.5">{{ areaLabel(b) }} · {{ b.unidadesCount }} disp.</p>
                    </div>
                  </a>
                }
              </div>
            }
          </div>
        </aside>

        <!-- Mapa -->
        <div class="flex-1 relative min-h-[50vh] md:min-h-0 bg-surface-100 dark:bg-surface-800">
          @if (marcadores().length) {
            <landing-mapa [marcadores]="marcadores()" />
          } @else if (!loading()) {
            <div class="absolute inset-0 flex items-center justify-center p-8">
              <div class="text-center max-w-sm bg-surface-0/80 dark:bg-surface-900/80 backdrop-blur-md
                          rounded-[32px] shadow-soft-lg border border-surface-200 dark:border-surface-700 p-8">
                <i class="pi pi-map text-5xl text-primary mb-4"></i>
                <h3 class="text-lg font-bold mb-2">Sin ubicaciones en mapa</h3>
                <p class="text-sm text-surface-500">Los barrios publicados aún no tienen coordenadas cargadas.</p>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class BarriosMapaComponent implements OnInit {
  private barriosSvc = inject(BarriosService);
  private pb = inject(POCKETBASE);
  private route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly barrios = signal<BarrioConCatalogo[]>([]);
  readonly seleccionado = signal<BarrioConCatalogo | null>(null);

  readonly conUbicacion = computed(() =>
    this.barrios().filter((b) => b.lat != null && b.lng != null),
  );

  readonly marcadores = computed((): MapaMarcador[] =>
    this.conUbicacion().map((b) => ({
      lat: b.lat!,
      lng: b.lng!,
      titulo: b.nombre,
    })),
  );

  ngOnInit(): void {
    void this.load();
  }

  hoverBarrio(b: BarrioConCatalogo): void {
    this.seleccionado.set(b);
  }

  thumbUrl(b: BarrioConCatalogo): string | null {
    if (!b.imagen_portada) return null;
    return this.pb.files.getURL(b, b.imagen_portada);
  }

  precioLabel(b: BarrioConCatalogo): string | null {
    return formatPrecioDesde(b.precioDesde, b.moneda);
  }

  areaLabel(b: BarrioConCatalogo): string {
    return formatAreaRange(b.areaMin, b.areaMax);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.barriosSvc.listFiltered({ soloPublicados: true }, null, {
        sort: 'nombre',
      });
      const withStats = await this.barriosSvc.attachCatalogStats(rows);
      this.barrios.set(withStats);

      const slug = this.route.snapshot.queryParamMap.get('barrio');
      if (slug) {
        const match = withStats.find((b) => b.slug === slug);
        if (match) this.seleccionado.set(match);
      }
    } finally {
      this.loading.set(false);
    }
  }
}

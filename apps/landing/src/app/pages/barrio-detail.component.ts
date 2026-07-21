import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BarriosService, POCKETBASE, barrioFromSnapshot, parseBarrioWebSnapshot, snapUnidadToUnidadesResponse } from '@loteomanager/shared-pb-client';
import { isInUruguay, TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
import type { BarriosResponse, TipoUnidadIngreso, UnidadesResponse } from '@loteomanager/shared-types';
import { LandingTopbarComponent } from '../layout/landing-topbar/landing-topbar.component';
import { LandingFooterComponent } from '../layout/landing-footer/landing-footer.component';
import { LandingMapaComponent } from '../components/landing-mapa/landing-mapa.component';
import { SanitizeHtmlPipe } from '../pipes/sanitize-html.pipe';
import { PrecioFormatPipe } from '../pipes/precio-format.pipe';
import { formatAreaRange, formatPrecioDesde } from '../utils/catalog-format';

type UnidadGrupo = {
  tipo: TipoUnidadIngreso;
  label: string;
  unidades: UnidadesResponse[];
};

@Component({
  selector: 'app-barrio-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LandingTopbarComponent,
    LandingFooterComponent,
    LandingMapaComponent,
    SanitizeHtmlPipe,
    PrecioFormatPipe,
  ],
  template: `
    <div class="min-h-screen bg-surface-warm dark:bg-surface-900">
      <landing-topbar />

      @if (loading()) {
        <div class="flex justify-center py-32">
          <i class="pi pi-spin pi-spinner text-3xl text-surface-400"></i>
        </div>
      } @else if (barrio()) {
        <main class="pt-20 max-w-7xl mx-auto px-5 py-8">
          <a routerLink="/"
             class="inline-flex items-center gap-2 text-primary font-bold mb-6 hover:-translate-x-1 transition-transform">
            <i class="pi pi-arrow-left"></i> Volver al catálogo
          </a>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12">
            <!-- Imagen + mapa -->
            <div class="space-y-6">
              <div class="rounded-3xl overflow-hidden shadow-soft-lg h-[320px] lg:h-[420px]">
                @if (portadaUrl()) {
                  <img [src]="portadaUrl()!" [alt]="barrio()!.nombre"
                       class="w-full h-full object-cover" />
                } @else {
                  <div class="w-full h-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center">
                    <i class="pi pi-image text-6xl text-surface-400"></i>
                  </div>
                }
              </div>
              @if (tieneMapa()) {
                <div class="rounded-2xl overflow-hidden h-[280px] border border-surface-200 dark:border-surface-700">
                  @defer (on viewport) {
                    <landing-mapa [lat]="barrio()!.lat!" [lng]="barrio()!.lng!"
                                  [titulo]="barrio()!.nombre" />
                  } @placeholder {
                    <div class="w-full h-full bg-surface-100 flex items-center justify-center">
                      <i class="pi pi-map text-4xl text-surface-300"></i>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Info -->
            <div class="flex flex-col">
              <span class="text-primary font-bold text-[11px] uppercase tracking-widest">Barrio</span>
              <h1 class="text-4xl font-extrabold text-surface-900 dark:text-surface-0 mt-1 mb-4">
                {{ barrio()!.nombre }}
              </h1>

              @if (barrio()!.ubicacion_texto) {
                <p class="text-surface-600 dark:text-surface-300 flex items-center gap-2 mb-6">
                  <i class="pi pi-map-marker text-primary"></i>{{ barrio()!.ubicacion_texto }}
                </p>
              }

              <!-- Stats rangos -->
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                @if (stats().precioDesde != null) {
                  <div class="bg-surface-100 dark:bg-surface-800 px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700">
                    <span class="text-[10px] text-surface-500 uppercase font-bold block">Desde</span>
                    <span class="font-bold text-primary text-lg">
                      {{ formatPrecioDesde(stats().precioDesde, stats().moneda)?.replace('+', '') }}
                    </span>
                  </div>
                }
                <div class="bg-surface-100 dark:bg-surface-800 px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700">
                  <span class="text-[10px] text-surface-500 uppercase font-bold block">Tamaño</span>
                  <span class="font-bold text-surface-900 dark:text-surface-0">{{ areaRango() }}</span>
                </div>
                <div class="bg-surface-100 dark:bg-surface-800 px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700">
                  <span class="text-[10px] text-surface-500 uppercase font-bold block">Disponibles</span>
                  <span class="font-bold text-surface-900 dark:text-surface-0">{{ stats().unidadesCount }}</span>
                </div>
              </div>

              @if (barrio()!.descripcion) {
                <div class="text-surface-600 dark:text-surface-300 leading-relaxed mb-8 prose max-w-none"
                     [innerHTML]="barrio()!.descripcion | sanitizeHtml"></div>
              }

              @if (planoUrl()) {
                <div class="mb-8 rounded-2xl overflow-hidden border border-surface-200 dark:border-surface-700 p-3 bg-surface-0 dark:bg-surface-800">
                  <img [src]="planoUrl()!" alt="Plano general" class="w-full h-auto rounded-xl" loading="lazy" />
                </div>
              }

              <div class="bg-surface-100 dark:bg-surface-800 p-6 rounded-[32px] flex flex-col sm:flex-row
                          items-center justify-between gap-4 mt-auto border border-surface-200 dark:border-surface-700">
                <div>
                  <span class="text-surface-500 text-xs uppercase font-bold block mb-1">Precios desde</span>
                  @if (stats().precioDesde; as precioDesde) {
                    <span class="text-2xl font-extrabold text-primary">
                      {{ precioDesde | precioFormat: (stats().moneda ?? 'USD') }}
                    </span>
                  } @else {
                    <span class="text-surface-500">Consultar</span>
                  }
                </div>
                <a routerLink="/mapa" [queryParams]="{ barrio: barrio()!.slug }"
                   class="bg-primary hover:bg-primary-600 text-white px-8 py-3 rounded-full font-bold
                          shadow-soft transition-all active:scale-95 w-full sm:w-auto text-center">
                  Ver en mapa
                </a>
              </div>
            </div>
          </div>

          <!-- Unidades -->
          @for (grupo of grupos(); track grupo.tipo) {
            <section class="mt-14">
              <h2 class="text-2xl font-bold mb-6 text-surface-900 dark:text-surface-0">{{ grupo.label }}</h2>
              @if (grupo.unidades.length === 0) {
                <p class="text-surface-500">Sin unidades visibles.</p>
              } @else {
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  @for (u of grupo.unidades; track u.id) {
                    <a [routerLink]="['/lotes', u.id]"
                       class="bg-surface-0 dark:bg-surface-800 rounded-2xl border border-surface-200
                              dark:border-surface-700 p-5 shadow-soft hover:shadow-soft-lg transition-all block">
                      <div class="flex justify-between gap-2 mb-2">
                        <span class="font-bold text-surface-900 dark:text-surface-0">
                          {{ u.codigo_interno || u.codigo }}
                        </span>
                        @if (u.precio != null) {
                          <span class="font-bold text-primary whitespace-nowrap">
                            {{ u.precio | precioFormat: u.moneda }}
                          </span>
                        }
                      </div>
                      <div class="flex gap-3 text-sm text-surface-600 dark:text-surface-400">
                        @if (u.metros_cuadrados || u.area_m2) {
                          <span><i class="pi pi-arrows-alt mr-1"></i>{{ u.metros_cuadrados ?? u.area_m2 }} m²</span>
                        }
                        <span class="bg-sage-50 text-sage-700 dark:bg-sage-900/30 dark:text-sage-200
                                     px-2 py-0.5 rounded-full text-[10px] font-bold">Disponible</span>
                      </div>
                    </a>
                  }
                </div>
              }
            </section>
          }
        </main>
      }

      <landing-footer />
    </div>
  `,
})
export class BarrioDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private barriosSvc = inject(BarriosService);
  private pb = inject(POCKETBASE);

  readonly loading = signal(true);
  readonly barrio = signal<BarriosResponse | null>(null);
  readonly unidades = signal<UnidadesResponse[]>([]);

  readonly stats = computed(() => {
    const units = this.unidades();
    let precioDesde: number | null = null;
    let moneda: string | null = null;
    let areaMin: number | null = null;
    let areaMax: number | null = null;

    for (const u of units) {
      if (u.precio != null && (precioDesde == null || u.precio < precioDesde)) {
        precioDesde = u.precio;
        moneda = u.moneda;
      }
      const area = u.metros_cuadrados ?? u.area_m2;
      if (area != null) {
        areaMin = areaMin == null ? area : Math.min(areaMin, area);
        areaMax = areaMax == null ? area : Math.max(areaMax, area);
      }
    }

    return { unidadesCount: units.length, precioDesde, moneda, areaMin, areaMax };
  });

  readonly areaRango = computed(() => formatAreaRange(this.stats().areaMin, this.stats().areaMax));

  readonly grupos = computed((): UnidadGrupo[] => {
    const b = this.barrio();
    const units = this.unidades();
    if (!b) return [];

    const tipos = (b.tipos_unidad?.length ? b.tipos_unidad : [...new Set(units.map((u) => u.tipo_unidad))]) as TipoUnidadIngreso[];

    return tipos.map((tipo) => ({
      tipo,
      label: TIPO_UNIDAD_LABELS[tipo] ?? tipo,
      unidades: units
        .filter((u) => u.tipo_unidad === tipo)
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true })),
    }));
  });

  readonly formatPrecioDesde = formatPrecioDesde;

  ngOnInit(): void {
    void this.load();
  }

  portadaUrl(): string | null {
    const b = this.barrio();
    if (!b?.imagen_portada) return null;
    return this.pb.files.getURL(b, b.imagen_portada);
  }

  planoUrl(): string | null {
    const b = this.barrio();
    if (!b?.plano_general) return null;
    return this.pb.files.getURL(b, b.plano_general);
  }

  tieneMapa(): boolean {
    const b = this.barrio();
    return b != null && b.lat != null && b.lng != null && isInUruguay(b.lat, b.lng);
  }

  private async load(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      void this.router.navigate(['/404']);
      return;
    }

    this.loading.set(true);
    try {
      const found = await this.barriosSvc.getBySlug(slug);
      const snap = found ? parseBarrioWebSnapshot(found.snapshot) : null;
      if (!found || !found.publicado || !snap) {
        void this.router.navigate(['/404']);
        return;
      }

      this.barrio.set(barrioFromSnapshot(found, snap));
      const units = snap.unidades
        .filter((u) => u.estado === 'disponible')
        .map((u) => snapUnidadToUnidadesResponse(u, found.id));
      this.unidades.set(units);
    } catch {
      void this.router.navigate(['/404']);
    } finally {
      this.loading.set(false);
    }
  }
}

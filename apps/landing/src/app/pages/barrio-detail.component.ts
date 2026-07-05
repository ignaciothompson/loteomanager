import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BarriosService, POCKETBASE, UnidadesService } from '@loteomanager/shared-pb-client';
import { TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
import type { BarriosResponse, TipoUnidadIngreso, UnidadesResponse } from '@loteomanager/shared-types';
import { LandingTopbarComponent } from '../layout/landing-topbar/landing-topbar.component';
import { LandingFooterComponent } from '../layout/landing-footer/landing-footer.component';
import { LandingMapaComponent } from '../components/landing-mapa/landing-mapa.component';
import { SanitizeHtmlPipe } from '../pipes/sanitize-html.pipe';
import { PrecioFormatPipe } from '../pipes/precio-format.pipe';

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
    <div class="min-h-screen bg-surface-50 dark:bg-surface-900">
      <landing-topbar />

      @if (loading()) {
        <div class="flex justify-center py-24">
          <i class="pi pi-spin pi-spinner text-3xl text-surface-400"></i>
        </div>
      } @else if (barrio()) {
        <main class="max-w-5xl mx-auto px-4 lg:px-0 py-8">
          <!-- Hero -->
          <section class="relative h-[40vh] min-h-[280px] rounded-2xl overflow-hidden mb-8">
            @if (portadaUrl()) {
              <img [src]="portadaUrl()!" [alt]="barrio()!.nombre"
                   class="w-full h-full object-cover" />
            } @else {
              <div class="w-full h-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center">
                <i class="pi pi-image text-6xl text-surface-400"></i>
              </div>
            }
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
            <div class="absolute bottom-0 left-0 right-0 p-6 lg:p-8 text-white">
              <h1 class="text-3xl lg:text-4xl font-semibold m-0">{{ barrio()!.nombre }}</h1>
              @if (barrio()!.ubicacion_texto) {
                <p class="mt-2 opacity-90 flex items-center gap-2 m-0">
                  <i class="pi pi-map-marker"></i>{{ barrio()!.ubicacion_texto }}
                </p>
              }
            </div>
          </section>

          <!-- Descripción -->
          @if (barrio()!.descripcion) {
            <section class="mb-8 lg:mb-12">
              <h2 class="text-2xl font-semibold mb-4">Descripción</h2>
              <div class="prose max-w-none text-surface-700 dark:text-surface-200"
                   [innerHTML]="barrio()!.descripcion | sanitizeHtml"></div>
            </section>
          }

          <!-- Mapa -->
          @if (barrio()!.lat != null && barrio()!.lng != null) {
            <section class="mb-8 lg:mb-12">
              <h2 class="text-2xl font-semibold mb-6">Ubicación</h2>
              <div class="rounded-2xl overflow-hidden h-[400px] border border-surface-200">
                @defer (on viewport) {
                  <landing-mapa [lat]="barrio()!.lat!" [lng]="barrio()!.lng!"
                                [titulo]="barrio()!.nombre" />
                } @placeholder {
                  <div class="w-full h-full bg-surface-100 flex items-center justify-center">
                    <i class="pi pi-map text-4xl text-surface-300"></i>
                  </div>
                }
              </div>
            </section>
          }

          <!-- Plano general -->
          @if (planoUrl()) {
            <section class="mb-8 lg:mb-12">
              <h2 class="text-2xl font-semibold mb-6">Plano general</h2>
              <div class="rounded-2xl overflow-hidden border border-surface-200 bg-surface-50 p-4">
                <img [src]="planoUrl()!" class="w-full h-auto" alt="Plano general del barrio"
                     loading="lazy" />
              </div>
            </section>
          }

          <!-- Unidades por tipo -->
          @for (grupo of grupos(); track grupo.tipo) {
            <section class="mb-8 lg:mb-12">
              <h2 class="text-2xl font-semibold mb-6">{{ grupo.label }}</h2>
              @if (grupo.unidades.length === 0) {
                <p class="text-muted-color">No hay unidades visibles en la web.</p>
              } @else {
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  @for (u of grupo.unidades; track u.id) {
                    <a [routerLink]="['/lotes', u.id]"
                       class="bg-surface-0 dark:bg-surface-800 rounded-xl border border-surface-200
                              dark:border-surface-700 p-5 hover:shadow-lg transition-shadow block">
                      <div class="flex justify-between items-start gap-2 mb-2">
                        <span class="font-bold text-lg text-surface-900 dark:text-surface-0">
                          {{ u.codigo_interno || u.codigo }}
                        </span>
                        @if (u.precio != null) {
                          <span class="font-bold text-primary-600 dark:text-primary-400 whitespace-nowrap">
                            {{ u.precio | precioFormat: u.moneda }}
                          </span>
                        }
                      </div>
                      <div class="flex flex-wrap gap-3 text-sm text-surface-600 dark:text-surface-300">
                        @if (u.metros_cuadrados || u.area_m2) {
                          <span><i class="pi pi-arrows-alt mr-1"></i>{{ u.metros_cuadrados ?? u.area_m2 }} m²</span>
                        }
                        @if (u.orientacion) {
                          <span><i class="pi pi-compass mr-1"></i>{{ u.orientacion }}</span>
                        }
                      </div>
                    </a>
                  }
                </div>
              }
            </section>
          }

          <div class="h-16"></div>
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
  private unidadesSvc = inject(UnidadesService);
  private pb = inject(POCKETBASE);

  readonly loading = signal(true);
  readonly barrio = signal<BarriosResponse | null>(null);
  readonly unidades = signal<UnidadesResponse[]>([]);

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

  ngOnInit(): void {
    void this.load();
  }

  portadaUrl(): string | null {
    const b = this.barrio();
    if (!b?.imagen_portada) return null;
    return this.pb.files.getUrl(b, b.imagen_portada);
  }

  planoUrl(): string | null {
    const b = this.barrio();
    if (!b?.plano_general) return null;
    return this.pb.files.getUrl(b, b.plano_general);
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
      if (!found || !found.publicado) {
        void this.router.navigate(['/404']);
        return;
      }

      this.barrio.set(found);
      const units = await this.unidadesSvc.listByBarrios(
        [found.id],
        'web_visible = true && estado = "disponible"',
        { sort: 'codigo' },
      );
      this.unidades.set(units);
    } catch {
      void this.router.navigate(['/404']);
    } finally {
      this.loading.set(false);
    }
  }
}

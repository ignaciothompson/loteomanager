import { Component, inject, signal, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BarriosService, POCKETBASE, UnidadesService } from '@loteomanager/shared-pb-client';
import { TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';
import type { BarriosResponse, UnidadesResponse } from '@loteomanager/shared-types';
import { LandingTopbarComponent } from '../layout/landing-topbar/landing-topbar.component';
import { LandingFooterComponent } from '../layout/landing-footer/landing-footer.component';
import { DatoCardComponent } from '../components/dato-card/dato-card.component';
import { LightboxGaleriaComponent } from '../components/lightbox-galeria/lightbox-galeria.component';
import { SanitizeHtmlPipe } from '../pipes/sanitize-html.pipe';
import { LandingMapaComponent } from '../components/landing-mapa/landing-mapa.component';
import { ContactarUnidadFabComponent } from '../components/contactar-unidad-fab/contactar-unidad-fab.component';
import { PrecioFormatPipe } from '../pipes/precio-format.pipe';

@Component({
  selector: 'app-lote-detail',
  standalone: true,
  imports: [
    CommonModule,
    LandingTopbarComponent,
    LandingFooterComponent,
    DatoCardComponent,
    LightboxGaleriaComponent,
    SanitizeHtmlPipe,
    LandingMapaComponent,
    ContactarUnidadFabComponent,
    PrecioFormatPipe,
  ],
  template: `
    <div class="min-h-screen bg-surface-50 dark:bg-surface-900">
      <landing-topbar />

      @if (loading()) {
        <div class="flex justify-center py-24">
          <i class="pi pi-spin pi-spinner text-3xl text-surface-400"></i>
        </div>
      } @else if (unidad() && barrio()) {
        <main class="max-w-5xl mx-auto px-4 lg:px-0">
          <!-- Hero -->
          <section class="relative h-[60vh] min-h-[400px] rounded-b-3xl overflow-hidden">
            @if (imagenHero()) {
              <img [src]="imagenHero()!" [alt]="codigoDisplay()"
                   class="w-full h-full object-cover" />
            } @else {
              <div class="w-full h-full bg-surface-100 flex items-center justify-center">
                <i class="pi pi-image text-6xl text-surface-300"></i>
              </div>
            }
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
            <div class="absolute bottom-0 left-0 right-0 p-6 lg:p-8 text-white">
              <span class="text-sm opacity-80">{{ tipoLabel() }}</span>
              <h1 class="text-3xl lg:text-5xl font-semibold mt-1 m-0">{{ codigoDisplay() }}</h1>
              @if (precioDisplay() != null) {
                <div class="mt-2 text-2xl lg:text-3xl font-bold">
                  {{ precioDisplay()! | precioFormat: unidad()!.moneda }}
                </div>
              }
              @if (enOferta()) {
                <div class="text-sm opacity-90 line-through">
                  {{ unidad()!.precio! | precioFormat: unidad()!.moneda }}
                </div>
              }
            </div>
          </section>

          @if (unidad()!.descripcion) {
            <section class="mt-8 lg:mt-12 p-6 bg-surface-50 rounded-2xl border border-surface-200">
              <h2 class="text-sm uppercase tracking-wide text-surface-500 mb-2">Descripción</h2>
              <div class="text-base leading-relaxed"
                   [innerHTML]="unidad()!.descripcion | sanitizeHtml"></div>
            </section>
          }

          <!-- Características -->
          <section class="mt-8 lg:mt-12">
            <h2 class="text-2xl font-semibold mb-6">Características</h2>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
              @if (unidad()!.metros_cuadrados || unidad()!.area_m2) {
                <dato-card icon="pi-th-large" label="Superficie"
                           [value]="(unidad()!.metros_cuadrados ?? unidad()!.area_m2) + ' m²'" />
              }
              @if (unidad()!.metros_construidos) {
                <dato-card icon="pi-home" label="Construido"
                           [value]="unidad()!.metros_construidos + ' m²'" />
              }
              @if (extraStr('sup_cubierta')) {
                <dato-card icon="pi-home" label="Sup. cubierta" [value]="extraStr('sup_cubierta')!" />
              }
              @if (extraStr('dormitorios')) {
                <dato-card icon="pi-building" label="Dormitorios" [value]="extraStr('dormitorios')!" />
              }
              @if (extraStr('banos')) {
                <dato-card icon="pi-building" label="Baños" [value]="extraStr('banos')!" />
              }
              @if (extraStr('fabricante')) {
                <dato-card icon="pi-box" label="Fabricante" [value]="extraStr('fabricante')!" />
              }
              @if (unidad()!.numero_unidad) {
                <dato-card icon="pi-box" label="Modelo" [value]="unidad()!.numero_unidad!" />
              }
              @if (unidad()!.orientacion) {
                <dato-card icon="pi-compass" label="Orientación" [value]="unidad()!.orientacion!" />
              }
              @if (barrio()!.nombre) {
                <dato-card icon="pi-map-marker" label="Barrio" [value]="barrio()!.nombre" />
              }
            </div>
          </section>

          <!-- Mapa -->
          @if (mapLat() != null && mapLng() != null) {
            <section class="mt-8 lg:mt-12">
              <h2 class="text-2xl font-semibold mb-6">Ubicación</h2>
              @if (barrio()!.ubicacion_texto) {
                <div class="text-surface-600 mb-3">
                  {{ barrio()!.nombre }} — {{ barrio()!.ubicacion_texto }}
                </div>
              }
              <div class="rounded-2xl overflow-hidden h-[400px] border border-surface-200">
                @defer (on viewport) {
                  <landing-mapa [lat]="mapLat()!" [lng]="mapLng()!"
                                [titulo]="barrio()!.nombre" />
                } @placeholder {
                  <div class="w-full h-full bg-surface-100 flex items-center justify-center">
                    <i class="pi pi-map text-4xl text-surface-300"></i>
                  </div>
                }
              </div>
            </section>
          }

          <!-- Plano -->
          @if (planoUrl()) {
            <section class="mt-8 lg:mt-12">
              <h2 class="text-2xl font-semibold mb-6">Plano</h2>
              <div class="rounded-2xl overflow-hidden border border-surface-200 bg-surface-50 p-4">
                <img [src]="planoUrl()!" class="w-full h-auto" alt="Plano de la unidad"
                     loading="lazy" />
              </div>
            </section>
          }

          <!-- Galería -->
          @if (galeriaUrls().length > 0) {
            <section class="mt-8 lg:mt-12 mb-16">
              <h2 class="text-2xl font-semibold mb-6">Galería</h2>
              <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
                @for (img of galeriaUrls(); track img; let i = $index) {
                  <img [src]="img" loading="lazy"
                       (click)="lightbox.open(i)"
                       class="aspect-[4/3] object-cover rounded-xl cursor-pointer hover:opacity-90 transition"
                       alt="Imagen de galería" />
                }
              </div>
            </section>
          }

          <div class="h-32"></div>
        </main>

        <landing-footer />
        <contactar-unidad-fab [unidadId]="unidad()!.id" />
        <lightbox-galeria #lightbox [images]="galeriaUrls()" />
      }
    </div>
  `,
})
export class LoteDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private unidadesSvc = inject(UnidadesService);
  private barriosSvc = inject(BarriosService);
  private pb = inject(POCKETBASE);

  @ViewChild('lightbox') lightboxRef!: LightboxGaleriaComponent;

  readonly loading = signal(true);
  readonly unidad = signal<UnidadesResponse | null>(null);
  readonly barrio = signal<BarriosResponse | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  codigoDisplay(): string {
    const u = this.unidad();
    return u?.codigo_interno || u?.codigo || '';
  }

  tipoLabel(): string {
    const u = this.unidad();
    if (!u) return '';
    return TIPO_UNIDAD_LABELS[u.tipo_unidad as keyof typeof TIPO_UNIDAD_LABELS] ?? u.tipo_unidad;
  }

  enOferta(): boolean {
    const u = this.unidad();
    return !!(u?.oferta && u.precio_oferta && u.precio && u.precio_oferta < u.precio);
  }

  precioDisplay(): number | null {
    const u = this.unidad();
    if (!u?.precio) return null;
    if (this.enOferta() && u.precio_oferta) return u.precio_oferta;
    return u.precio;
  }

  imagenHero(): string | null {
    const u = this.unidad();
    if (!u?.galeria?.length) return null;
    return this.pb.files.getUrl(u, u.galeria[0]);
  }

  galeriaUrls(): string[] {
    const u = this.unidad();
    if (!u?.galeria?.length) return [];
    const urls = u.galeria.map((f) => this.pb.files.getUrl(u, f));
    return urls.length > 1 ? urls.slice(1) : [];
  }

  planoUrl(): string | null {
    const u = this.unidad();
    if (!u?.plano_unidad) return null;
    return this.pb.files.getUrl(u, u.plano_unidad);
  }

  mapLat(): number | null {
    return this.barrio()?.lat ?? null;
  }

  mapLng(): number | null {
    return this.barrio()?.lng ?? null;
  }

  extraStr(key: string): string | null {
    const extras = this.unidad()?.extras;
    if (!extras || typeof extras !== 'object') return null;
    const val = (extras as Record<string, unknown>)[key];
    if (val == null || val === '') return null;
    return String(val);
  }

  private async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/404']);
      return;
    }

    this.loading.set(true);
    try {
      const u = await this.unidadesSvc.getAsync(id);
      if (u.web_visible === false) {
        void this.router.navigate(['/404']);
        return;
      }

      this.unidad.set(u);

      if (!u.barrio_id) {
        void this.router.navigate(['/404']);
        return;
      }

      try {
        const b = await this.barriosSvc.getAsync(u.barrio_id);
        if (!b.publicado) {
          void this.router.navigate(['/404']);
          return;
        }
        this.barrio.set(b);
      } catch {
        void this.router.navigate(['/404']);
        return;
      }
    } catch {
      void this.router.navigate(['/404']);
    } finally {
      this.loading.set(false);
    }
  }
}

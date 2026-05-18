import { Component, Input, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import type { ComparativasResponse, ComparativaSnapshot, ComparativaSnapshotUnidad } from '@loteomanager/shared-types';
import { LandingTopbarComponent } from '../../../layout/landing-topbar/landing-topbar.component';
import { LandingFooterComponent } from '../../../layout/landing-footer/landing-footer.component';
import { DatoCardComponent } from '../../../components/dato-card/dato-card.component';
import { LightboxGaleriaComponent } from '../../../components/lightbox-galeria/lightbox-galeria.component';
import { SanitizeHtmlPipe } from '../../../pipes/sanitize-html.pipe';
import { LandingMapaComponent } from '../../../components/landing-mapa/landing-mapa.component';
import { ContactarFabComponent } from '../../../components/contactar-fab/contactar-fab.component';
import { DescargarPdfFabComponent } from '../../../components/descargar-pdf-fab/descargar-pdf-fab.component';

@Component({
  selector: 'propuesta-individual',
  standalone: true,
  imports: [
    CommonModule,
    LandingTopbarComponent,
    LandingFooterComponent,
    DatoCardComponent,
    LightboxGaleriaComponent,
    SanitizeHtmlPipe,
    LandingMapaComponent,
    ContactarFabComponent,
    DescargarPdfFabComponent,
  ],
  template: `
    <div [class.pdf-mode]="pdfMode">
      <landing-topbar />

      <main class="max-w-5xl mx-auto px-4 lg:px-0">

        <!-- Hero -->
        <section class="relative h-[60vh] min-h-[400px] rounded-b-3xl overflow-hidden">
          @if (unidad.imagenHero) {
            <img [src]="unidad.imagenHero" [alt]="unidad.codigoInterno"
                 class="w-full h-full object-cover" />
          } @else {
            <div class="w-full h-full bg-surface-100 flex items-center justify-center">
              <i class="pi pi-image text-6xl text-surface-300"></i>
            </div>
          }
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
          <div class="absolute bottom-0 left-0 right-0 p-6 lg:p-8 text-white">
            <span class="text-sm opacity-80">{{ unidad.tipoUnidadLabel }}</span>
            <h1 class="text-3xl lg:text-5xl font-semibold mt-1">{{ unidad.codigoInterno }}</h1>
            <div class="mt-2 text-2xl lg:text-3xl font-bold">{{ unidad.precioFormateado }}</div>
            @if (unidad.enOferta && unidad.precioOriginalFormateado) {
              <div class="text-sm opacity-90 line-through">{{ unidad.precioOriginalFormateado }}</div>
            }
          </div>
        </section>

        <!-- Mensaje personalizado -->
        @if (snapshot.mensajePersonalizado) {
          <section class="mt-8 lg:mt-12 p-6 bg-surface-50 rounded-2xl border border-surface-200">
            <h2 class="text-sm uppercase tracking-wide text-surface-500 mb-2">Mensaje</h2>
            <div class="text-base leading-relaxed"
                 [innerHTML]="snapshot.mensajePersonalizado | sanitizeHtml"></div>
          </section>
        }

        <!-- Características -->
        <section class="mt-8 lg:mt-12">
          <h2 class="text-2xl font-semibold mb-6">Características</h2>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <dato-card icon="pi-th-large" label="Superficie"
                       [value]="unidad.metrosCuadrados + ' m²'" />
            @if (unidad.metrosConstruidos) {
              <dato-card icon="pi-home" label="Construido"
                         [value]="unidad.metrosConstruidos + ' m²'" />
            }
            @if (unidad.ambientes) {
              <dato-card icon="pi-building" label="Ambientes"
                         [value]="unidad.ambientes" />
            }
            @if (unidad.antiguedadAnios != null) {
              <dato-card icon="pi-calendar" label="Antigüedad"
                         [value]="unidad.antiguedadAnios === 0 ? 'A estrenar' : unidad.antiguedadAnios + ' años'" />
            }
            @if (unidad.cocheras != null) {
              <dato-card icon="pi-car" label="Cocheras"
                         [value]="unidad.cocheras" />
            }
            @if (unidad.barrioNombre) {
              <dato-card icon="pi-map-marker" label="Barrio"
                         [value]="unidad.barrioNombre" />
            }
          </div>
        </section>

        <!-- Mapa -->
        @if (unidad.lat && unidad.lng) {
          <section class="mt-8 lg:mt-12">
            <h2 class="text-2xl font-semibold mb-6">Ubicación</h2>
            @if (unidad.ubicacionTexto) {
              <div class="text-surface-600 mb-3">
                {{ unidad.barrioNombre }} — {{ unidad.ubicacionTexto }}
              </div>
            }
            <div class="rounded-2xl overflow-hidden h-[400px] border border-surface-200">
              @defer (on viewport) {
                <landing-mapa [lat]="unidad.lat!" [lng]="unidad.lng!"
                              [titulo]="unidad.barrioNombre ?? ''" />
              } @placeholder {
                <div class="w-full h-full bg-surface-100 flex items-center justify-center">
                  <i class="pi pi-map text-4xl text-surface-300"></i>
                </div>
              }
            </div>
          </section>
        }

        <!-- Plano -->
        @if (unidad.urlPlano) {
          <section class="mt-8 lg:mt-12">
            <h2 class="text-2xl font-semibold mb-6">Plano</h2>
            <div class="rounded-2xl overflow-hidden border border-surface-200 bg-surface-50 p-4">
              <img [src]="unidad.urlPlano" class="w-full h-auto" alt="Plano de la unidad"
                   loading="lazy" />
            </div>
          </section>
        }

        <!-- Galería -->
        @if (galeriaAdicional.length > 0) {
          <section class="mt-8 lg:mt-12 mb-16">
            <h2 class="text-2xl font-semibold mb-6">Galería</h2>
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
              @for (img of galeriaAdicional; track img; let i = $index) {
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

      @if (!pdfMode) {
        <contactar-fab [comparativaId]="comparativa.id" />
        <descargar-pdf-fab [token]="token" />
      }

      <lightbox-galeria #lightbox [images]="galeriaAdicional" />
    </div>
  `,
})
export class PropuestaIndividualComponent implements OnInit {
  @Input({ required: true }) comparativa!: ComparativasResponse;
  @Input({ required: true }) snapshot!: ComparativaSnapshot;
  @Input() pdfMode = false;
  @ViewChild('lightbox') lightboxRef!: LightboxGaleriaComponent;

  private route = inject(ActivatedRoute);

  unidad!: ComparativaSnapshotUnidad;
  galeriaAdicional: string[] = [];
  token = '';

  ngOnInit() {
    this.unidad = this.snapshot.unidades[0];
    this.galeriaAdicional = this.unidad?.galeria ?? [];
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
  }
}

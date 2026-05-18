import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import type { ComparativasResponse, ComparativaSnapshot, ComparativaSnapshotUnidad } from '@loteomanager/shared-types';
import { LandingTopbarComponent } from '../../../layout/landing-topbar/landing-topbar.component';
import { LandingFooterComponent } from '../../../layout/landing-footer/landing-footer.component';
import { SanitizeHtmlPipe } from '../../../pipes/sanitize-html.pipe';
import { LandingMapaComponent } from '../../../components/landing-mapa/landing-mapa.component';
import { ContactarFabComponent } from '../../../components/contactar-fab/contactar-fab.component';
import { DescargarPdfFabComponent } from '../../../components/descargar-pdf-fab/descargar-pdf-fab.component';

interface FilaComparativa {
  label: string;
  valores: string[];
  highlight?: boolean;
}

@Component({
  selector: 'comparacion-multiple',
  standalone: true,
  imports: [
    CommonModule,
    LandingTopbarComponent,
    LandingFooterComponent,
    SanitizeHtmlPipe,
    LandingMapaComponent,
    ContactarFabComponent,
    DescargarPdfFabComponent,
  ],
  template: `
    <div [class.pdf-mode]="pdfMode">
      <landing-topbar />

      <main class="max-w-7xl mx-auto px-4 lg:px-8 mt-8 lg:mt-12">

        <!-- Header -->
        <header class="mb-8 lg:mb-12">
          <h1 class="text-3xl lg:text-4xl font-semibold">{{ snapshot.titulo }}</h1>
          <p class="text-surface-600 mt-2">Comparación de {{ unidades.length }} opciones</p>
          @if (snapshot.mensajePersonalizado) {
            <div class="mt-4 p-4 bg-surface-50 rounded-xl text-sm leading-relaxed"
                 [innerHTML]="snapshot.mensajePersonalizado | sanitizeHtml"></div>
          }
        </header>

        <!-- Cards de unidades -->
        <section class="mb-12">
          <div class="flex lg:grid gap-4 overflow-x-auto lg:overflow-visible
                      snap-x snap-mandatory pb-4"
               [style.grid-template-columns]="'repeat(' + unidades.length + ', minmax(0, 1fr))'">
            @for (u of unidades; track u.id) {
              <div class="card-unidad flex-shrink-0 w-[280px] lg:w-auto snap-start
                          bg-surface-0 rounded-2xl overflow-hidden
                          border border-surface-200 hover:border-primary/40 transition">
                @if (u.imagenHero) {
                  <img [src]="u.imagenHero" [alt]="u.codigoInterno"
                       class="aspect-[4/3] object-cover w-full" loading="lazy" />
                } @else {
                  <div class="aspect-[4/3] bg-surface-100 flex items-center justify-center">
                    <i class="pi pi-image text-4xl text-surface-300"></i>
                  </div>
                }
                <div class="p-4">
                  <div class="text-xs text-surface-500 uppercase tracking-wide">
                    {{ u.tipoUnidadLabel }}
                  </div>
                  <div class="font-semibold mt-1">{{ u.codigoInterno }}</div>
                  @if (u.barrioNombre) {
                    <div class="text-sm text-surface-600">{{ u.barrioNombre }}</div>
                  }
                  <div class="mt-3 text-xl font-bold text-primary">{{ u.precioFormateado }}</div>
                  @if (u.enOferta && u.precioOriginalFormateado) {
                    <div class="text-xs text-surface-500 line-through">
                      {{ u.precioOriginalFormateado }}
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Tabla comparativa — Desktop -->
        <section class="mt-4 lg:mt-0">
          <h2 class="text-2xl font-semibold mb-6">Comparación detallada</h2>

          <div class="hidden lg:block overflow-x-auto rounded-2xl border border-surface-200">
            <table class="w-full text-sm">
              <thead class="bg-surface-50">
                <tr>
                  <th class="text-left p-4 font-medium text-surface-600 w-48">Característica</th>
                  @for (u of unidades; track u.id) {
                    <th class="text-left p-4 font-medium">{{ u.codigoInterno }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (fila of filas; track fila.label) {
                  <tr class="border-t border-surface-200"
                      [class.bg-primary/5]="fila.highlight">
                    <td class="p-4 text-surface-600 font-medium">{{ fila.label }}</td>
                    @for (val of fila.valores; track $index) {
                      <td class="p-4">{{ val }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile: cards desplegables -->
          <div class="lg:hidden space-y-3">
            @for (u of unidades; track u.id) {
              <details class="rounded-xl border border-surface-200 overflow-hidden">
                <summary class="p-4 bg-surface-50 cursor-pointer font-medium
                                flex justify-between items-center list-none">
                  <span>{{ u.codigoInterno }} — {{ u.precioFormateado }}</span>
                  <i class="pi pi-chevron-down text-sm text-surface-500"></i>
                </summary>
                <div class="p-4 space-y-2">
                  @for (fila of filas; track fila.label; let i = $index) {
                    <div class="flex justify-between text-sm py-1 border-b border-surface-100 last:border-0">
                      <span class="text-surface-600">{{ fila.label }}</span>
                      <span class="font-medium">{{ fila.valores[unidades.indexOf(u)] }}</span>
                    </div>
                  }
                </div>
              </details>
            }
          </div>
        </section>

        <!-- Mapa con todas las ubicaciones -->
        @if (marcadores.length > 0) {
          <section class="mt-12 lg:mt-16">
            <h2 class="text-2xl font-semibold mb-6">Ubicaciones</h2>
            <div class="rounded-2xl overflow-hidden h-[400px] border border-surface-200">
              @defer (on viewport) {
                <landing-mapa [marcadores]="marcadores" />
              } @placeholder {
                <div class="w-full h-full bg-surface-100 flex items-center justify-center">
                  <i class="pi pi-map text-4xl text-surface-300"></i>
                </div>
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
    </div>
  `,
})
export class ComparacionMultipleComponent implements OnInit {
  @Input({ required: true }) comparativa!: ComparativasResponse;
  @Input({ required: true }) snapshot!: ComparativaSnapshot;
  @Input() pdfMode = false;

  private route = inject(ActivatedRoute);

  unidades: ComparativaSnapshotUnidad[] = [];
  filas: FilaComparativa[] = [];
  marcadores: { lat: number; lng: number; titulo: string }[] = [];
  token = '';

  ngOnInit() {
    this.unidades = this.snapshot.unidades;
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.filas = this.buildFilas();
    this.marcadores = this.unidades
      .filter(u => u.lat != null && u.lng != null)
      .map(u => ({ lat: u.lat!, lng: u.lng!, titulo: u.codigoInterno }));
  }

  private buildFilas(): FilaComparativa[] {
    const us = this.unidades;
    const val = (u: ComparativaSnapshotUnidad, v: string | number | null | undefined) =>
      v != null ? String(v) : '—';

    const base: FilaComparativa[] = [
      {
        label: 'Tipo',
        valores: us.map(u => u.tipoUnidadLabel),
      },
      {
        label: 'Superficie',
        valores: us.map(u => val(u, u.metrosCuadrados ? u.metrosCuadrados + ' m²' : null)),
      },
      {
        label: 'Precio',
        valores: us.map(u => u.precioFormateado),
        highlight: true,
      },
      {
        label: 'Barrio',
        valores: us.map(u => u.barrioNombre ?? 'Independiente'),
      },
    ];

    if (us.some(u => u.ambientes != null)) {
      base.push({ label: 'Ambientes', valores: us.map(u => val(u, u.ambientes)) });
    }
    if (us.some(u => u.antiguedadAnios != null)) {
      base.push({
        label: 'Antigüedad',
        valores: us.map(u =>
          u.antiguedadAnios === 0 ? 'A estrenar' : val(u, u.antiguedadAnios != null ? u.antiguedadAnios + ' años' : null)
        ),
      });
    }
    if (us.some(u => u.cocheras != null)) {
      base.push({ label: 'Cocheras', valores: us.map(u => val(u, u.cocheras)) });
    }
    if (us.some(u => u.metrosConstruidos != null)) {
      base.push({
        label: 'Construido',
        valores: us.map(u => val(u, u.metrosConstruidos ? u.metrosConstruidos + ' m²' : null)),
      });
    }

    return base;
  }
}

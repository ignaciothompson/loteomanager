import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Meta, Title } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import type { ComparativasResponse, ComparativaSnapshot } from '@loteomanager/shared-types';
import { ConfigPublicaService } from '../../services/config-publica.service';
import { PropuestaIndividualComponent } from './propuesta-individual/propuesta-individual.component';
import { ComparacionMultipleComponent } from './comparacion-multiple/comparacion-multiple.component';

interface ComparativaApiResponse {
  comparativa: ComparativasResponse;
  snapshot: ComparativaSnapshot;
}

@Component({
  selector: 'page-comparativa-publica',
  standalone: true,
  imports: [CommonModule, PropuestaIndividualComponent, ComparacionMultipleComponent],
  template: `
    @if (loading()) {
      <div class="flex items-center justify-center min-h-screen">
        <i class="pi pi-spin pi-spinner text-4xl text-surface-400"></i>
      </div>
    } @else if (error()) {
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="text-center">
          <i class="pi pi-exclamation-triangle text-5xl text-surface-400 mb-4 block"></i>
          <p class="text-surface-600">{{ error() }}</p>
        </div>
      </div>
    } @else if (data()) {
      @if (data()!.comparativa.tipo === 'propuesta_individual') {
        <propuesta-individual
          [comparativa]="data()!.comparativa"
          [snapshot]="data()!.snapshot"
          [pdfMode]="pdfMode()" />
      } @else {
        <comparacion-multiple
          [comparativa]="data()!.comparativa"
          [snapshot]="data()!.snapshot"
          [pdfMode]="pdfMode()" />
      }
    }
  `,
})
export class ComparativaPublicaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private meta = inject(Meta);
  private titleService = inject(Title);
  private configService = inject(ConfigPublicaService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<ComparativaApiResponse | null>(null);
  readonly pdfMode = computed(() =>
    this.route.snapshot.queryParamMap.get('pdf') === '1',
  );

  async ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    await this.configService.load();

    try {
      const result = await firstValueFrom(
        this.http.get<ComparativaApiResponse>(`/api/comparativas/${token}`)
      );
      this.data.set(result);
      this.setMetaTags(result);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 404 || status === 410) {
        this.router.navigate(['/expirada'], { replaceUrl: true });
        return;
      }
      this.error.set('No se pudo cargar la propuesta. Intentá de nuevo más tarde.');
    } finally {
      this.loading.set(false);
    }
  }

  private setMetaTags(data: ComparativaApiResponse) {
    const { snapshot } = data;
    const config = this.configService.config();
    const primera = snapshot.unidades[0];

    const titulo = `${snapshot.titulo} — ${config.nombreInmobiliaria}`;
    const descripcion = snapshot.unidades.length === 1
      ? `${primera?.tipoUnidadLabel ?? ''} en ${primera?.barrioNombre ?? 'ubicación exclusiva'}. ${primera?.precioFormateado ?? ''}`
      : `Comparación de ${snapshot.unidades.length} propiedades`;
    const imagen = primera?.imagenHero ?? '';

    this.titleService.setTitle(titulo);
    this.meta.updateTag({ name: 'description', content: descripcion });
    this.meta.updateTag({ property: 'og:title', content: titulo });
    this.meta.updateTag({ property: 'og:description', content: descripcion });
    this.meta.updateTag({ property: 'og:image', content: imagen });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: titulo });
    this.meta.updateTag({ name: 'twitter:description', content: descripcion });
    this.meta.updateTag({ name: 'twitter:image', content: imagen });
  }
}

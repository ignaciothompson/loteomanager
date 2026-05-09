/**
 * Generic placeholder page component.
 * Used for all routes that don't have a real implementation yet.
 * Reads the page title from the route's `data.title` property.
 *
 * TODO: implementar en Etapa 1 — reemplazar con componentes reales.
 */
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-placeholder-page',
    standalone: true,
    template: `
        <div class="card">
            <h2>{{ title }}</h2>
            <p class="text-muted-color">
                <!-- TODO: implementar en Etapa 1 -->
                Esta sección está en desarrollo. Próximamente se implementará la funcionalidad completa.
            </p>
        </div>
    `
})
export class PlaceholderPage {
    private route = inject(ActivatedRoute);
    title = this.route.snapshot.data['title'] ?? 'Página en construcción';
}

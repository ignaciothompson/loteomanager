/**
 * Dashboard component — initial landing page for the admin panel.
 * Shows a simple welcome message as placeholder.
 *
 * TODO: implementar en Etapa 1 — agregar widgets de KPIs, gráficos de ventas,
 * estado de lotes, y actividad reciente.
 */
import { Component } from '@angular/core';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    template: `
        <div class="grid grid-cols-12 gap-8">
            <div class="col-span-12">
                <div class="card">
                    <h2>Dashboard</h2>
                    <p class="text-muted-color">
                        Bienvenido a LoteoManager. Este dashboard mostrará KPIs, estado de lotes,
                        ventas recientes y notificaciones.
                    </p>
                    <!-- TODO: implementar widgets de dashboard en Etapa 1 -->
                </div>
            </div>
        </div>
    `
})
export class Dashboard {}

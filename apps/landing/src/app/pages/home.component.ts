import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UnidadesService, BarriosService } from '@loteomanager/shared-pb-client';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  private unidadesService = inject(UnidadesService);
  private barriosService = inject(BarriosService);

  // We only fetch units where estado is 'disponible' and order by created
  unidades = this.unidadesService.list('estado = "disponible"');
  barrios = this.barriosService.list();

  // Highlight first 6 items or specifically marked ones
  destacadas = computed(() => {
    return this.unidades().slice(0, 6);
  });

  getBarrioName(id: string): string {
    const barrio = this.barrios().find(b => b.id === id);
    return barrio ? barrio.nombre : 'Sin Barrio';
  }
}

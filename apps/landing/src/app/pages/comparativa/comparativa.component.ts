import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ComparativasService, UnidadesService, BarriosService } from '@loteomanager/shared-pb-client';
import { ComparativasResponse, UnidadesResponse, BarriosResponse } from '@loteomanager/shared-types';

@Component({
  selector: 'app-comparativa-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comparativa.component.html',
  styleUrls: ['./comparativa.component.css']
})
export class ComparativaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private comparativasService = inject(ComparativasService);
  private unidadesService = inject(UnidadesService);
  private barriosService = inject(BarriosService);

  token = signal<string>('');
  comparativa = signal<ComparativasResponse | null>(null);
  unidades = signal<UnidadesResponse[]>([]);
  barrios = signal<BarriosResponse[]>([]);
  errorMsg = signal('');

  async ngOnInit() {
    this.token.set(this.route.snapshot.paramMap.get('token') || '');
    
    if (this.token()) {
      try {
        // Fetch comparativa by token
        const comps = await this.comparativasService.listAsync(`token_publico = "${this.token()}"`);
        if (comps && comps.length > 0) {
          const comp = comps[0];
          this.comparativa.set(comp);
          
          // Fetch associated units
          if (comp.unidades_ids && comp.unidades_ids.length > 0) {
            const idsFilter = comp.unidades_ids.map(id => `id="${id}"`).join(' || ');
            const units = await this.unidadesService.listAsync(idsFilter);
            this.unidades.set(units);
            
            // Fetch barrios used by these units
            const barrioIds = Array.from(new Set(units.map(u => u.barrio_id).filter(id => id)));
            if (barrioIds.length > 0) {
              const bFilters = barrioIds.map(id => `id="${id}"`).join(' || ');
              const bars = await this.barriosService.listAsync(bFilters);
              this.barrios.set(bars);
            }
          }
        } else {
          this.errorMsg.set('El enlace no existe o ha expirado.');
        }
      } catch (err) {
        this.errorMsg.set('Hubo un error al cargar la información. Intente más tarde.');
      }
    } else {
      this.errorMsg.set('Enlace inválido.');
    }
  }

  getBarrioName(id: string): string {
    const b = this.barrios().find(x => x.id === id);
    return b ? b.nombre : 'Sin Barrio';
  }

  getCreated(): Date | string | undefined {
    return (this.comparativa() as any)?.created;
  }
}

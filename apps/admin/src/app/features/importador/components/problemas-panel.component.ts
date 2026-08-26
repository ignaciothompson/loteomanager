import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import type { AccionMasiva, ProblemaAgrupado } from '../parser/types';

@Component({
  selector: 'app-problemas-panel',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './problemas-panel.component.html',
})
export class ProblemasPanelComponent {
  @Input() problemas: ProblemaAgrupado[] = [];
  @Output() accion = new EventEmitter<{ problema: ProblemaAgrupado; accion: AccionMasiva }>();
  @Output() ver = new EventEmitter<ProblemaAgrupado>();

  barriosLinea(barrios: { nombre: string; count: number }[]): string {
    return barrios.map((b) => `${b.nombre} (${b.count})`).join(' · ');
  }
}

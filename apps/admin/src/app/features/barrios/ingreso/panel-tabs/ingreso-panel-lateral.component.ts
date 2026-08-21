import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { InputTextModule } from 'primeng/inputtext';
import { EstadoBadgeComponent } from '@loteomanager/shared-ui';
import type { PlantillasUnidadResponse, TipoUnidadIngreso, UnidadesResponse } from '@loteomanager/shared-types';
import { formatPrecio, TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';

export type IngresoLateralTab = 'listado' | 'plantillas';

@Component({
  selector: 'app-ingreso-panel-lateral',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TabsModule,
    InputTextModule,
    EstadoBadgeComponent
  ],
  templateUrl: './ingreso-panel-lateral.component.html',
  styleUrl: './ingreso-panel-lateral.component.css'
})
export class IngresoPanelLateralComponent {
  lateralTab = model<IngresoLateralTab>('listado');
  tipoUnidad = input.required<TipoUnidadIngreso>();
  unidades = input.required<UnidadesResponse[]>();
  plantillas = input.required<PlantillasUnidadResponse[]>();
  selectedUnidadId = input<string | null>(null);
  selectedPlantillaId = input<string | null>(null);
  barrioGuardado = input(true);
  readonly codigoFiltro = signal('');

  readonly unidadesDelTipo = computed(() =>
    this.unidades().filter((u) => u.tipo_unidad === this.tipoUnidad())
  );

  readonly unidadesFiltradas = computed(() => {
    const q = this.codigoFiltro().trim().toLowerCase();
    const rows = this.unidadesDelTipo();
    if (!q) return rows;
    return rows.filter((u) => this.codigo(u).toLowerCase().includes(q));
  });

  readonly plantillasFiltradas = computed(() =>
    this.plantillas().filter((p) => p.tipo_unidad === this.tipoUnidad())
  );

  selectUnidad = output<UnidadesResponse>();
  selectPlantilla = output<PlantillasUnidadResponse>();
  nueva = output<void>();

  tipoLabel(tipo: TipoUnidadIngreso | string): string {
    return TIPO_UNIDAD_LABELS[tipo as TipoUnidadIngreso] ?? tipo;
  }

  codigo(u: UnidadesResponse): string {
    return u.codigo || u.codigo_interno || '—';
  }

  unidadMeta(u: UnidadesResponse): string {
    const tipo = u.tipo_unidad;
    const parts: string[] = [];
    const area = u.area_m2 ?? u.metros_cuadrados;
    if (area != null && area !== 0) parts.push(`${area} m²`);
    // lote_vacio: no superficie cubierta / cocheras
    if (tipo !== 'lote_vacio') {
      const cub = u.metros_construidos;
      if (cub != null && cub !== 0) parts.push(`${cub} m² cub.`);
      if (u.cocheras != null && u.cocheras !== 0) parts.push(`${u.cocheras} coch.`);
    }
    if (u.orientacion) parts.push(u.orientacion);
    if (u.precio != null) parts.push(formatPrecio(u.precio, u.moneda ?? 'USD'));
    return parts.join(' · ') || '—';
  }

  plantillaMeta(p: PlantillasUnidadResponse): string {
    const parts: string[] = [];
    if (p.area_m2 != null && p.area_m2 !== 0) parts.push(`${p.area_m2} m²`);
    if (p.orientacion) parts.push(p.orientacion);
    if (p.precio != null) parts.push(formatPrecio(p.precio, p.moneda ?? 'USD'));
    return parts.join(' · ') || '—';
  }
}

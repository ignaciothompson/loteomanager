import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { EstadoBadgeComponent } from '@loteomanager/shared-ui';
import type { PlantillasUnidadResponse, TipoUnidadIngreso, UnidadesResponse } from '@loteomanager/shared-types';
import { TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';

export type IngresoLateralTab = 'listado' | 'plantillas';

@Component({
  selector: 'app-ingreso-panel-lateral',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ButtonModule,
    TabsModule,
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

  readonly unidadesFiltradas = computed(() =>
    this.unidades().filter((u) => u.tipo_unidad === this.tipoUnidad())
  );

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
    const parts: string[] = [];
    if (u.area_m2 != null) parts.push(`${u.area_m2} m²`);
    if (u.metros_construidos != null) parts.push(`${u.metros_construidos} m² cub.`);
    if (u.orientacion) parts.push(u.orientacion);
    if (u.precio != null) parts.push(`${u.precio} ${u.moneda}`);
    return parts.join(' · ') || '—';
  }

  plantillaMeta(p: PlantillasUnidadResponse): string {
    const parts: string[] = [];
    if (p.area_m2 != null) parts.push(`${p.area_m2} m²`);
    if (p.precio != null) parts.push(`${p.precio} ${p.moneda ?? 'USD'}`);
    if (p.orientacion) parts.push(p.orientacion);
    return parts.join(' · ') || '—';
  }
}

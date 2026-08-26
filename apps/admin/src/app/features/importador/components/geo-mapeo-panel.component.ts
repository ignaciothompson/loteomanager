import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import type { MapeoGeografia, MapeoEntradaDepto, MapeoEntradaZona } from '../parser/types';
import { plural } from '../importador-ui';

export interface GeoOpt {
  label: string;
  value: string;
}

@Component({
  selector: 'app-geo-mapeo-panel',
  standalone: true,
  imports: [FormsModule, ButtonModule, SelectModule],
  templateUrl: './geo-mapeo-panel.component.html',
})
export class GeoMapeoPanelComponent {
  @Input({ required: true }) mapeo!: MapeoGeografia;
  @Input() departamentoOpts: GeoOpt[] = [];
  @Input() zonas: Array<{ id: string; nombre: string; departamento_id: string; slug?: string }> = [];
  @Output() mapeoChange = new EventEmitter<MapeoGeografia>();
  @Output() crearZona = new EventEmitter<MapeoEntradaZona>();

  get pendientes(): number {
    return (
      this.mapeo.departamentos.filter((d) => d.estado !== 'confirmado').length +
      this.mapeo.zonas.filter((z) => z.estado !== 'confirmado').length
    );
  }

  get todoResuelto(): boolean {
    const has = this.mapeo.departamentos.length + this.mapeo.zonas.length;
    return has > 0 && this.pendientes === 0;
  }

  usosLabel(usos?: number): string {
    const n = usos ?? 1;
    return `usado en ${plural(n, 'hoja', 'hojas')}`;
  }

  deptoNombre(deptoExcel: string): string {
    const d = this.mapeo.departamentos.find((x) => x.valor_excel === deptoExcel);
    return d?.nombre_sugerido || deptoExcel || '—';
  }

  zonaOpts(deptoExcel: string): GeoOpt[] {
    const deptoId = this.mapeo.departamentos.find((d) => d.valor_excel === deptoExcel)?.departamento_id;
    if (!deptoId) return [];
    return this.zonas
      .filter((z) => z.departamento_id === deptoId && z.slug !== 'todo')
      .map((z) => ({ label: z.nombre, value: z.id }));
  }

  onDepto(entry: MapeoEntradaDepto, id: string | null): void {
    const opt = this.departamentoOpts.find((o) => o.value === id);
    const departamentos = this.mapeo.departamentos.map((d) =>
      d.valor_excel === entry.valor_excel
        ? {
            ...d,
            departamento_id: id,
            estado: id ? ('confirmado' as const) : ('sin_resolver' as const),
            nombre_sugerido: opt?.label,
          }
        : d
    );
    const zonas = this.mapeo.zonas.map((z) =>
      z.departamento_excel === entry.valor_excel
        ? { ...z, zona_id: null, estado: 'sin_resolver' as const }
        : z
    );
    this.mapeoChange.emit({ ...this.mapeo, departamentos, zonas });
  }

  confirmarDepto(entry: MapeoEntradaDepto): void {
    if (!entry.departamento_id) return;
    const departamentos = this.mapeo.departamentos.map((d) =>
      d.valor_excel === entry.valor_excel ? { ...d, estado: 'confirmado' as const } : d
    );
    this.mapeoChange.emit({ ...this.mapeo, departamentos });
  }

  onZona(entry: MapeoEntradaZona, id: string | null): void {
    const zonas = this.mapeo.zonas.map((z) =>
      z.valor_excel === entry.valor_excel && z.departamento_excel === entry.departamento_excel
        ? {
            ...z,
            zona_id: id,
            estado: id ? ('confirmado' as const) : ('sin_resolver' as const),
          }
        : z
    );
    this.mapeoChange.emit({ ...this.mapeo, zonas });
  }

  confirmarZona(entry: MapeoEntradaZona): void {
    if (!entry.zona_id) return;
    const zonas = this.mapeo.zonas.map((z) =>
      z.valor_excel === entry.valor_excel && z.departamento_excel === entry.departamento_excel
        ? { ...z, estado: 'confirmado' as const }
        : z
    );
    this.mapeoChange.emit({ ...this.mapeo, zonas });
  }

  puedeCrearZona(z: MapeoEntradaZona): boolean {
    const deptoId = this.mapeo.departamentos.find((d) => d.valor_excel === z.departamento_excel)
      ?.departamento_id;
    return !!deptoId && !z.zona_id;
  }
}

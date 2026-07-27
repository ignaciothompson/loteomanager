import { Injectable, inject } from '@angular/core';
import * as ExcelJS from 'exceljs';
import {
  BarriosService,
  UnidadesService,
  VendedorAccesoService,
  ZonasService,
} from '@loteomanager/shared-pb-client';
import type { BarriosResponse } from '@loteomanager/shared-types';

export type ExportadorBarrioOpt = { label: string; value: string };

@Injectable({ providedIn: 'root' })
export class ExportadorService {
  private barriosSvc = inject(BarriosService);
  private unidadesSvc = inject(UnidadesService);
  private zonasSvc = inject(ZonasService);
  private vendedorAcceso = inject(VendedorAccesoService);

  /** Barrios accesibles para el usuario actual (admin: todos). */
  async listarBarriosAccesibles(): Promise<BarriosResponse[]> {
    const { barrioIds } = this.vendedorAcceso.resolveBarrioIds();
    return this.barriosSvc.listVisibles(barrioIds);
  }

  async exportarExcel(barrioIds: string[]): Promise<void> {
    if (!barrioIds.length) {
      throw new Error('Seleccioná al menos un barrio para exportar.');
    }

    const accesibles = await this.listarBarriosAccesibles();
    const idsSet = new Set(barrioIds);
    const barrios = accesibles.filter((b) => idsSet.has(b.id));
    if (!barrios.length) {
      throw new Error('No hay barrios accesibles para exportar.');
    }

    const zonaIds = [...new Set(barrios.map((b) => b.zona_id).filter(Boolean))];
    const zonas = zonaIds.length
      ? await this.zonasSvc.listAsync(zonaIds.map((id) => `id="${id}"`).join(' || '))
      : [];
    const zonaMap = new Map(zonas.map((z) => [z.id, z.nombre]));

    const unidades = await this.unidadesSvc.listByBarrios(barrios.map((b) => b.id), undefined, {
      sort: 'codigo',
    });
    const unidadesPorBarrio = new Map<string, number>();
    for (const u of unidades) {
      if (!u.barrio_id) continue;
      unidadesPorBarrio.set(u.barrio_id, (unidadesPorBarrio.get(u.barrio_id) ?? 0) + 1);
    }
    const barrioMap = new Map(barrios.map((b) => [b.id, b]));

    const wb = new ExcelJS.Workbook();
    wb.creator = 'LoteoManager';
    wb.created = new Date();

    const barriosSheet = wb.addWorksheet('Barrios', { views: [{ state: 'frozen', ySplit: 1 }] });
    barriosSheet.columns = [
      { header: 'Nombre', key: 'nombre', width: 26 },
      { header: 'Slug', key: 'slug', width: 26 },
      { header: 'Zona', key: 'zona', width: 18 },
      { header: 'Unidades', key: 'unidades', width: 12 },
    ];
    for (const b of barrios) {
      barriosSheet.addRow({
        nombre: b.nombre,
        slug: b.slug,
        zona: zonaMap.get(b.zona_id) ?? '',
        unidades: unidadesPorBarrio.get(b.id) ?? 0,
      });
    }
    this.styleHeaderRow(barriosSheet);

    const unidadesSheet = wb.addWorksheet('Unidades', { views: [{ state: 'frozen', ySplit: 1 }] });
    unidadesSheet.columns = [
      { header: 'Barrio', key: 'barrio_nombre', width: 24 },
      { header: 'Slug barrio', key: 'barrio_slug', width: 24 },
      { header: 'Zona', key: 'zona', width: 16 },
      { header: 'Código', key: 'codigo', width: 14 },
      { header: 'Tipo', key: 'tipo', width: 18 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Precio', key: 'precio', width: 12 },
      { header: 'Moneda', key: 'moneda', width: 10 },
      { header: 'Área m²', key: 'area_m2', width: 12 },
      { header: 'Visible web', key: 'web_visible', width: 12 },
    ];
    for (const u of unidades) {
      const barrio = u.barrio_id ? barrioMap.get(u.barrio_id) : undefined;
      unidadesSheet.addRow({
        barrio_nombre: barrio?.nombre ?? '',
        barrio_slug: barrio?.slug ?? '',
        zona: barrio ? zonaMap.get(barrio.zona_id) ?? '' : '',
        codigo: u.codigo,
        tipo: u.tipo_unidad,
        estado: u.estado,
        precio: u.precio ?? '',
        moneda: u.moneda,
        area_m2: u.metros_cuadrados ?? u.area_m2 ?? '',
        web_visible: u.web_visible ? 'Sí' : 'No',
      });
    }
    this.styleHeaderRow(unidadesSheet);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fecha = new Date().toISOString().slice(0, 10);
    a.download = `export-barrios-unidades-${fecha}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private styleHeaderRow(sheet: ExcelJS.Worksheet): void {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EEF5' },
    };
  }
}

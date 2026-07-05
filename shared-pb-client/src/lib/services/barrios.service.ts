import { Injectable } from '@angular/core';
import { toSlug } from '@loteomanager/shared-utils';
import { BaseCollectionService, type ListOptions } from '../base-collection.service';
import { BarriosResponse } from '@loteomanager/shared-types';

export type BarrioListFilters = {
  departamentoId?: string | null;
  zonaId?: string | null;
  nombre?: string;
  soloPublicados?: boolean;
};

export type BarrioConUnidades = BarriosResponse & { unidadesCount: number };

export type BarrioCatalogStats = {
  unidadesCount: number;
  precioDesde: number | null;
  moneda: string | null;
  areaMin: number | null;
  areaMax: number | null;
};

export type BarrioConCatalogo = BarriosResponse & BarrioCatalogStats;

@Injectable({
  providedIn: 'root'
})
export class BarriosService extends BaseCollectionService<BarriosResponse> {
  protected override collectionName = 'barrios';

  override async create(data: Partial<BarriosResponse>): Promise<BarriosResponse> {
    const payload = { ...data };
    if (payload.nombre) {
      payload.slug = toSlug(payload.nombre);
    }
    return super.create(payload);
  }

  override async update(id: string, data: Partial<BarriosResponse>): Promise<BarriosResponse> {
    const payload = { ...data };
    if (payload.nombre !== undefined) {
      payload.slug = toSlug(payload.nombre);
    }
    return super.update(id, payload);
  }

  async listVisibles(vendedorBarrioIds: string[] | null): Promise<BarriosResponse[]> {
    if (vendedorBarrioIds === null) {
      return this.listAsync();
    }
    if (vendedorBarrioIds.length === 0) {
      return [];
    }
    const filter = vendedorBarrioIds.map(id => `id="${id}"`).join(' || ');
    return this.listAsync(filter);
  }

  async listFiltered(
    filters: BarrioListFilters,
    visibleBarrioIds: string[] | null,
    options?: ListOptions
  ): Promise<BarriosResponse[]> {
    const parts: string[] = [];

    if (visibleBarrioIds !== null) {
      if (visibleBarrioIds.length === 0) return [];
      parts.push(`(${visibleBarrioIds.map((id) => `id="${id}"`).join(' || ')})`);
    }

    if (filters.zonaId) {
      parts.push(`zona_id="${filters.zonaId}"`);
    }

    const nombre = filters.nombre?.trim();
    if (nombre) {
      const escaped = nombre.replace(/"/g, '\\"');
      parts.push(`nombre ~ "${escaped}"`);
    }

    if (filters.soloPublicados) {
      parts.push('publicado = true');
    }

    const expand = options?.expand ?? 'zona_id,zona_id.departamento_id';
    let rows = await this.listAsync(parts.length ? parts.join(' && ') : undefined, {
      ...options,
      expand,
      sort: options?.sort ?? 'nombre'
    });

    if (filters.departamentoId) {
      rows = rows.filter((b) => {
        const zona = this.resolveExpandedZona(b);
        const deptId = zona?.departamento_id ?? zona?.expand?.departamento_id?.id;
        return deptId === filters.departamentoId;
      });
    }

    return rows;
  }

  async getBySlug(slug: string): Promise<BarriosResponse | null> {
    const escaped = slug.replace(/"/g, '\\"');
    try {
      return await this.pb.collection('barrios').getFirstListItem(`slug = "${escaped}"`);
    } catch (err: unknown) {
      const code = (err as { status?: number })?.status;
      if (code === 404) return null;
      throw err;
    }
  }

  async attachUnidadesDisponiblesWebCount(barrios: BarriosResponse[]): Promise<BarrioConUnidades[]> {
    const rows = await this.attachCatalogStats(barrios);
    return rows.map(({ unidadesCount, ...b }) => ({ ...b, unidadesCount }));
  }

  async attachCatalogStats(barrios: BarriosResponse[]): Promise<BarrioConCatalogo[]> {
    if (!barrios.length) return [];

    const ids = barrios.map((b) => b.id);
    const unidades = await this.pb.collection('unidades').getFullList({
      filter: `(${ids.map((id) => `barrio_id="${id}"`).join(' || ')}) && web_visible = true && estado = "disponible"`,
      fields: 'barrio_id,precio,moneda,metros_cuadrados,area_m2',
    });

    const stats: Record<string, BarrioCatalogStats> = {};
    for (const id of ids) {
      stats[id] = {
        unidadesCount: 0,
        precioDesde: null,
        moneda: null,
        areaMin: null,
        areaMax: null,
      };
    }

    for (const u of unidades) {
      const bid = u['barrio_id'] as string;
      const s = stats[bid];
      if (!s) continue;

      s.unidadesCount++;
      const precio = u['precio'] as number | undefined;
      const moneda = u['moneda'] as string | undefined;
      if (precio != null && (s.precioDesde == null || precio < s.precioDesde)) {
        s.precioDesde = precio;
        s.moneda = moneda ?? s.moneda ?? 'USD';
      }
      const area = (u['metros_cuadrados'] as number | undefined) ?? (u['area_m2'] as number | undefined);
      if (area != null) {
        s.areaMin = s.areaMin == null ? area : Math.min(s.areaMin, area);
        s.areaMax = s.areaMax == null ? area : Math.max(s.areaMax, area);
      }
    }

    return barrios.map((b) => ({
      ...b,
      ...stats[b.id],
    }));
  }

  async attachUnidadesCount(barrios: BarriosResponse[]): Promise<BarrioConUnidades[]> {
    if (!barrios.length) return [];

    const ids = barrios.map((b) => b.id);
    const unidades = await this.pb.collection('unidades').getFullList({
      filter: ids.map((id) => `barrio_id="${id}"`).join(' || '),
      fields: 'id,barrio_id'
    });

    const counts: Record<string, number> = {};
    for (const u of unidades) {
      const bid = u['barrio_id'] as string;
      counts[bid] = (counts[bid] ?? 0) + 1;
    }

    return barrios.map((b) => ({
      ...b,
      unidadesCount: counts[b.id] ?? 0
    }));
  }

  /** Elimina unidades, plantillas y asignaciones vendedor antes del barrio. */
  async deleteConDependencias(barrioId: string): Promise<{ unidades: number; plantillas: number }> {
    const [unidades, plantillas, asignaciones] = await Promise.all([
      this.pb.collection('unidades').getFullList({
        filter: `barrio_id="${barrioId}"`,
        fields: 'id'
      }),
      this.pb.collection('plantillas_unidad').getFullList({
        filter: `barrio_id="${barrioId}"`,
        fields: 'id'
      }),
      this.pb.collection('vendedor_barrios').getFullList({
        filter: `barrio_id="${barrioId}"`,
        fields: 'id'
      })
    ]);

    for (const u of unidades) {
      await this.pb.collection('unidades').delete(u.id);
    }
    for (const p of plantillas) {
      await this.pb.collection('plantillas_unidad').delete(p.id);
    }
    for (const a of asignaciones) {
      await this.pb.collection('vendedor_barrios').delete(a.id);
    }

    await this.delete(barrioId);
    return { unidades: unidades.length, plantillas: plantillas.length };
  }

  private resolveExpandedZona(barrio: BarriosResponse): {
    departamento_id?: string;
    expand?: { departamento_id?: { id: string } };
  } | undefined {
    const expand = (barrio as BarriosResponse & {
      expand?: { zona_id?: { departamento_id?: string | { id: string }; expand?: { departamento_id?: { id: string } } } };
    }).expand?.zona_id;
    if (!expand || typeof expand !== 'object') return undefined;
    const dept = expand.departamento_id;
    return {
      departamento_id: typeof dept === 'string' ? dept : dept?.id,
      expand: typeof dept === 'object' && dept ? { departamento_id: dept } : expand.expand
    };
  }
}

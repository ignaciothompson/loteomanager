import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  BarriosService,
  POCKETBASE,
  attachCatalogStatsFromSnapshots,
  isBarrioWebReady,
  type BarrioConSnapshotCatalogo,
} from '@loteomanager/shared-pb-client';

/** Vista unificada de barrio para catálogo/mapa, sin importar si vino del endpoint SSR o de PocketBase. */
export interface CatalogoBarrioVM {
  id: string;
  slug: string;
  nombre: string;
  ubicacionTexto: string | null;
  imagenPortadaUrl: string | null;
  lat: number | null;
  lng: number | null;
  unidadesCount: number;
  precioDesde: number | null;
  moneda: string | null;
  areaMin: number | null;
  areaMax: number | null;
}

export interface CatalogoMeta {
  lastPublishedAt: string | null;
}

interface CatalogoBarriosApiResponse {
  barrios: Array<{
    id: string;
    nombre: string;
    slug: string;
    ubicacionTexto: string | null;
    imagenPortadaUrl: string | null;
    lat: number | null;
    lng: number | null;
    stats: {
      unidadesCount: number;
      precioDesde: number | null;
      moneda: string | null;
      areaMin: number | null;
      areaMax: number | null;
    };
  }>;
}

/**
 * Fuente única para el catálogo público de barrios en la landing.
 * Prioriza el endpoint SSR `/api/catalogo/barrios` (rápido, cacheable, sin exponer PB
 * directo al browser) y cae a PocketBase (browser) si el endpoint falla.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private http = inject(HttpClient);
  private barriosSvc = inject(BarriosService);
  private pb = inject(POCKETBASE);

  async fetchBarrios(): Promise<CatalogoBarrioVM[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<CatalogoBarriosApiResponse>('/api/catalogo/barrios'),
      );
      if (!res?.barrios) throw new Error('Respuesta vacía de /api/catalogo/barrios');
      return res.barrios.map((b) => ({
        id: b.id,
        slug: b.slug,
        nombre: b.nombre,
        ubicacionTexto: b.ubicacionTexto,
        imagenPortadaUrl: b.imagenPortadaUrl,
        lat: b.lat,
        lng: b.lng,
        unidadesCount: b.stats.unidadesCount,
        precioDesde: b.stats.precioDesde,
        moneda: b.stats.moneda,
        areaMin: b.stats.areaMin,
        areaMax: b.stats.areaMax,
      }));
    } catch {
      return this.fetchBarriosFromPocketBase();
    }
  }

  async fetchMeta(): Promise<CatalogoMeta> {
    try {
      return await firstValueFrom(this.http.get<CatalogoMeta>('/api/catalogo/meta'));
    } catch {
      return { lastPublishedAt: null };
    }
  }

  private async fetchBarriosFromPocketBase(): Promise<CatalogoBarrioVM[]> {
    const rows = await this.barriosSvc.listFiltered({ soloPublicados: true }, null, {
      sort: 'nombre',
    });
    const withStats = attachCatalogStatsFromSnapshots(rows.filter(isBarrioWebReady));
    return withStats.map((b) => this.mapPbBarrio(b));
  }

  private mapPbBarrio(b: BarrioConSnapshotCatalogo): CatalogoBarrioVM {
    return {
      id: b.id,
      slug: b.slug,
      nombre: b.nombre,
      ubicacionTexto: b.ubicacion_texto ?? null,
      imagenPortadaUrl: b.imagen_portada ? this.pb.files.getURL(b, b.imagen_portada) : null,
      lat: b.lat ?? null,
      lng: b.lng ?? null,
      unidadesCount: b.unidadesCount,
      precioDesde: b.precioDesde,
      moneda: b.moneda,
      areaMin: b.areaMin,
      areaMax: b.areaMax,
    };
  }
}

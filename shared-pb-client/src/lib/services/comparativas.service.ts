import { Injectable } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { ComparativasResponse, ComparativasRecord } from '@loteomanager/shared-types';

const DEV_LANDING_URL = 'http://localhost:4000';

function stripSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function landingFromWindow(): string | null {
  if (typeof window === 'undefined') return null;
  const fromEnv = window.__env?.LANDING_URL?.trim();
  if (fromEnv) return stripSlash(fromEnv);

  const origin = window.location.origin;
  const host = window.location.hostname;
  if (origin.includes('localhost:4200') || origin.includes('localhost:4300')) {
    return DEV_LANDING_URL;
  }
  // Homelab: loteoadmin.* es el panel; la landing pública es loteoweb.*
  if (host.startsWith('loteoadmin.')) {
    return `${window.location.protocol}//${host.replace(/^loteoadmin\./, 'loteoweb.')}`;
  }
  return null;
}

@Injectable({
  providedIn: 'root'
})
export class ComparativasService extends BaseCollectionService<ComparativasResponse> {
  protected override collectionName = 'comparativas';

  getLandingBaseUrl(): string {
    return landingFromWindow() ?? DEV_LANDING_URL;
  }

  async crear(payload: Partial<ComparativasRecord>): Promise<{ record: ComparativasResponse; url: string }> {
    const record = await this.create(payload);
    const publicUrl = `${this.getLandingBaseUrl()}/c/${record.token_publico}`;
    return { record, url: publicUrl };
  }

  /** Filtra comparativas cuyo set de unidades intersecta barrios visibles. */
  async listVisibles(
    barrioIds: string[] | null,
    unidadesService: { listByBarrios: (ids: string[] | null) => Promise<{ id: string; barrio_id?: string }[]> },
    options?: { sort?: string }
  ): Promise<ComparativasResponse[]> {
    if (barrioIds === null) {
      return this.listAsync(undefined, options);
    }
    if (barrioIds.length === 0) {
      return [];
    }
    const unidades = await unidadesService.listByBarrios(barrioIds);
    const unitIds = new Set(unidades.map((u) => u.id));
    if (unitIds.size === 0) {
      return [];
    }
    const all = await this.listAsync(undefined, options);
    return all.filter((c) => (c.unidades_ids || []).some((id) => unitIds.has(id)));
  }

  async generarPdf(comparativaId: string): Promise<string> {
    // TODO: call /api/comparativas/:token/pdf endpoint
    console.log(`[ComparativasService] generarPdf para ${comparativaId}`);
    return Promise.resolve('');
  }
}

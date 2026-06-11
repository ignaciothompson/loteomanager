import { Injectable } from '@angular/core';
import { BaseCollectionService, type ListOptions } from '../base-collection.service';
import { UnidadesResponse } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class UnidadesService extends BaseCollectionService<UnidadesResponse> {
  protected override collectionName = 'unidades';

  async listByBarrios(
    barrioIds: string[] | null,
    extraFilter?: string,
    options?: ListOptions
  ): Promise<UnidadesResponse[]> {
    if (barrioIds === null) {
      return this.listAsync(extraFilter, options);
    }
    if (barrioIds.length === 0) {
      return [];
    }
    const barrioFilter = barrioIds.map(id => `barrio_id="${id}"`).join(' || ');
    const filter = extraFilter ? `(${barrioFilter}) && (${extraFilter})` : barrioFilter;
    return this.listAsync(filter, options);
  }

  async cambiarEstado(unidadId: string, nuevoEstado: string): Promise<UnidadesResponse> {
    try {
      return await this.update(unidadId, { estado: nuevoEstado as UnidadesResponse['estado'] });
    } catch (err: unknown) {
      const anyErr = err as { data?: { message?: string } };
      if (anyErr?.data?.message) {
        throw new Error(anyErr.data.message);
      }
      throw err;
    }
  }
}

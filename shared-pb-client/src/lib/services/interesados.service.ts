import { Injectable } from '@angular/core';
import { BaseCollectionService, type ListOptions } from '../base-collection.service';
import { InteresadosResponse } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class InteresadosService extends BaseCollectionService<InteresadosResponse> {
  protected override collectionName = 'interesados';

  async listVisibles(
    barrioIds: string[] | null,
    options?: ListOptions
  ): Promise<InteresadosResponse[]> {
    if (barrioIds === null) {
      return this.listAsync(undefined, options);
    }
    if (barrioIds.length === 0) {
      return [];
    }
    const byBarrio = barrioIds.map((id) => `barrio_id="${id}"`).join(' || ');
    const byUnidad = barrioIds.map((id) => `unidad_id.barrio_id="${id}"`).join(' || ');
    return this.listAsync(`(${byBarrio}) || (${byUnidad})`, options);
  }

  async cerrarComoGanado(interesadoId: string, unidadId: string): Promise<InteresadosResponse> {
    try {
      return await this.update(interesadoId, { estado: 'cerrado_ganado', unidad_id: unidadId });
    } catch (err: any) {
      if (err?.data?.message) {
        throw new Error(err.data.message);
      }
      throw err;
    }
  }
}

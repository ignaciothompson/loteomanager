import { Injectable } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { InteresadosResponse } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class InteresadosService extends BaseCollectionService<InteresadosResponse> {
  protected override collectionName = 'interesados';

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

import { Injectable } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { UnidadesResponse, UnidadesEstadoOptions } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class UnidadesService extends BaseCollectionService<UnidadesResponse> {
  protected override collectionName = 'unidades';

  async cambiarEstado(unidadId: string, nuevoEstado: UnidadesEstadoOptions): Promise<UnidadesResponse> {
    try {
      return await this.update(unidadId, { estado: nuevoEstado });
    } catch (err: any) {
      if (err?.data?.message) {
        throw new Error(err.data.message);
      }
      throw err;
    }
  }
}

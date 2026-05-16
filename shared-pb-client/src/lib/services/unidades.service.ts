import { Injectable } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { UnidadesResponse } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class UnidadesService extends BaseCollectionService<UnidadesResponse> {
  protected override collectionName = 'unidades';

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

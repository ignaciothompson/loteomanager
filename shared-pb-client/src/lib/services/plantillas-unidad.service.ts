import { Injectable } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { PlantillasUnidadResponse } from '@loteomanager/shared-types';

@Injectable({ providedIn: 'root' })
export class PlantillasUnidadService extends BaseCollectionService<PlantillasUnidadResponse> {
  protected override collectionName = 'plantillas_unidad';

  async listByBarrio(barrioId: string): Promise<PlantillasUnidadResponse[]> {
    return this.listAsync(`barrio_id="${barrioId}"`, { sort: 'nombre' });
  }
}

import { Injectable } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { BarriosResponse } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class BarriosService extends BaseCollectionService<BarriosResponse> {
  protected override collectionName = 'barrios';

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
}

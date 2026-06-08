import { Injectable } from '@angular/core';
import { toSlug } from '@loteomanager/shared-utils';
import { BaseCollectionService } from '../base-collection.service';
import { BarriosResponse } from '@loteomanager/shared-types';

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
}

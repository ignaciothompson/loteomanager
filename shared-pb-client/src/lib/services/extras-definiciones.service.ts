import { Injectable, signal, Signal } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import type { EntidadExtra, ExtrasDefinicion } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class ExtrasDefinicionesService extends BaseCollectionService<ExtrasDefinicion> {
  protected override collectionName = 'extras_definiciones';

  listByEntidad(entidad: EntidadExtra): Signal<ExtrasDefinicion[]> {
    const data = signal<ExtrasDefinicion[]>([]);
    const filter = `entidad = "${entidad}" && activo = true`;
    this.collection
      .getFullList({ filter, sort: 'orden_display' })
      .then((records) => {
        data.set(records as unknown as ExtrasDefinicion[]);
        this.error.set(null);
      })
      .catch((err) => this.error.set(err));
    return data;
  }

  async listByEntidadAsync(entidad: EntidadExtra): Promise<ExtrasDefinicion[]> {
    return (await this.collection.getFullList({
      filter: `entidad = "${entidad}" && activo = true`,
      sort: 'orden_display'
    })) as unknown as ExtrasDefinicion[];
  }

  async listAllAsync(): Promise<ExtrasDefinicion[]> {
    return (await this.collection.getFullList({ sort: 'entidad,orden_display' })) as unknown as ExtrasDefinicion[];
  }
}

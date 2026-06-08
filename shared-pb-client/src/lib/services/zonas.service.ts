import { Injectable } from '@angular/core';
import { toSlug } from '@loteomanager/shared-utils';
import { BaseCollectionService } from '../base-collection.service';

export type ZonaRecord = {
  id: string;
  nombre: string;
  slug: string;
  departamento_id: string;
};

@Injectable({ providedIn: 'root' })
export class ZonasService extends BaseCollectionService<ZonaRecord> {
  protected override collectionName = 'zonas';

  override async create(data: Partial<ZonaRecord>): Promise<ZonaRecord> {
    const nombre = (data.nombre ?? '').trim();
    return super.create({
      ...data,
      nombre,
      slug: toSlug(nombre),
    });
  }

  override async update(id: string, data: Partial<ZonaRecord>): Promise<ZonaRecord> {
    const payload = { ...data };
    if (payload.nombre !== undefined) {
      const nombre = payload.nombre.trim();
      payload.nombre = nombre;
      payload.slug = toSlug(nombre);
    }
    return super.update(id, payload);
  }

  isTodo(record: Pick<ZonaRecord, 'slug'>): boolean {
    return record.slug === 'todo';
  }
}

import { Injectable } from '@angular/core';
import { toSlug } from '@loteomanager/shared-utils';
import { BaseCollectionService } from '../base-collection.service';

export type DepartamentoRecord = {
  id: string;
  nombre: string;
  slug: string;
};

@Injectable({ providedIn: 'root' })
export class DepartamentosService extends BaseCollectionService<DepartamentoRecord> {
  protected override collectionName = 'departamentos';

  override async create(data: Partial<DepartamentoRecord>): Promise<DepartamentoRecord> {
    const nombre = (data.nombre ?? '').trim();
    return super.create({
      ...data,
      nombre,
      slug: toSlug(nombre),
    });
  }

  override async update(id: string, data: Partial<DepartamentoRecord>): Promise<DepartamentoRecord> {
    const existing = await this.getAsync(id);
    if (this.isTodo(existing)) {
      throw new Error('No se puede modificar el departamento "Todo".');
    }
    const payload = { ...data };
    if (payload.nombre !== undefined) {
      const nombre = payload.nombre.trim();
      payload.nombre = nombre;
      payload.slug = toSlug(nombre);
    }
    return super.update(id, payload);
  }

  isTodo(record: Pick<DepartamentoRecord, 'slug'>): boolean {
    return record.slug === 'todo';
  }
}

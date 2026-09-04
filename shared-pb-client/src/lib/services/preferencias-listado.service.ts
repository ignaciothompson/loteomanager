import { Injectable } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import type { PreferenciasListadoResponse } from '@loteomanager/shared-types';

export type ListadoKey = 'barrios' | 'interesados';

export type PreferenciasListadoOrden = {
  campo: string;
  dir: 'asc' | 'desc';
} | null;

export type PreferenciasListadoPayload = {
  columnas: string[];
  orden: PreferenciasListadoOrden;
  filtros: Record<string, unknown>;
};

@Injectable({
  providedIn: 'root'
})
export class PreferenciasListadoService extends BaseCollectionService<PreferenciasListadoResponse> {
  protected override collectionName = 'preferencias_listado';

  async getForUser(
    userId: string,
    listado: ListadoKey
  ): Promise<PreferenciasListadoResponse | null> {
    try {
      return await this.pb
        .collection(this.collectionName)
        .getFirstListItem(`user_id="${userId}" && listado="${listado}"`);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 404) return null;
      throw err;
    }
  }

  async upsertForUser(
    userId: string,
    listado: ListadoKey,
    payload: PreferenciasListadoPayload
  ): Promise<PreferenciasListadoResponse> {
    const existing = await this.getForUser(userId, listado);
    const body = {
      user_id: userId,
      listado,
      columnas: payload.columnas,
      orden: payload.orden,
      filtros: payload.filtros
    };
    if (existing) {
      return this.update(existing.id, body);
    }
    return this.create(body);
  }
}

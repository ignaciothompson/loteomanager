import { Injectable, signal, Signal } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import type { EntidadEstado, EstadoDefinicion } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class EstadosDefinicionesService extends BaseCollectionService<EstadoDefinicion> {
  protected override collectionName = 'estados_definiciones';

  listByEntidad(entidad: EntidadEstado): Signal<EstadoDefinicion[]> {
    const data = signal<EstadoDefinicion[]>([]);
    const filter = `entidad = "${entidad}" && activo = true`;
    this.collection
      .getFullList({ filter, sort: 'orden_display' })
      .then((records) => {
        data.set(records as unknown as EstadoDefinicion[]);
        this.error.set(null);
      })
      .catch((err) => this.error.set(err));
    return data;
  }

  async listByEntidadAsync(entidad: EntidadEstado): Promise<EstadoDefinicion[]> {
    return (await this.collection.getFullList({
      filter: `entidad = "${entidad}" && activo = true`,
      sort: 'orden_display'
    })) as unknown as EstadoDefinicion[];
  }

  async listAllAsync(): Promise<EstadoDefinicion[]> {
    return (await this.collection.getFullList({ sort: 'entidad,orden_display' })) as unknown as EstadoDefinicion[];
  }

  /**
   * Reasigna registros con el code del estado viejo al nuevo y elimina la definición custom.
   */
  async replaceAndDelete(
    estadoIdABorrar: string,
    estadoIdReemplazo: string
  ): Promise<{ registros_actualizados: number }> {
    const token = this.pb.authStore.token;
    const res = await fetch(
      `${this.pb.baseUrl}/api/admin/estados/replace-and-delete`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          estado_id_a_borrar: estadoIdABorrar,
          estado_id_reemplazo: estadoIdReemplazo
        })
      }
    );
    const body = (await res.json().catch(() => ({}))) as { registros_actualizados?: number; message?: string };
    if (!res.ok) {
      throw new Error(body.message || `Error ${res.status}`);
    }
    return { registros_actualizados: body.registros_actualizados ?? 0 };
  }
}

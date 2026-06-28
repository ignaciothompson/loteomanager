import { Injectable } from '@angular/core';
import { expandirPatron } from '@loteomanager/shared-utils';
import { BaseCollectionService, type ListOptions } from '../base-collection.service';
import { PlantillasUnidadResponse, UnidadesResponse } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class UnidadesService extends BaseCollectionService<UnidadesResponse> {
  protected override collectionName = 'unidades';

  async listByBarrio(barrioId: string, options?: ListOptions): Promise<UnidadesResponse[]> {
    return this.listAsync(`barrio_id="${barrioId}"`, options);
  }

  async listByBarrios(
    barrioIds: string[] | null,
    extraFilter?: string,
    options?: ListOptions
  ): Promise<UnidadesResponse[]> {
    if (barrioIds === null) {
      return this.listAsync(extraFilter, options);
    }
    if (barrioIds.length === 0) {
      return [];
    }
    const barrioFilter = barrioIds.map(id => `barrio_id="${id}"`).join(' || ');
    const filter = extraFilter ? `(${barrioFilter}) && (${extraFilter})` : barrioFilter;
    return this.listAsync(filter, options);
  }

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

  async generarDesdePlantilla(
    plantilla: PlantillasUnidadResponse,
    responsableId: string
  ): Promise<UnidadesResponse[]> {
    const codigos = expandirPatron(plantilla.patron_codigo, plantilla.cantidad);
    const creadas: UnidadesResponse[] = [];

    for (const codigo of codigos) {
      const payload: Partial<UnidadesResponse> = {
        barrio_id: plantilla.barrio_id,
        tipo_unidad: plantilla.tipo_unidad,
        codigo,
        codigo_interno: codigo,
        area_m2: plantilla.area_m2,
        metros_cuadrados: plantilla.area_m2,
        orientacion: plantilla.orientacion,
        precio: plantilla.precio,
        moneda: plantilla.moneda ?? 'USD',
        estado: plantilla.estado_inicial ?? 'disponible',
        web_visible: plantilla.web_visible ?? true,
        pendiente_publicar: true,
        responsable_id: responsableId,
      };

      if (plantilla.modelo && plantilla.tipo_unidad === 'casa_prefabricada') {
        payload.numero_unidad = plantilla.modelo;
      }

      creadas.push(await this.create(payload));
    }

    return creadas;
  }

  async crearIndividual(
    data: Partial<UnidadesResponse> & { codigo: string; barrio_id: string; tipo_unidad: UnidadesResponse['tipo_unidad'] },
    responsableId: string
  ): Promise<UnidadesResponse> {
    return this.create({
      ...data,
      codigo_interno: data.codigo,
      metros_cuadrados: data.area_m2 ?? data.metros_cuadrados,
      responsable_id: responsableId,
      pendiente_publicar: true,
      web_visible: data.web_visible ?? true,
    });
  }

  async createBulk(
    base: Partial<UnidadesResponse> & {
      codigoBase: string;
      barrio_id: string;
      tipo_unidad: UnidadesResponse['tipo_unidad'];
      patron_codigo?: string;
    },
    cantidad: number,
    responsableId: string
  ): Promise<UnidadesResponse[]> {
    const count = Math.max(1, cantidad);
    const codigos =
      count > 1 && base.patron_codigo
        ? expandirPatron(base.patron_codigo, count)
        : Array.from({ length: count }, (_, i) => (count > 1 ? `${base.codigoBase}-${i + 1}` : base.codigoBase));

    const creadas: UnidadesResponse[] = [];
    for (const codigo of codigos) {
      const { codigoBase: _cb, patron_codigo: _pc, ...rest } = base;
      creadas.push(
        await this.crearIndividual(
          { ...rest, codigo, barrio_id: base.barrio_id, tipo_unidad: base.tipo_unidad },
          responsableId
        )
      );
    }
    return creadas;
  }
}

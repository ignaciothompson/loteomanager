import { Injectable, inject } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { ImportacionesResponse, ImportacionFilasResponse, ImportacionesTipoOptions } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class ImportacionesService extends BaseCollectionService<ImportacionesResponse> {
  protected override collectionName = 'importaciones';

  async uploadExcel(file: File, tipo: ImportacionesTipoOptions): Promise<ImportacionesResponse> {
    const formData = new FormData();
    formData.append('archivo_origen', file);
    formData.append('tipo', tipo);
    formData.append('origen', 'excel');
    formData.append('estado', 'analizando');
    formData.append('creado_por', this.pb.authStore.model?.id || '');

    try {
      const record = await this.pb.collection(this.collectionName).create<ImportacionesResponse>(formData);
      return record;
    } catch (err) {
      throw err;
    }
  }

  async confirmar(importacionId: string): Promise<void> {
    try {
      // 1. Fetch all pending rows that shouldn't be skipped
      const filas = await this.pb.collection('importacion_filas').getFullList<ImportacionFilasResponse>({
        filter: `importacion_id = '${importacionId}' && decision_usuario != 'omitir' && aplicada = false`,
      });

      // 2. Process each row
      for (const fila of filas) {
        try {
          const normalizados = fila.datos_normalizados as Record<string, unknown>;
          // Determine target collection.
          // Format 1 could have type property inside, or we can look at decision_usuario
          const isBarrio = normalizados['slug'] !== undefined;
          const targetCollection = isBarrio ? 'barrios' : 'unidades';

          if (fila.decision_usuario === 'crear') {
            await this.pb.collection(targetCollection).create(normalizados);
          } else if (fila.decision_usuario === 'actualizar' && fila.registro_existente_id) {
            await this.pb.collection(targetCollection).update(fila.registro_existente_id, normalizados);
          }

          // Mark as applied
          await this.pb.collection('importacion_filas').update(fila.id, { aplicada: true });
        } catch (rowErr) {
          console.error(`Error procesando fila ${fila.numero_fila}:`, rowErr);
          // Could update the row to state 'error' here
        }
      }

      // 3. Update the main import record
      await this.update(importacionId, {
        estado: 'confirmada',
        confirmada_en: new Date().toISOString()
      });

    } catch (err) {
      throw err;
    }
  }
}
